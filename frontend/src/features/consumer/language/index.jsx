import { useLayoutEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { TEXT as en } from "../strings";
import { TEXT as ar } from "../strings.ar";
import { LanguageContext } from "./useLanguage";

const KEY = "olive_language";
const TEXTS = { en, ar };

// The saved choice, else Arabic for a browser set to Arabic, else English.
function firstLanguage() {
  try {
    const saved = localStorage.getItem(KEY);
    if (TEXTS[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

// Language of the public pages (the routes inside it). It sets the document's
// language and direction while they are open, and puts them back on leaving,
// because the pages behind sign in are only in English for now.
export default function PublicLanguage() {
  const [language, setChosen] = useState(firstLanguage);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const title = document.title;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    document.title = TEXTS[language].brand;
    return () => {
      root.lang = "en";
      root.dir = "ltr";
      document.title = title;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      text: TEXTS[language],
      setLanguage: (next) => {
        setChosen(next);
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* storage unavailable */
        }
      },
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      <Outlet />
    </LanguageContext.Provider>
  );
}
