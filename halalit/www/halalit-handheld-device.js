/**
 * Halalit — detect phones/tablets (handheld cameras) vs computers/laptops.
 */
(function (global) {
  function isHandheld() {
    if (!global.matchMedia) return false;
    var touch = global.navigator && global.navigator.maxTouchPoints > 0;
    if (!touch) return false;
    var fineHover = global.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (fineHover) return false;
    var coarse = global.matchMedia("(pointer: coarse)").matches;
    var anyCoarse = global.matchMedia("(any-pointer: coarse)").matches;
    if (coarse || anyCoarse) return true;
    return global.matchMedia("(max-width: 900px)").matches;
  }

  global.HalalitHandheldDevice = {
    isHandheld: isHandheld,
  };
})(typeof window !== "undefined" ? window : this);
