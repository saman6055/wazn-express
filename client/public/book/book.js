/* waznexpress.com/book — the three things the page has to do.
   This file is separate because production runs no inline script. */
(function () {
  "use strict";

  /* ── 1 · one language at a time ───────────────────────────────── */
  var LANG_KEY = "wazn.book.lang";
  var bar = document.getElementById("lang");

  function setLang(lang, remember) {
    var ku = lang === "ku";
    document.body.classList.toggle("lang-ku", ku);
    document.documentElement.lang = ku ? "ckb" : "ar";
    var buttons = bar.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].dataset.lang === lang));
    }
    if (remember) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private window */ } }
  }

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-lang]");
    if (b) setLang(b.dataset.lang, true);
  });

  // A Kurdish reader who came back, or anyone whose phone asks for Kurdish.
  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* private window */ }
  if (!saved && /^(ckb|ku)\b/i.test(navigator.language || "")) saved = "ku";
  if (saved === "ku") setLang("ku", false);

  /* ── 2 · share the link ───────────────────────────────────────── */
  var toast = document.getElementById("toast");
  var toastTimer;

  function say() {
    toast.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("on"); }, 2200);
  }

  document.getElementById("share").addEventListener("click", function () {
    var url = location.origin + location.pathname;
    var data = { title: document.title, text: document.title, url: url };
    if (navigator.share) {
      navigator.share(data).catch(function () { /* the sheet was dismissed */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(say, function () { /* no permission */ });
    }
  });

  /* ── 3 · put Wazn on the phone's home screen ──────────────────────
     A link cannot install anything — only the browser can, and only on its
     own terms. Chrome on Android hands the page a prompt to keep and fire
     on a tap; Safari on iPhone never does, so there it is two taps by hand
     and the card says which two. This page is on waznexpress.com, so what
     installs is the portal itself, opening at the site root. */
  var section = document.getElementById("install");

  function state(s) { section.dataset.state = s; }

  // Chrome will not offer to install a site whose worker has no fetch
  // handler. The app registers /sw.js on its own pages; somebody who lands
  // straight on /book has never met it, so register it here too.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () { /* not fatal */ });
  }

  var waiting = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();          // keep it; we fire it on the tap instead
    waiting = e;
    state("ready");
  });

  document.getElementById("install-go").addEventListener("click", function () {
    if (!waiting) return;
    var prompt = waiting;
    waiting = null;
    prompt.prompt();
    prompt.userChoice.then(function (choice) {
      if (choice.outcome === "accepted") state("done");
      else state("idle");        // they said no; don't nag with a dead button
    });
  });

  window.addEventListener("appinstalled", function () { state("done"); });

  var standalone = window.matchMedia("(display-mode: standalone)").matches ||
                   window.navigator.standalone === true;
  var iphone = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
               (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (standalone) state("done");
  else if (iphone) state("ios");

  /* ── 4 · the text stays on the page ───────────────────────────────
     Casual copying is turned off: no selection, no long-press menu, no
     right-click, no drag, no Ctrl+C.  This stops a passer-by lifting the
     wording; it cannot stop a screenshot or "view source", and it is not
     meant to.  The phone and address are links, so they still work. */
  ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); });
  });
})();
