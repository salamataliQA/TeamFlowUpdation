import { requireAuth } from "./auth.js";
import { bootTheme } from "./layout.js";
import { AssignmentsPage } from "./pages/AssignmentsPage.js";

bootTheme();

async function main() {
  await requireAuth();
  new AssignmentsPage("#app").init();
}

main();
