import logo from "@/assets/myr-logo.png.asset.json";

type Props = {
  variant?: "mark" | "full";
  className?: string;
  height?: number;
};

/**
 * MYR / Deco & More Logo. Bleibt zentral und immer auf transparentem Untergrund.
 * `mark` und `full` zeigen aktuell dieselbe Datei (Wordmark), variieren nur in Größe.
 */
export function AppLogo({ variant = "mark", className, height }: Props) {
  const h = height ?? (variant === "full" ? 84 : 28);
  return (
    <img
      src={logo.url}
      alt="MYR – Deco & More"
      className={className}
      style={{ height: h, width: "auto", objectFit: "contain", display: "block" }}
      draggable={false}
    />
  );
}
