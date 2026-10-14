import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, makeDriver } from "./helpers";
import { getDb } from "@/lib/db";
import { attachMessage, sendFreeThankYou } from "@/server/services/thanks";
import { blockSender, openReports, reportMessage, resolveReport, screenMessage } from "@/server/services/moderation";

const visitorA = "a".repeat(32);
const visitorB = "b".repeat(32);
beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.spyOn(console, "info").mockImplementation(() => undefined); });

async function messageFrom(driverCode: string, visitor: string, text: string, day = new Date("2026-10-14T10:00:00Z")) {
  const { thankYouId } = await sendFreeThankYou(driverCode, null, visitor, day);
  await attachMessage(thankYouId, null, text, [`t:${thankYouId}`], visitor);
  return (await getDb().thankYous.get(thankYouId))!;
}

describe("Filter", () => {
  it.each(["Besuch www.spam.example", "Ruf an: 0171 2345678", "mail mich: a@b.de", "du Hurensohn"])("rejects %s", (text) => {
    expect(() => screenMessage(text)).toThrow("Diese Nachricht können wir so nicht zustellen");
  });
  it("keeps normal thanks", () => expect(screenMessage("Danke für die schnelle Lieferung im Regen!")).toBe("Danke für die schnelle Lieferung im Regen!"));
  it("does not store a filtered message", async () => {
    const { driver } = await makeDriver();
    const { thankYouId } = await sendFreeThankYou(driver.code, null, visitorA);
    await expect(attachMessage(thankYouId, null, "klick www.gewinn.example", [`t:${thankYouId}`], visitorA)).rejects.toMatchObject({ code: "message_rejected" });
    expect((await getDb().thankYous.get(thankYouId))?.message).toBeNull();
  });
});

describe("Report and block", () => {
  it("report hides the message at once, keeps one report and the operator can resolve it", async () => {
    const { driver } = await makeDriver();
    const thank = await messageFrom(driver.code, visitorA, "Unfreundlicher Text");
    expect(thank.senderKey).toMatch(/^[0-9a-f]{64}$/);
    await reportMessage(driver.id, thank.id); await reportMessage(driver.id, thank.id);
    expect((await getDb().thankYous.get(thank.id))?.message).toBeNull();
    const reports = await openReports();
    expect(reports).toHaveLength(1); expect(reports[0].message).toBe("Unfreundlicher Text");
    await resolveReport(reports[0].id);
    expect(await openReports()).toHaveLength(0);
    expect((await getDb().messageReports.get(reports[0].id))?.message).toBeNull();
  });
  it("another driver cannot report or block someone else's message", async () => {
    const a = await makeDriver(); const b = await makeDriver();
    const thank = await messageFrom(a.driver.code, visitorA, "Hallo");
    await expect(reportMessage(b.driver.id, thank.id)).rejects.toMatchObject({ status: 404 });
    await expect(blockSender(b.driver.id, thank.id)).rejects.toMatchObject({ status: 404 });
  });
  it("a blocked sender's later messages never reach the driver, other senders still do, other drivers are unaffected", async () => {
    const { driver } = await makeDriver(); const other = await makeDriver();
    const first = await messageFrom(driver.code, visitorA, "Erste Nachricht");
    await blockSender(driver.id, first.id);
    const later = await messageFrom(driver.code, visitorA, "Neue Nachricht", new Date("2026-10-15T10:00:00Z"));
    expect(later.message).toBeNull();
    expect((await messageFrom(driver.code, visitorB, "Von jemand anderem", new Date("2026-10-15T11:00:00Z"))).message).toBe("Von jemand anderem");
    expect((await messageFrom(other.driver.code, visitorA, "An anderen Zusteller")).message).toBe("An anderen Zusteller");
  });
  it("sender keys differ between drivers, so no driver can track a customer across profiles", async () => {
    const a = await makeDriver(); const b = await makeDriver();
    const one = await messageFrom(a.driver.code, visitorA, "Hallo A");
    const two = await messageFrom(b.driver.code, visitorA, "Hallo B");
    expect(one.senderKey).not.toBe(two.senderKey);
  });
});
