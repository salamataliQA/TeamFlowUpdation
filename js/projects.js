import { requireStaff } from "./auth.js";
import { bootTheme } from "./layout.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";

bootTheme();

async function main() {
  await requireStaff();
  new ProjectsPage("#app").init();
}

main();
