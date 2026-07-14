#!/usr/bin/env node
/** LoreKeeper — validate font catalog de-dupe rules (#3). */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "../www/lk-font-catalog.js");
const code = fs.readFileSync(catalogPath, "utf8");
const sandbox = { window: {}, console };
vm.runInNewContext(code, sandbox);
const cat = sandbox.window.LoreKeeperFontCatalog;
if (!cat || typeof cat.validate !== "function") {
  console.error("LoreKeeperFontCatalog.validate missing");
  process.exit(1);
}
const report = cat.validate();
const picker = cat.pickerFonts();
console.log("Fonts in catalog:", cat.FONTS.length);
console.log("Picker voices (deduped):", picker.length);
if (report.warnings.length) {
  console.warn("Warnings:");
  report.warnings.forEach(function (w) {
    console.warn("  -", w);
  });
}
if (!report.ok) {
  console.error("Errors:");
  report.errors.forEach(function (e) {
    console.error("  -", e);
  });
  process.exit(1);
}
console.log("Font catalog OK.");
