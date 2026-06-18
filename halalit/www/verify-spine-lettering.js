#!/usr/bin/env node
/**
 * Sanity-check spine title slots vs visible title text (run from halalit/www).
 * Exit 0 when all samples pass; exit 1 on failure.
 */
/* eslint-disable no-console */
"use strict";

global.window = global;
global.document = {
  createElement: function () {
    return { getContext: function () { return null; } };
  },
};

require("./halalit-book-spine.js");

var Spine = global.HalalitBookSpine;
var SPINE_H_MAX = 460;
var LINE = 1.12;

var samples = [
  { title: "The Hobbit", author: "Tolkien" },
  { title: "Every Cloud Has a Silver Lining", author: "Anne Mazer" },
  { title: "Harry Potter and the Chamber of Secrets", author: "Rowling" },
  { title: "The Lion, the Witch and the Wardrobe", author: "C. S. Lewis" },
  { title: "Where the Mountain Meets the Moon", author: "Grace Lin" },
  { title: "A", author: "X" },
  { title: "The Lord of the Rings: The Fellowship of the Ring", author: "Tolkien" },
  {
    title: "First Book (Oliver Nocturne)",
    author: "Test Author",
    olPagesMedian: 88,
  },
];

function bookOf(s) {
  var b = {
    title: s.title,
    author: s.author,
    titlePlain: s.title + " by " + s.author,
  };
  if (typeof s.olPagesMedian === "number") b.olPagesMedian = s.olPagesMedian;
  return b;
}

function metricsFromHtml(html) {
  var title = (html.match(/bs-title-inner[^>]*>([^<]+)</) || [])[1] || "";
  var slotM = html.match(/class="bs-title" style="flex:0 0 (\d+)px;height:(\d+)px/);
  var spineHM = html.match(/--spine-h:(\d+)px/);
  var fsM = html.match(/font-size:([0-9.]+)px/);
  return {
    title: title,
    slot: slotM ? parseInt(slotM[1], 10) : 0,
    spineH: spineHM ? parseInt(spineHM[1], 10) : 0,
    fontSize: fsM ? parseFloat(fsM[1]) : 0,
  };
}

function minSlotForTitle(title, fontSize) {
  return Math.ceil(title.length * fontSize * LINE) + 8;
}

var failures = [];

for (var i = 0; i < samples.length; i++) {
  var book = bookOf(samples[i]);
  var html = Spine.buildSpineHtml(book, 34, 110);
  var m = metricsFromHtml(html);
  var need = minSlotForTitle(m.title, m.fontSize);
  if (m.slot < need) {
    failures.push(
      samples[i].title +
        ": slot " +
        m.slot +
        "px < need ~" +
        need +
        "px for \"" +
        m.title +
        "\""
    );
  }
  var spineWM = html.match(/--spine-w:(\d+)px/);
  var spineW = spineWM ? parseInt(spineWM[1], 10) : 0;
  var innerW = spineW - 6 - 4;
  var acrossNeed = Math.ceil(m.fontSize * 1.34 + 6) + 5;
  for (var ci = 0; ci < m.title.length; ci++) {
    var ch = m.title.charAt(ci);
    var wide = /[WMmw@%~()]/.test(ch) ? m.fontSize * 0.68 : m.fontSize * 0.5;
    if (wide + 5 > acrossNeed) acrossNeed = wide + 5;
  }
  if (innerW > 0 && acrossNeed > innerW) {
    failures.push(
      samples[i].title +
        ": spine too narrow (" +
        spineW +
        "px inner ~" +
        innerW +
        ", need ~" +
        Math.ceil(acrossNeed) +
        ")"
    );
  }
  if (m.slot < 12 || m.spineH < 96) {
    failures.push(samples[i].title + ": invalid spine dimensions");
  }
  var expected = Spine.compactSpineGlance(Spine.spineTitle(Spine.rawBookTitle(book)) || "");
  if (m.title !== expected) {
    failures.push(
      samples[i].title +
        ': title mismatch "' +
        m.title +
        '" vs expected "' +
        expected +
        '"'
    );
  }
  if (m.title.length < expected.length && m.spineH < SPINE_H_MAX - 2) {
    failures.push(
      samples[i].title +
        ": clipped before max spine height (" +
        m.spineH +
        "px)"
    );
  }
}

if (failures.length) {
  console.error("Spine lettering verify FAILED:\n" + failures.join("\n"));
  process.exit(1);
}

console.log("Spine lettering verify OK (" + samples.length + " samples).");
