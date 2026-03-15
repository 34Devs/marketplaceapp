import { resolve } from "node:path";
import { createCookie } from "@remix-run/node";
import { RemixI18Next } from "remix-i18next/server";
import i18n from "./i18n";

export const i18nCookie = createCookie("i18n", {
  sameSite: "lax",
  path: "/",
});

const i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
    cookie: i18nCookie,
  },
  i18next: {
    ...i18n,
    backend: {
      loadPath: resolve("./app/i18n/locales/{{lng}}/{{ns}}.json"),
    },
  },
});

export default i18next;
