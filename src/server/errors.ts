/**
 * Fachlicher Fehler mit einer für Menschen lesbaren Meldung.
 * Server Actions zeigen `message` im Formular an, die API gibt `code` und
 * `status` zurück. Alles andere ist ein unerwarteter Fehler.
 */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (message = "Nicht gefunden.") => new ServiceError("not_found", message, 404);
export const forbidden = (message = "Keine Berechtigung.") => new ServiceError("forbidden", message, 403);
export const rateLimited = () =>
  new ServiceError("rate_limited", "Zu viele Anfragen. Bitte kurz warten.", 429);

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
