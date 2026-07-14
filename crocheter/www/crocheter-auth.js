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
      signup_google_only: "New accounts use Google. Tap Continue with Google — or sign in with email if you already have a password account.",
      google_not_configured: "Google sign-in isn’t set up on the server yet.",
      google_auth_failed: "Google sign-in didn’t work. Try again.",
      google_email_conflict: "That Google account’s email is already linked to a different login.",
      reset_email_sent: "If that email has an account, we sent a reset link. Check your inbox (and junk folder).",
      reset_token_invalid: "That reset link is invalid or already used. Request a new one.",
      reset_token_expired: "That reset link expired. Request a new one.",
      rate_limited: "Too many tries. Wait a bit, then try again.",
    };
    return map[code] || "Something went wrong. Try again.";
  }

  function googleStartUrl(returnUrl) {
    var base = apiBase() + "/auth/google/start";
    if (returnUrl) {
      return base + "?return=" + encodeURIComponent(returnUrl);
    }
    return base;
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

  function requestPasswordReset(email) {
    return fetchJson(apiBase() + "/auth/forgot-password", {
      method: "POST",
      body: { email: email },
    });
  }

  function completePasswordReset(token, password) {
    return fetchJson(apiBase() + "/auth/reset-password", {
      method: "POST",
      body: { token: token, password: password },
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
    googleStartUrl: googleStartUrl,
    requestPasswordReset: requestPasswordReset,
    completePasswordReset: completePasswordReset,
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
