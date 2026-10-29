# Logo und Markenbild

Verbindliche Quelle ist das Original `assets/brand/lieferdank-logo-original.png`
(Bildmarke mit Paket, Klebestreifen und Herz, Schriftzug „Lieferdank“, Claim).
Alle Logo-Dateien werden daraus mit `python3 -I scripts/brand/generate_brand_assets.py`
abgeleitet – nichts wird nachgezeichnet oder umgefärbt:

| Datei | Verwendung |
|---|---|
| `apps/driver/assets/brand-mark-approved.png` | freigegebener Ausschnitt der Bildmarke (App-Kopf, Splash) |
| `public/brand/lieferdank-mark.png`, `-wordmark.png`, `-tagline.png` | Website (Kopf, Fuß, Fehler-, Danke-, Zahlungsseiten) |
| `apps/driver/assets/brand-wordmark.png` | Schriftzug im App-Kopf |
| `src/lib/brand/logo-images.ts` | eingebettete Fassung für Karten (alle Layouts, SVG/PNG/Druck) |
| `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `public/pwa/*` | Web-Icons, PWA-Icons und iOS-Startbilder aus dem App-Icon bzw. Original |
| `src/app/opengraph-image.png`, `public/brand/checkout-logo.png` | Link-Vorschau und Stripe Checkout |

Der weiße Hintergrund wird rechnerisch entfernt; über Weiß ergibt jede Datei die
Originalpixel (geprüft in `tests/brand-logo.test.ts`). Auf Karten mit Farbfläche
steht das Logo auf einer weißen Fläche, weil das Original für Weiß gestaltet ist.

Das ®-Zeichen des Originals ist bewusst nicht übernommen: Es darf nur für eine
eingetragene Marke verwendet werden. Ist „Lieferdank“ eingetragen, kann es in
`scripts/brand/generate_brand_assets.py` (REGISTERED_BOX) wieder aufgenommen werden.
