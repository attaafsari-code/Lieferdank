import { describe, expect, it } from "vitest";
import { classifyUrl, PRODUCTION_URL, resolveBaseUrl } from "@/lib/base-url";

describe("Basis-URL der QR-Codes", () => {
  it("verwendet in Produktion niemals localhost", () => {
    const result = resolveBaseUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: "http://localhost:3000" }, null);
    expect(result.url).toBe(PRODUCTION_URL);
    expect(result.warning).toContain("nicht erlaubt");
  });

  it("verwendet in Produktion keine private Netzwerkadresse", () => {
    const result = resolveBaseUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: "https://192.168.1.5" }, null);
    expect(result.url).toBe(PRODUCTION_URL);
  });

  it("verlangt in Produktion https", () => {
    expect(resolveBaseUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: "http://lieferdank.de" }, null).url).toBe(PRODUCTION_URL);
  });

  it("übernimmt eine gültige Produktionsadresse", () => {
    expect(resolveBaseUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: "https://lieferdank.de/" }, null).url).toBe(
      "https://lieferdank.de",
    );
  });

  it("nutzt auf Vercel Production immer lieferdank.de", () => {
    expect(resolveBaseUrl({ NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "lieferdank-abc.vercel.app" }, null).url).toBe(
      PRODUCTION_URL,
    );
  });

  it("nutzt auf Vercel Preview die Preview-Adresse", () => {
    expect(resolveBaseUrl({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "lieferdank-git-x.vercel.app" }, null).url).toBe(
      "https://lieferdank-git-x.vercel.app",
    );
  });

  it("fällt in Produktion ohne Angaben auf lieferdank.de zurück", () => {
    expect(resolveBaseUrl({ NODE_ENV: "production" }, "192.168.1.5").url).toBe(PRODUCTION_URL);
  });

  it("nutzt in der Entwicklung die LAN-Adresse, damit Handys scannen können", () => {
    expect(resolveBaseUrl({ NODE_ENV: "development", PORT: "3000" }, "192.168.178.67").url).toBe("http://192.168.178.67:3000");
  });

  it("fällt in der Entwicklung ohne LAN auf localhost zurück", () => {
    expect(resolveBaseUrl({ NODE_ENV: "development" }, null).url).toBe("http://localhost:3000");
  });

  it("klassifiziert Adressen", () => {
    expect(classifyUrl("https://lieferdank.de")).toBe("public");
    expect(classifyUrl("http://192.168.0.2:3000")).toBe("lan");
    expect(classifyUrl("http://10.1.2.3")).toBe("lan");
    expect(classifyUrl("http://172.20.0.1")).toBe("lan");
    expect(classifyUrl("http://172.32.0.1")).toBe("public");
    expect(classifyUrl("http://localhost:3000")).toBe("localhost");
    expect(classifyUrl("kaputt")).toBe("localhost");
  });
});
