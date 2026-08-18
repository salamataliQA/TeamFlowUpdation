import { requireAuth, isMember } from "./auth.js";
import { bootTheme } from "./layout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { MemberDashboardPage } from "./pages/MemberDashboardPage.js";

bootTheme();

async function main() {
  const user = await requireAuth();
  if (isMember(user)) new MemberDashboardPage("#app").init();
  else new DashboardPage("#app").init();
}

main();
