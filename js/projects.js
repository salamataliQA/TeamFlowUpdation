import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";

bootTheme();

startAuthenticatedPage(() => {
  new ProjectsPage("#app").init();
}, { staff: true });
