(function () {
  var timer = setTimeout(function () {
    var app = document.getElementById("app");
    if (!app || app.getAttribute("data-booted") === "1") return;
    app.setAttribute("aria-busy", "false");
    app.innerHTML =
      '<div class="empty card" style="margin:40px auto;max-width:560px">' +
      "<h3>This page did not finish loading</h3>" +
      "<p>Firebase Auth never completed on this site. Open <a href=\"/login\">sign in</a>, then add <strong>team-flow-updation.vercel.app</strong> under Firebase Authentication → Settings → Authorized domains. Also create a Cloud Firestore database for project <strong>teamflowupdation</strong>.</p>" +
      "</div>";
  }, 14000);
  window.__clearBootWatchdog = function () {
    clearTimeout(timer);
  };
})();
