import "./style.css";

export default function Field({ label, name, error, hint, children }) {
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label className="field__label" htmlFor={name}>
        {label}
      </label>
      <div className="field__control">{children}</div>
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && <p className="field__error">{error}</p>}
    </div>
  );
}
