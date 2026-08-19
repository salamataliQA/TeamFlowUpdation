import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { AssignmentsPage } from "./pages/AssignmentsPage.js";

bootTheme();

startAuthenticatedPage(() => {
  new AssignmentsPage("#app").init();
});
