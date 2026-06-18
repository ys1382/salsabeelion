/**
 * Halalit — approved theme lists (static). Not Goodreads data.
 * Add entries when you trust a list or your own research.
 *
 * themes — use ids from halalit-shelf-themes.js, e.g.:
 *   lgbtq, adult_romance, sexual_content, romantic_tension,
 *   illegitimate_children, romanticized_crime, teen_ya_age,
 *   violence_intense, family_portrayed_negatively, cultural_stereotype, group_demonization,
 *   pro_colonial_narrative, deity_mythology, graphic_format, substance
 *
 * tier (optional): flag_review | caution — defaults from theme ids if omitted
 */
(function (global) {
  /**
   * @type {Array<{
   *   titleRe: RegExp,
   *   authorRe?: RegExp,
   *   themes: string[],
   *   detail: string,
   *   listName: string
   * }>}
   */
  global.HalalitThemeIndexData = [
    /* Example shape — replace or add real rows you approve:
    {
      titleRe: /\bexample title\b/i,
      authorRe: /author last/i,
      themes: ["lgbtq"],
      detail: "On Halalit’s approved theme list “Middle-grade LGBTQ mentions”: side character storyline.",
      listName: "Halalit approved list (example)",
    },
    */
  ];
})(typeof window !== "undefined" ? window : this);
