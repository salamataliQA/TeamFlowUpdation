import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { TeamPage } from "./pages/TeamPage.js";

bootTheme();

startAuthenticatedPage(() => {
  new TeamPage("#app").init();
}, { staff: true });
