/**
 * IndexedDB wrapper for offline write-queue and local snapshots.
 * No external deps — vanilla IndexedDB.
 */

const DB_NAME = "myr-aufmass";
const DB_VERSION = 1;
const STORE_QUEUE = "queue";
const STORE_DRAFT = "raum_draft";

export type QueueJob = {
  id: string;
  kind: "raum_upsert" | "fehlermeldung_insert";
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  status: "pending" | "syncing" | "failed";
  raumId?: string;
  projektId?: string;
};

export type RaumDraft = {
  raumId: string;
  projektId: string;
  updatedAt: number;
  data: unknown;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB nicht verfügbar"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const s = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt");
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains(STORE_DRAFT)) {
        db.createObjectStore(STORE_DRAFT, { keyPath: "raumId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const r = fn(s);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
        if (r instanceof IDBRequest) {
          r.onsuccess = () => resolve(r.result as T);
          r.onerror = () => reject(r.error);
        } else {
          r.then(resolve, reject);
        }
      }),
  );
}

/* ============================================================
 * Queue-Operationen
 * ============================================================ */

export async function enqueueJob(
  job: Omit<QueueJob, "id" | "createdAt" | "attempts" | "lastError" | "status">,
): Promise<QueueJob> {
  const full: QueueJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    status: "pending",
    ...job,
  };
  await tx(STORE_QUEUE, "readwrite", (s) => s.put(full));
  return full;
}

export async function listJobs(): Promise<QueueJob[]> {
  return tx<QueueJob[]>(STORE_QUEUE, "readonly", (s) => s.getAll() as IDBRequest<QueueJob[]>);
}

export async function pendingCount(): Promise<number> {
  const jobs = await listJobs();
  return jobs.filter((j) => j.status !== "failed").length;
}

export async function updateJob(id: string, patch: Partial<QueueJob>): Promise<void> {
  await tx(STORE_QUEUE, "readwrite", (s) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = s.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as QueueJob | undefined;
        if (!existing) return resolve();
        const putReq = s.put({ ...existing, ...patch });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

export async function deleteJob(id: string): Promise<void> {
  await tx(STORE_QUEUE, "readwrite", (s) => s.delete(id));
}

export async function clearFailedJobs(): Promise<void> {
  const jobs = await listJobs();
  for (const j of jobs) if (j.status === "failed") await deleteJob(j.id);
}

/* ============================================================
 * Draft-Operationen (aktueller lokaler Raum-Zustand)
 * ============================================================ */

export async function putDraft(draft: RaumDraft): Promise<void> {
  await tx(STORE_DRAFT, "readwrite", (s) => s.put(draft));
}

export async function getDraft(raumId: string): Promise<RaumDraft | undefined> {
  return tx<RaumDraft | undefined>(STORE_DRAFT, "readonly", (s) => s.get(raumId) as IDBRequest<RaumDraft | undefined>);
}

export async function deleteDraft(raumId: string): Promise<void> {
  await tx(STORE_DRAFT, "readwrite", (s) => s.delete(raumId));
}

export async function listDrafts(): Promise<RaumDraft[]> {
  return tx<RaumDraft[]>(STORE_DRAFT, "readonly", (s) => s.getAll() as IDBRequest<RaumDraft[]>);
}
