import "./style.css";

export default function Button({
  variant = "primary",
  type = "button",
  disabled = false,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`button button--${variant}`}
      {...rest}
    >
      {children}
    </button>
  );
}
