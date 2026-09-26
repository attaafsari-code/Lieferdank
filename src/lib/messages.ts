/** Vorgegebene positive Nachrichten (§13). Kein Freitext-Zwang, keine Negativoption (§14). */
export type PresetMessage = { id: string; emoji: string; text: string };

export const PRESET_MESSAGES: PresetMessage[] = [
  { id: "freundlich", emoji: "\u{1F44F}", text: "Immer freundlich" },
  { id: "paket", emoji: "\u{1F4E6}", text: "Danke fürs Paket" },
  { id: "hochtragen", emoji: "\u{1F4AA}", text: "Danke fürs Hochtragen" },
  { id: "wetter", emoji: "\u{1F327}\u{FE0F}", text: "Danke trotz des Wetters" },
  { id: "einfach", emoji: "❤️", text: "Einfach Danke" },
  { id: "feierabend", emoji: "\u{1F642}", text: "Schönen Feierabend" },
];

export function presetById(id: string | null | undefined): PresetMessage | null {
  if (!id) return null;
  return PRESET_MESSAGES.find((m) => m.id === id) ?? null;
}

export const MAX_CUSTOM_MESSAGE_LENGTH = 140;
