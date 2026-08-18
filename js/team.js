import { requireStaff } from "./auth.js";
import { bootTheme } from "./layout.js";
import { TeamPage } from "./pages/TeamPage.js";

bootTheme();

async function main() {
  await requireStaff();
  new TeamPage("#app").init();
}

main();
