import type { NameDisplay } from "./db/types";

/**
 * Öffentliche Namen. Der Zusteller entscheidet, was Kunden sehen.
 * Reine Funktionen ohne Server-Abhängigkeit – auch in einer App nutzbar.
 */

export const NAME_DISPLAY_OPTIONS: { id: NameDisplay; label: string }[] = [
  { id: "first", label: "Nur Vorname" },
  { id: "first_initial", label: "Vorname + Initial" },
  { id: "full", label: "Vor- und Nachname" },
  { id: "last", label: "Nur Nachname" },
  { id: "custom", label: "Eigener Anzeigename" },
];

export const MAX_CUSTOM_NAME_LENGTH = 30;

export function publicName(
  firstName: string,
  lastName: string,
  mode: NameDisplay,
  customName: string | null,
): string {
  const first = firstName.trim();
  const last = lastName.trim();

  switch (mode) {
    case "last":
      return last || first;
    case "first_initial":
      return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
    case "full":
      return [first, last].filter(Boolean).join(" ");
    case "custom":
      return customName?.trim() || first;
    case "first":
    default:
      return first || last;
  }
}

/**
 * Dativ für die Überschrift „Sag … Danke“.
 * „Herr Müller“ → „Herrn Müller“. Alles andere bleibt unverändert.
 */
export function dativeName(name: string): string {
  return name.replace(/^Herr(?=\s)/, "Herrn");
}

/** Initialen für den Avatar ohne Foto, z. B. „Max Müller“ → „MM“. */
export function initials(name: string): string {
  const cleaned = name.replace(/^(Herrn?|Frau)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
