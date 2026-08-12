/**
 * LoreKeeper — Ask quality reference (Owner’s Office) + light owner Ask tips.
 * Tier A checkboxes retired — reliability comes from Ask engine + naming the work.
 */
(function (global) {
  function renderCheatSheet(root) {
    if (!root) return;
    root.innerHTML =
      "<table class='lk-playbook-table'>" +
      "<thead><tr><th>You ask</th><th>You should get</th><th>Intent</th></tr></thead>" +
      "<tbody>" +
      "<tr><td>Who is Ella?</td><td>Short cast card</td><td>who_is</td></tr>" +
      "<tr><td>What is Ella? / What kind of person…?</td><td>Portrait paragraphs</td><td>character_portrait</td></tr>" +
      "<tr><td>What is Ella’s role?</td><td>One role line</td><td>narrow facet</td></tr>" +
      "<tr><td>How are A and B related?</td><td>Relationship only</td><td>relationship</td></tr>" +
      "<tr><td>What does Elara know…?</td><td>POV knowledge</td><td>knowledge</td></tr>" +
      "<tr><td>Where did I leave off?</td><td>Latest draft state</td><td>story_resume</td></tr>" +
      "<tr><td>What have I got so far? / Catch me up</td><td>Cast, beats, open Qs, planned scraps</td><td>catchup_gather</td></tr>" +
      "<tr><td>What happens in the prologue?</td><td>Section summary</td><td>summarize_story</td></tr>" +
      "</tbody></table>" +
      "<p class='muted lk-playbook-table-note'>Repo reference: <code>LOREKEEPER-ASK-QUALITY-PLAYBOOK.md</code></p>";
  }

  function renderNoteStructureGuide(root) {
    if (!root) return;
    root.innerHTML =
      "<ul class='lk-playbook-list muted'>" +
      "<li><strong>Awareness notes</strong> — one short note per hard POV question: what they know <em>right now</em> (present tense), not future plans.</li>" +
      "<li><strong>Portrait notes</strong> — species, role, ties for “what is [name]?” — separate from planning/meta (“I wrote…”).</li>" +
      "<li><strong>Relationship entries</strong> for non-obvious ties (sibling, marriage, faction).</li>" +
      "<li><strong>Work tag</strong> on every note and document.</li>" +
      "<li><strong>Draft prose</strong> for scenes you expect Ask to summarize — scattered one-liners are hard to synthesize.</li>" +
      "<li><strong>Loose-end labels</strong> — <code>planned:</code> or <code>not drafted</code> for intentional gaps; <code>fix:</code> or <code>TODO fix</code> for contradictions to resolve; <code>draft only</code> when beats may change.</li>" +
      "</ul>" +
      "<p class='muted'><strong>Ask:</strong> <em>What's not written yet in [work]?</em> lists planned tags only. <em>What's flagged to fix?</em> lists fix tags. Canon audit skips planned notes.</p>" +
      "<p class='muted'>If portrait fails but you cannot find the name in your account in 30 seconds, fix notes before blaming the engine.</p>";
  }

  function initPhase0Office() {
    var mount = document.getElementById("phase0ChecklistMount");
    if (!mount || !global.LoreKeeperAccountStorage || !global.LoreKeeperAccountStorage.isOwner()) {
      return;
    }
    renderCheatSheet(document.getElementById("phase0CheatSheet"));
    renderNoteStructureGuide(document.getElementById("phase0NoteGuide"));
  }

  function initOwnerAskHints(beforeNode) {
    if (!beforeNode || !global.LoreKeeperAccountStorage) return;
    if (!global.LoreKeeperAccountStorage.isOwner()) return;
    if (
      beforeNode.previousElementSibling &&
      beforeNode.previousElementSibling.classList.contains("lk-tier-a-hints")
    ) {
      return;
    }
    var box = document.createElement("p");
    box.className = "lk-tier-a-hints muted";
    box.innerHTML =
      "For best Ask results: wait for <strong>Saved</strong>, name the work, and use <strong>It got this wrong</strong> when something fails. " +
      '<a href="./office.html">Owner’s Office</a> has a short question cheat sheet.';
    beforeNode.parentNode.insertBefore(box, beforeNode);
  }

  global.LoreKeeperTierA = {
    initPhase0Office: initPhase0Office,
    initOwnerAskHints: initOwnerAskHints,
  };
})(typeof window !== "undefined" ? window : this);
