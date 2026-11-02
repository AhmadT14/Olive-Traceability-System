import { readableError } from "../../api";
import Button from "../Button";
import "./style.css";

export function Loading({ text = "Loading" }) {
  return (
    <p className="state state--loading" role="status">
      {text}...
    </p>
  );
}

export function EmptyState({ children }) {
  return <p className="state state--empty">{children}</p>;
}

// Trying again cannot change these answers.
const NO_RETRY = [401, 403, 404];

export function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  const { message } = readableError(error);
  return (
    <div className="state state--error" role="alert">
      <span>{message}</span>
      {onRetry && !NO_RETRY.includes(error.status) && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
