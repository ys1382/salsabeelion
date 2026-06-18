/**
 * LoreKeeper — sign up / sign in helpers.
 */
(function (global) {
  function apiBase() {
    return global.LoreKeeperAccountStorage ? global.LoreKeeperAccountStorage.apiBase() : "";
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    opts.credentials = "include";
    opts.headers = opts.headers || {};
    if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
    if (opts.body && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "bad_response" };
      });
    });
  }

  function friendlyError(code) {
    var map = {
      invalid_email: "That doesn’t look like an email address.",
      password_too_short: "Password needs at least 8 characters.",
      email_taken: "That email already has an account — try signing in.",
      invalid_credentials: "Email or password didn’t match.",
      bad_response: "Couldn’t reach LoreKeeper right now. Try again in a moment.",
      signups_disabled:
        "New accounts are paused — if you already created one, use Sign in.",
    };
    return map[code] || "Something went wrong. Try again.";
  }

  function signUp(email, password) {
    return fetchJson(apiBase() + "/auth/signup", {
      method: "POST",
      body: { email: email, password: password },
    });
  }

  function signIn(email, password) {
    return fetchJson(apiBase() + "/auth/login", {
      method: "POST",
      body: { email: email, password: password },
    });
  }

  function normalizeReturnUrl(returnUrl) {
    var url = returnUrl || "./index.html";
    if (url === "/lorekeeper/" || url === "/lorekeeper") return "./index.html";
    if (url.charAt(0) === "/" && url.indexOf("/lorekeeper") === 0) {
      var rest = url.slice("/lorekeeper".length).replace(/^\//, "");
      return rest ? "./" + rest : "./index.html";
    }
    return url;
  }

  function afterAuthSuccess(returnUrl) {
    var target = normalizeReturnUrl(returnUrl);
    global.location.replace(target);
    return Promise.resolve({ ok: true });
  }

  global.LoreKeeperAuth = {
    signUp: signUp,
    signIn: signIn,
    afterAuthSuccess: afterAuthSuccess,
    friendlyError: friendlyError,
    loadOwnerOffice: function () {
      return fetchJson(apiBase() + "/owner/office", { method: "GET" });
    },
    saveOwnerSettings: function (flags) {
      return fetchJson(apiBase() + "/owner/settings", {
        method: "POST",
        body: { flags: flags },
      });
    },
    submitFeedback: function (source, message, meta) {
      return fetchJson(apiBase() + "/feedback/submit", {
        method: "POST",
        body: { source: source, message: message, meta: meta || {} },
      });
    },
  };
})(typeof window !== "undefined" ? window : this);
