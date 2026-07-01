/**
 * Offline-Sync-Engine: leert die IndexedDB-Queue Richtung Supabase.
 * Trigger: App-Start, Online-Event, visibilitychange, manueller Sync,
 * Auto-Sync-Intervall.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  deleteJob,
  listJobs,
  pendingCount,
  updateJob,
  type QueueJob,
} from "./offline-db";

const MAX_ATTEMPTS = 5;
const LAST_SYNC_KEY = "myr.lastSyncAt";

type Listener = (state: SyncState) => void;

export type SyncState = {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  lastError: string | null;
};

const listeners = new Set<Listener>();
let syncing = false;
let lastError: string | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let started = false;

async function snapshot(): Promise<SyncState> {
  const jobs = await listJobs();
  const failed = jobs.filter((j) => j.status === "failed").length;
  const pending = jobs.filter((j) => j.status !== "failed").length;
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    syncing,
    pending,
    failed,
    lastSyncAt: readLastSync(),
    lastError,
  };
}

function readLastSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function writeLastSync(iso: string) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    /* ignore */
  }
}

async function notify() {
  const state = await snapshot();
  for (const l of listeners) l(state);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void snapshot().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getSyncState(): Promise<SyncState> {
  return snapshot();
}

async function processJob(job: QueueJob): Promise<void> {
  if (job.kind === "raum_upsert") {
    const { error } = await supabase.rpc("upsert_raum_snapshot", {
      p: job.payload as never,
    });
    if (error) throw new Error(error.message);
    return;
  }
  throw new Error(`Unbekannter Job-Typ: ${job.kind}`);
}

function backoffOk(job: QueueJob): boolean {
  // Exponentieller Backoff basierend auf attempts: 0, 5s, 15s, 45s, 2m, 5m
  const delays = [0, 5_000, 15_000, 45_000, 120_000, 300_000];
  const wait = delays[Math.min(job.attempts, delays.length - 1)];
  return Date.now() - job.createdAt >= wait || job.attempts === 0;
}

export async function drain(): Promise<void> {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await notify();
    return;
  }
  syncing = true;
  lastError = null;
  await notify();
  try {
    const jobs = (await listJobs())
      .filter((j) => j.status !== "failed")
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const job of jobs) {
      if (!backoffOk(job)) continue;
      await updateJob(job.id, { status: "syncing" });
      try {
        await processJob(job);
        await deleteJob(job.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const attempts = job.attempts + 1;
        const status: QueueJob["status"] = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        await updateJob(job.id, { attempts, lastError: msg, status });
        lastError = msg;
      }
      await notify();
    }
    if ((await pendingCount()) === 0) {
      const iso = new Date().toISOString();
      writeLastSync(iso);
    }
  } finally {
    syncing = false;
    await notify();
  }
}

export function startAutoSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const trigger = () => {
    void drain();
  };
  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });
  // Erste Runde nach kurzem Delay, damit Auth-Session Zeit hat sich zu setzen
  setTimeout(trigger, 1500);
  // Regelmäßiger Retry für zurückgehaltene Jobs mit Backoff
  intervalHandle = setInterval(trigger, 30_000);
}

export function stopAutoSync(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
}
