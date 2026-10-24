import "./style.css";

export default function Card({ title, children }) {
  return (
    <section className="card">
      {title && <h2 className="card__title">{title}</h2>}
      <div className="card__body">{children}</div>
    </section>
  );
}
