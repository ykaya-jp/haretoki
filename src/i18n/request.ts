import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

// For the initial scaffold we lock the active locale to Japanese. Future work
// will resolve the locale from cookie/header/user-preference and pick the
// matching message bundle.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: (await import(`./messages/ja.json`)).default,
}));
