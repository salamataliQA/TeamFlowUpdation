import { requireAdmin } from "./auth.js";
import { bootTheme } from "./layout.js";
import { SettingsPage } from "./pages/SettingsPage.js";

bootTheme();

async function main() {
  await requireAdmin();
  await new SettingsPage("#app").init();
}

main();
