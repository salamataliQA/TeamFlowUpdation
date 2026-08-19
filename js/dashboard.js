import { requireAuth, isMember } from "./auth.js";
import { bootTheme, handleError } from "./layout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { MemberDashboardPage } from "./pages/MemberDashboardPage.js";

bootTheme();

function showBootError(error) {
  const app = document.querySelector("#app");
  if (!app) return;
  const message = error?.code === "permission-denied"
    ? "You don't have permission to load this page. Ask an admin to provision your profile."
    : "Unable to load the dashboard. If you just signed in, make sure Firestore is created and this Vercel domain is in Firebase authorized domains.";
  app.innerHTML = `<div class="empty card" style="margin:40px auto;max-width:520px">
    <h3>Dashboard could not load</h3>
    <p>${message}</p>
    <p><a class="btn" href="/login">Back to sign in</a></p>
  </div>`;
  handleError(error, message);
}

async function main() {
  try {
    const user = await requireAuth();
    if (isMember(user)) new MemberDashboardPage("#app").init();
    else new DashboardPage("#app").init();
  } catch (error) {
    showBootError(error);
  }
}

main();
