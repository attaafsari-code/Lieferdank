/**
 * Liegt das Projekt in einem iCloud-synchronisierten Ordner (z. B. Schreibtisch),
 * blockiert iCloud Dateizugriffe, während es Tausende Dateien hochlädt – Builds
 * hängen dann minutenlang. Dieses Skript nimmt die Arbeitsordner vom Sync aus.
 *
 * Läuft nach `npm install`. Auf allen Systemen außer macOS passiert nichts.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.platform === "darwin" && !process.env.CI && !process.env.VERCEL) {
  for (const dir of ["node_modules", ".next", ".next.nosync"]) {
    if (!existsSync(dir)) continue;
    try {
      execFileSync("xattr", ["-w", "com.apple.fileprovider.ignore#P", "1", dir], { stdio: "ignore" });
    } catch {
      // Kein iCloud oder keine Berechtigung – dann gibt es auch nichts zu tun.
    }
  }
}
