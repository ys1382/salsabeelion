/**
 * Halalit — detect phones and tablets (handheld cameras), not desktop/laptop browsers.
 */
(function (global) {
  function isHandheld() {
    try {
      var coarse = global.matchMedia("(pointer: coarse)").matches;
      var noHover = global.matchMedia("(hover: none)").matches;
      if (coarse && noHover) return true;

      var ua = String(global.navigator && global.navigator.userAgent ? global.navigator.userAgent : "");
      if (/iPhone|iPod|Android/i.test(ua)) return true;
      if (/iPad/i.test(ua)) return true;
      if (global.navigator && global.navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
    } catch (e) {}
    return false;
  }

  global.HalalitHandheld = {
    isHandheld: isHandheld,
  };
})(typeof window !== "undefined" ? window : this);
