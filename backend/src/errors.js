export class AppError extends Error {
  constructor(status, message, { details, cause } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
    if (cause !== undefined) this.cause = cause;
  }
}

export const badRequest = (message, details) =>
  new AppError(400, message, { details });

// The request was syntactically valid JSON but a field failed schema
// validation (wrong type, bad format, missing required value).
export const unprocessable = (message, details) =>
  new AppError(422, message, { details });

export const unauthorized = (message) => new AppError(401, message);

export const forbidden = (message) => new AppError(403, message);

export const notFound = (message) => new AppError(404, message);

export const conflict = (message) => new AppError(409, message);

export const internalError = (message, cause) =>
  new AppError(500, message, { cause });
