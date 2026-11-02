import { createContext, useContext } from "react";
import { TEXT } from "../strings";

// Outside PublicLanguage (the other pages) everything stays in English, and
// there is no language switcher.
export const LanguageContext = createContext({
  language: "en",
  text: TEXT,
  setLanguage: null,
});

export function useLanguage() {
  return useContext(LanguageContext);
}
