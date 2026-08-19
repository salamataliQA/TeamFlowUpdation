import { BOOTSTRAP_ADMIN_EMAIL } from "./firebase-config.js";
import { login, redirectIfLoggedIn, resetPassword, ACCOUNT_INACTIVE_MESSAGE } from "./auth.js";
import { showToast } from "./components.js";
import { applyTheme, getStoredTheme, pagePath, refreshIcons, setButtonLoading } from "./utils.js";

applyTheme(getStoredTheme());
redirectIfLoggedIn();
refreshIcons();

const form = document.querySelector("#login-form");
const resetBtn = document.querySelector("#forgot-btn");

const loginReason = new URLSearchParams(location.search).get("reason");
if (loginReason === "inactive") {
  const banner = document.querySelector("#inactive-banner");
  if (banner) banner.hidden = false;
}
if (loginReason === "auth-timeout" || loginReason === "unauthorized-domain") {
  const banner = document.querySelector("#setup-banner");
  if (banner) banner.hidden = false;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  const button = form.querySelector("button[type=submit]");
  setButtonLoading(button, true, "Signing in...");
  try {
    await login(email, password);
    window.location.href = pagePath("dashboard.html");
  } catch (error) {
    if (error.code === "account-inactive") {
      const banner = document.querySelector("#inactive-banner");
      if (banner) banner.hidden = false;
      showToast(ACCOUNT_INACTIVE_MESSAGE, "error");
      return;
    }
    const map = {
      "auth/invalid-credential": "Invalid email or password.",
      "auth/user-not-found": "No account found for that email.",
      "auth/wrong-password": "Invalid email or password.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/configuration-not-found":
        "Firebase Authentication is not fully enabled for this site. Enable Email/Password and add this Vercel domain under Authentication → Settings → Authorized domains.",
      "auth/unauthorized-domain":
        "This Vercel URL is not in Firebase authorized domains. Add it under Authentication → Settings → Authorized domains.",
      "auth/operation-not-allowed": "Email/Password sign-in is disabled in Firebase Authentication.",
      "auth/invalid-api-key": "Firebase API key is invalid.",
      "auth/network-request-failed": "Network error. Check your connection and try again.",
    };
    showToast(map[error.code] || "Unable to sign in.", "error");
    console.error(error);
  } finally {
    setButtonLoading(button, false);
  }
});

resetBtn?.addEventListener("click", async () => {
  const email = form.email.value.trim();
  if (!email) return showToast("Enter your email first.", "warning");
  try {
    await resetPassword(email);
    showToast("Password reset email sent.", "info");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#fill-admin")?.addEventListener("click", () => {
  form.email.value = BOOTSTRAP_ADMIN_EMAIL;
  form.password.focus();
});
