import "./style.css";

// `page` is for a card that is the whole page: its title is the page's h1.
export default function Card({ title, page = false, children }) {
  const Heading = page ? "h1" : "h2";
  return (
    <section className="card">
      {title && <Heading className="card__title">{title}</Heading>}
      <div className="card__body">{children}</div>
    </section>
  );
}
