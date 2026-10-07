import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findDriver: vi.fn(), outcome: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/server/services/drivers", () => ({
  findDriverByCode: mocks.findDriver,
  toPublicDriver: () => ({ name: "Mira", initials: "M", code: "LD-TEST", photoUrl: null }),
}));
vi.mock("@/server/services/thanks", () => ({ paymentOutcome: mocks.outcome }));
vi.mock("@/server/session", () => ({ getSession: async () => null }));
vi.mock("@/server/services/favorites", () => ({ isFavorite: async () => false }));
vi.mock("@/server/message-grant", () => ({
  messageGrantsFromCookie: async () => [],
  paymentSubject: (id: string) => `p:${id}`,
  thankYouSubject: (id: string) => `t:${id}`,
}));
vi.mock("@/components/avatar", () => ({ Avatar: () => null }));
vi.mock("@/components/icons", () => ({ Heart: () => null }));
vi.mock("@/components/legal-links", () => ({ LegalLinks: () => null }));
vi.mock("@/app/danke/[code]/erfolg/message-form", () => ({ MessageForm: () => null }));
vi.mock("@/app/danke/[code]/erfolg/save-driver", () => ({ SaveDriver: () => null }));
vi.mock("@/app/danke/[code]/erfolg/optional-tip", () => ({ OptionalTip: () => null }));

import SuccessPage from "@/app/danke/[code]/erfolg/page";

beforeEach(() => {
  mocks.findDriver.mockResolvedValue({ driver: { id: "driver-id" }, user: { id: "user-id" } });
});
afterEach(() => { vi.clearAllMocks(); });

async function render() {
  return renderToStaticMarkup(await SuccessPage({
    params: Promise.resolve({ code: "LD-TEST" }),
    searchParams: Promise.resolve({ zahlung: "payment-id" }),
  }));
}

describe("Öffentliche Zahlungsbestätigung", () => {
  it("zeigt eine Vollerstattung statt einer angeblich ausstehenden Bestätigung", async () => {
    mocks.outcome.mockResolvedValue({ status: "refunded", grossCents: 300, thankYouId: null });
    const html = await render();
    expect(html).toContain("Diese Zahlung wurde zurückerstattet.");
    expect(html).not.toContain("noch nicht bestätigt");
    expect(html).not.toContain("war erfolgreich");
  });

  it("bestätigt ausschließlich eine erfolgreich zugeordnete Zahlung", async () => {
    mocks.outcome.mockResolvedValue({ status: "succeeded", grossCents: 300, thankYouId: "thanks-id" });
    const html = await render();
    expect(html).toContain("war erfolgreich");
    expect(mocks.outcome).toHaveBeenCalledWith("payment-id", "driver-id");
  });

  it("stellt eine noch offene Zahlung als ausstehend dar", async () => {
    mocks.outcome.mockResolvedValue({ status: "pending", grossCents: 300, thankYouId: null });
    const html = await render();
    expect(html).toContain("Deine Zahlung wird gerade bestätigt");
    expect(html).not.toContain("war erfolgreich");
  });

  it.each(["failed", "review_required", null])("bestätigt %s niemals als erfolgreiche Zahlung", async (status) => {
    mocks.outcome.mockResolvedValue(status ? { status, grossCents: 300, thankYouId: null } : null);
    const html = await render();
    expect(html).toContain("noch nicht bestätigt");
    expect(html).not.toContain("war erfolgreich");
    expect(html).not.toContain("hat deine Wertschätzung");
  });

  it("behauptet bei einem nicht verfügbaren Fahrer keinen Zahlungserfolg", async () => {
    mocks.findDriver.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain("noch nicht bestätigt");
    expect(html).not.toContain("hat deine Wertschätzung");
    expect(mocks.outcome).not.toHaveBeenCalled();
  });
});
