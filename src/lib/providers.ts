/**
 * Liefer- und Zustelldienste. Ausschließlich Text, keine fremden Logos –
 * `logoAllowed` bleibt false, bis es eine Kooperation gibt.
 */
export type DeliveryProvider = {
  id: string;
  label: string;
  group: "paket" | "essen" | "kurier";
  logoAllowed: boolean;
};

export const DELIVERY_PROVIDERS: DeliveryProvider[] = [
  { id: "dhl", label: "DHL", group: "paket", logoAllowed: false },
  { id: "deutsche-post", label: "Deutsche Post", group: "paket", logoAllowed: false },
  { id: "hermes", label: "Hermes", group: "paket", logoAllowed: false },
  { id: "dpd", label: "DPD", group: "paket", logoAllowed: false },
  { id: "gls", label: "GLS", group: "paket", logoAllowed: false },
  { id: "ups", label: "UPS", group: "paket", logoAllowed: false },
  { id: "fedex", label: "FedEx", group: "paket", logoAllowed: false },
  { id: "amazon", label: "Amazon-Lieferpartner", group: "paket", logoAllowed: false },
  { id: "lieferando", label: "Lieferando", group: "essen", logoAllowed: false },
  { id: "wolt", label: "Wolt", group: "essen", logoAllowed: false },
  { id: "uber-eats", label: "Uber Eats", group: "essen", logoAllowed: false },
  { id: "flink", label: "Flink", group: "essen", logoAllowed: false },
  { id: "restaurant", label: "Restaurant-Lieferdienst", group: "essen", logoAllowed: false },
  { id: "kurier", label: "Kurierdienst", group: "kurier", logoAllowed: false },
  { id: "regional", label: "Regionaler Lieferdienst", group: "kurier", logoAllowed: false },
  { id: "sonstige", label: "Sonstiger Anbieter", group: "kurier", logoAllowed: false },
];

export const PROVIDER_GROUP_LABELS: Record<DeliveryProvider["group"], string> = {
  paket: "Pakete",
  essen: "Essen & Lebensmittel",
  kurier: "Kurier & Sonstige",
};

export function providerLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return DELIVERY_PROVIDERS.find((p) => p.id === id)?.label ?? null;
}
