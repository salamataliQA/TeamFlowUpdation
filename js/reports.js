import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { ReportsPage } from "./pages/ReportsPage.js";

bootTheme();

startAuthenticatedPage(() => {
  new ReportsPage("#app").init();
});
