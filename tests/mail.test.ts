import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { emails } from "@/server/emails";
import { sendMail } from "@/server/mail";
import { freshDb } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Transaktionsmails", () => {
  it("escaped benutzerkontrollierten Namen im HTML und behält den Produktionslink", () => {
    const content = emails.passwordReset('<img src=x onerror="alert(1)">', "https://lieferdank.de/passwort-neu?token=abc", 60);
    expect(content.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(content.html).not.toContain('<img src=x onerror="alert(1)">');
    expect(content.html).toContain("https://lieferdank.de/passwort-neu?token=abc");
  });

  it("schickt Reply-To korrekt und blockiert CRLF in Mail-Headern", async () => {
    freshDb();
    vi.stubEnv("RESEND_API_KEY", "local-test-token");
    vi.stubEnv("MAIL_FROM", "Lieferdank <noreply@lieferdank.de>");
    vi.stubEnv("MAIL_REPLY_TO", "support@lieferdank.de");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const content = emails.welcomeDriver("Max", "LD-ABCDE", "https://lieferdank.de/dashboard");
    expect((await sendMail("max@test.de", content, "welcome_driver")).delivered).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.from).toBe("Lieferdank <noreply@lieferdank.de>");
    expect(body.reply_to).toBe("support@lieferdank.de");
    vi.stubEnv("MAIL_REPLY_TO", "support@lieferdank.de\r\nBcc: attacker@example.org");
    expect((await sendMail("max@test.de", content, "welcome_driver")).delivered).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await getDb().systemEvents.findMany()).at(-1)?.source).toBe("mail");
  });

  it("protokolliert Provider-Ausfall ohne API-Token oder Empfänger im Fehler", async () => {
    freshDb();
    vi.stubEnv("RESEND_API_KEY", "local-test-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Bearer local-test-token max@test.de"));
    const result = await sendMail("max@test.de", emails.welcomeDriver("Max", "LD-ABCDE", "https://lieferdank.de/dashboard"), "welcome_driver");
    expect(result.delivered).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const events = await getDb().systemEvents.findMany();
    expect(JSON.stringify(events)).not.toContain("local-test-token");
    expect(JSON.stringify(events)).not.toContain("max@test.de");
  });
});
