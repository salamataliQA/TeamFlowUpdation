import { isMember } from "./auth.js";
import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { MemberDashboardPage } from "./pages/MemberDashboardPage.js";

bootTheme();

startAuthenticatedPage(async (user) => {
  if (isMember(user)) new MemberDashboardPage("#app").init();
  else new DashboardPage("#app").init();
});
