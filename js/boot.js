import { isAdmin, isMember, requireAuth } from "./auth.js";
import { handleError } from "./layout.js";
import { escapeHtml, pagePath } from "./utils.js";

export function markBooted() {
  const app = document.getElementById("app");
  if (app) {
    app.dataset.booted = "1";
    app.setAttribute("aria-busy", "false");
  }
  window.__clearBootWatchdog?.();
}

export function showBootError(error, title = "Page could not load") {
  markBooted();
  const app = document.querySelector("#app");
  if (!app) return;
  const code = error?.code || "";
  const message =
    error?.userSafe && error.message
      ? error.message
      : code === "permission-denied"
        ? "You don't have permission to load this page. Ask an admin to provision your profile."
        : "Unable to load this page. Add team-flow-updation.vercel.app to Firebase authorized domains, and create a Cloud Firestore database for project teamflowupdation.";
  app.innerHTML = `<div class="empty card" style="margin:40px auto;max-width:560px">
    <h3>${title}</h3>
    <p>${escapeHtml(message)}</p>
    <p><a class="btn" href="${pagePath("login.html")}">Back to sign in</a></p>
  </div>`;
  handleError(error, message);
}

export async function startAuthenticatedPage(load, { staff = false, admin = false } = {}) {
  try {
    const user = await requireAuth();
    if (admin && !isAdmin(user)) {
      window.location.replace(pagePath("dashboard.html"));
      return;
    }
    if (staff && isMember(user)) {
      window.location.replace(pagePath("dashboard.html"));
      return;
    }
    markBooted();
    await load(user);
  } catch (error) {
    if (error?.code === "auth-timeout") {
      markBooted();
      window.location.replace(`${pagePath("login.html")}?reason=auth-timeout`);
      return;
    }
    showBootError(error);
  }
}
