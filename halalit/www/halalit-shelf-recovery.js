/**
 * Halalit — scan this browser for shelf copies and restore to account / primary key.
 */
(function (global) {
  var SHELF_KEY = "halalitAlreadyReadBooks";
  var BACKUP_KEY = "halalitAlreadyReadBooks_device_backup";
  var SHELF_SOURCES = [SHELF_KEY, BACKUP_KEY, "halalitWantToReadBooks"];

  function readRaw(key) {
    try {
      if (global.localStorage) return global.localStorage.getItem(key);
    } catch (e) {}
    return null;
  }

  function countBooks(raw) {
    if (!raw) return 0;
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    } catch (e) {
      return 0;
    }
  }

  function scanHalalitKeys() {
    var out = [];
    if (!global.localStorage) return out;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf("halalit") !== 0) continue;
        var raw = global.localStorage.getItem(k);
        out.push({
          key: k,
          bytes: raw ? raw.length : 0,
          books: k === SHELF_KEY || k === BACKUP_KEY ? countBooks(raw) : null,
        });
      }
    } catch (e) {}
    out.sort(function (a, b) {
      return (b.books || 0) - (a.books || 0) || b.bytes - a.bytes;
    });
    return out;
  }

  function accountBookCount() {
    var Store = global.HalalitAccountStorage;
    if (!Store || !Store.isSignedIn()) return 0;
    return countBooks(Store.getItem(SHELF_KEY));
  }

  function bestDeviceShelfRaw() {
    var primary = readRaw(SHELF_KEY);
    if (countBooks(primary) > 0) return { key: SHELF_KEY, raw: primary };
    var backup = readRaw(BACKUP_KEY);
    if (countBooks(backup) > 0) return { key: BACKUP_KEY, raw: backup };
    return null;
  }

  function restoreBestDeviceShelf() {
    var best = bestDeviceShelfRaw();
    if (!best) return Promise.resolve({ ok: false, error: "no_device_shelf" });
    var Store = global.HalalitAccountStorage;
    if (!Store) return Promise.resolve({ ok: false, error: "no_storage" });
    try {
      if (global.localStorage) global.localStorage.setItem(SHELF_KEY, best.raw);
      global.localStorage.setItem(BACKUP_KEY, best.raw);
    } catch (e) {}
    Store.setItem(SHELF_KEY, best.raw);
    if (Store.flush) Store.flush();
    return (Store.migrateFromDevice ? Store.migrateFromDevice() : Promise.resolve(true)).then(function () {
      return { ok: true, books: countBooks(best.raw), from: best.key };
    });
  }

  global.HalalitShelfRecovery = {
    scanHalalitKeys: scanHalalitKeys,
    accountBookCount: accountBookCount,
    bestDeviceShelfRaw: bestDeviceShelfRaw,
    restoreBestDeviceShelf: restoreBestDeviceShelf,
    countBooks: countBooks,
    SHELF_KEY: SHELF_KEY,
    BACKUP_KEY: BACKUP_KEY,
  };
})(typeof window !== "undefined" ? window : this);
