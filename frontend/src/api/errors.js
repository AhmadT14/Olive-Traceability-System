import { ApiError } from "./client";

function sentence(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".");
}

// Zod flatten() gives { fieldErrors: { name: ["message"] } }.
function flatFieldErrors(details) {
  const fieldErrors = (details && details.fieldErrors) || {};
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([name, messages]) => [
      name,
      Array.isArray(messages) ? messages.join(", ") : String(messages),
    ]),
  );
}

function plain(message) {
  return { message, fieldErrors: {} };
}

// Turns API and wallet errors into { message, fieldErrors } for the UI.
export function readableError(err) {
  if (err && (err.code === 4001 || err.code === "ACTION_REJECTED")) {
    return plain("You rejected the request in MetaMask.");
  }
  if (err instanceof ApiError) {
    const text = sentence(err.message);
    switch (err.status) {
      case 400:
      case 422: {
        const fieldErrors = flatFieldErrors(err.details);
        return {
          message: Object.keys(fieldErrors).length
            ? "Some fields are not valid. Check the marked fields."
            : text,
          fieldErrors,
        };
      }
      case 401:
        return plain("Your session expired. Sign in again.");
      case 403:
        return plain(`You are not allowed to do this. ${text}`);
      case 404:
        return plain(`Not found. ${text}`);
      case 409:
        return plain(
          `This does not match the current state of the batch. ${text}`,
        );
      default:
        return plain(`The server had a problem. ${text}`);
    }
  }
  if (err && err.code === "CALL_EXCEPTION") {
    return plain(
      "The contract rejected the transaction. The batch may have changed, so reload and try again.",
    );
  }
  if (err instanceof TypeError) {
    return plain("Could not reach the server.");
  }
  return plain(
    sentence(
      (err && (err.shortMessage || err.message)) || "Something went wrong",
    ),
  );
}
