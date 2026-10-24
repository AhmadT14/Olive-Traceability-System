import { Link } from "react-router-dom";
import "./style.css";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1 className="not-found__title">Page not found</h1>
      <p>The page you asked for does not exist.</p>
      <Link to="/">Back to home</Link>
    </main>
  );
}
