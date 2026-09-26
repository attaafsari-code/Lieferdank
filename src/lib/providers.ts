/**
 * Zustelldienste (§10). Im MVP ausschliesslich Text, keine fremden Logos (§84).
 * `logoAllowed` bleibt bewusst false, bis eine Kooperation existiert.
 */
export type DeliveryProvider = {
  id: string;
  label: string;
  logoAllowed: boolean;
};

export const DELIVERY_PROVIDERS: DeliveryProvider[] = [
  { id: "dhl", label: "DHL", logoAllowed: false },
  { id: "deutsche-post", label: "Deutsche Post", logoAllowed: false },
  { id: "hermes", label: "Hermes", logoAllowed: false },
  { id: "dpd", label: "DPD", logoAllowed: false },
  { id: "gls", label: "GLS", logoAllowed: false },
  { id: "ups", label: "UPS", logoAllowed: false },
  { id: "fedex", label: "FedEx", logoAllowed: false },
  { id: "amazon", label: "Amazon-Lieferpartner", logoAllowed: false },
  { id: "kurier", label: "Kurierdienst", logoAllowed: false },
  { id: "regional", label: "Regionaler Paketdienst", logoAllowed: false },
  { id: "sonstige", label: "Sonstiger Anbieter", logoAllowed: false },
];

export function providerLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return DELIVERY_PROVIDERS.find((p) => p.id === id)?.label ?? null;
}
