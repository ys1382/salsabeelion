/**
 * Crocheter — sign up / sign in helpers for account.html
 */
(function (global) {
  function apiBase() {
    return global.CrocheterAccountStorage ? global.CrocheterAccountStorage.apiBase() : "";
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
      bad_response: "Couldn’t reach the site right now. Try again in a moment.",
      signups_disabled: "New accounts are paused right now. You can still sign in if you already have one.",
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

  function afterAuthSuccess(returnUrl) {
    var Store = global.CrocheterAccountStorage;
    if (!Store) {
      global.location.href = returnUrl || "./index.html";
      return Promise.resolve();
    }
    return Store.refreshSession().then(function () {
      return Store.migrateFromDevice();
    }).then(function () {
      global.location.href = returnUrl || "./index.html";
    });
  }

  global.CrocheterAuth = {
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
