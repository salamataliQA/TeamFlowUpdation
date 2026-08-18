import { requireAuth, isMember } from "./auth.js";
import { bootTheme } from "./layout.js";
import { ReportsPage } from "./pages/ReportsPage.js";

bootTheme();

async function main() {
  await requireAuth();
  new ReportsPage("#app").init();
}

main();
void isMember;
