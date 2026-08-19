import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { SettingsPage } from "./pages/SettingsPage.js";

bootTheme();

startAuthenticatedPage(async () => {
  await new SettingsPage("#app").init();
}, { admin: true });
