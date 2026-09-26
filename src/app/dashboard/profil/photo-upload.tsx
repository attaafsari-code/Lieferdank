"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { removePhotoAction, setPhotoPublicAction, uploadPhotoAction } from "@/server/actions/driver";

type Props = { name: string; initials: string; photoUrl: string | null; photoPublic: boolean };

/**
 * Verkleinert das Foto im Browser auf max. 640 px, bevor es hochgeladen wird.
 * Nebeneffekt, der gewollt ist: Dabei gehen alle Metadaten verloren – auch der
 * GPS-Standort, den Handykameras oft ins Bild schreiben.
 */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 640;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht verarbeitet werden"))), "image/jpeg", 0.86),
  );
}

export function PhotoUpload({ name, initials, photoUrl, photoPublic }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await resizeImage(file);
        const data = new FormData();
        data.set("photo", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        const result = await uploadPhotoAction({}, data);
        if (result.error || result.fieldErrors) {
          setError(result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Upload fehlgeschlagen.");
        }
      } catch {
        setError("Dieses Bild konnte nicht gelesen werden. Bitte ein JPG oder PNG wählen.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <Avatar name={name} initials={initials} photoUrl={photoUrl} size="xl" />

      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className="btn btn-primary btn-sm">
            {pending ? "Wird hochgeladen …" : photoUrl ? "Foto ändern" : "Foto hochladen"}
          </button>
          {photoUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => removePhotoAction())}
              className="btn btn-ghost btn-sm"
            >
              Entfernen
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0])}
        />

        {photoUrl ? (
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="sr-only">Sichtbarkeit des Fotos</legend>
            <label className="flex cursor-pointer items-center gap-2 font-medium text-ink">
              <input
                type="radio"
                name="photoVisibility"
                checked={photoPublic}
                onChange={() => startTransition(() => setPhotoPublicAction(true))}
                className="h-4 w-4 accent-[color:var(--color-brand)]"
              />
              Öffentlich
            </label>
            <label className="flex cursor-pointer items-center gap-2 font-medium text-ink">
              <input
                type="radio"
                name="photoVisibility"
                checked={!photoPublic}
                onChange={() => startTransition(() => setPhotoPublicAction(false))}
                className="h-4 w-4 accent-[color:var(--color-brand)]"
              />
              Nur im Dashboard
            </label>
          </fieldset>
        ) : (
          <p className="text-sm text-ink-soft">Ohne Foto zeigen wir einen Avatar mit deinen Initialen.</p>
        )}
        <p className="text-xs text-ink-faint">JPG, PNG oder WebP. Standortdaten werden beim Hochladen entfernt.</p>
        {error && (
          <p role="alert" className="error-text !mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
