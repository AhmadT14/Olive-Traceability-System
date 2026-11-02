import { Link } from "react-router-dom";
import { TEXT } from "../../consumer/strings";
import { useAccountLink } from "../useAccountLink";
import "./style.css";

// Top bar of the pages outside the app shell. The site name links to /.
export default function PublicBar({ showAccount = false }) {
  const account = useAccountLink();
  return (
    <header className="public-bar">
      <Link to="/" className="public-bar__brand">
        {TEXT.brand}
      </Link>
      {showAccount && (
        <Link to={account.to} className="public-bar__account">
          {account.label}
        </Link>
      )}
    </header>
  );
}
