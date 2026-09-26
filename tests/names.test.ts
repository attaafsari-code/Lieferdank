import { describe, expect, it } from "vitest";
import { dativeName, initials, publicName } from "@/lib/names";

describe("Öffentlicher Name", () => {
  it.each([
    ["first", "Max", null],
    ["last", "Müller", null],
    ["first_initial", "Max M.", null],
    ["full", "Max Müller", null],
    ["custom", "Herr Müller", "Herr Müller"],
  ] as const)("Modus %s → %s", (mode, expected, custom) => {
    expect(publicName("Max", "Müller", mode, custom)).toBe(expected);
  });

  it("fällt bei leerem eigenen Namen auf den Vornamen zurück", () => {
    expect(publicName("Max", "Müller", "custom", "   ")).toBe("Max");
  });

  it("kommt ohne Nachnamen aus", () => {
    expect(publicName("Lena", "", "first_initial", null)).toBe("Lena");
    expect(publicName("Lena", "", "last", null)).toBe("Lena");
  });
});

describe("Dativ für „Sag … Danke“", () => {
  it("macht aus Herr → Herrn", () => {
    expect(dativeName("Herr Müller")).toBe("Herrn Müller");
  });
  it("lässt alles andere unverändert", () => {
    expect(dativeName("Frau Schmidt")).toBe("Frau Schmidt");
    expect(dativeName("Max")).toBe("Max");
    expect(dativeName("Herrmann")).toBe("Herrmann");
  });
});

describe("Initialen", () => {
  it.each([
    ["Max Müller", "MM"],
    ["Max", "M"],
    ["Herr Müller", "M"],
    ["Ayşe Y.", "AY"],
    ["", "?"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
