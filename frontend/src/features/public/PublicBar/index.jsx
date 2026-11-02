import { Link } from "react-router-dom";
import { useLanguage } from "../../consumer/language/useLanguage";
import { useAccountLink } from "../useAccountLink";
import "./style.css";

// Top bar of the pages outside the app shell. The site name links to /. Pages
// with an Arabic version also get the language switcher.
export default function PublicBar({ showAccount = false }) {
  const account = useAccountLink();
  const { text: TEXT, setLanguage } = useLanguage();
  return (
    <header className="public-bar">
      <Link to="/" className="public-bar__brand">
        {TEXT.brand}
      </Link>
      <div className="public-bar__actions">
        {setLanguage && (
          <button
            type="button"
            className="public-bar__language"
            lang={TEXT.switchLanguage}
            onClick={() => setLanguage(TEXT.switchLanguage)}
          >
            {TEXT.switchTo}
          </button>
        )}
        {showAccount && (
          <Link to={account.to} className="public-bar__account">
            {account.label}
          </Link>
        )}
      </div>
    </header>
  );
}
