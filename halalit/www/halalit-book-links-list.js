/**
 * Owner-only Book Links List — titles and authors, with a checkbox per line.
 * Edits save to the owner account. Until the first edit, the starter list stays in code.
 * Not shown to other accounts.
 */
(function (global) {
  var STORAGE_KEY = "halalitBookLinksList";
  var LEGACY_CHECKS_KEY = "halalitBookLinksChecked";

  var KIDS = [
    ["A Little Snow Fairy Sugar", "Haruka Aoi"],
    ["Alice's Adventures in Wonderland and Through the Looking-Glass", "Lewis Carroll"],
    ["Are You My Mother?", "P.D. Eastman"],
    ["Bartholomew and the Oobleck", "Dr. Seuss"],
    ["Beezus and Ramona", "Beverly Cleary"],
    ["Berenstain Bears", "Stan and Jan Berenstain"],
    ["The Berenstain Bears and the Messy Room", "Stan and Jan Berenstain"],
    ["Brown Bear, Brown Bear, What Do You See?", "Bill Martin Jr. and Eric Carle"],
    ["Castle Glower", "Jessica Day George"],
    ["Charlotte's Web", "E.B. White"],
    ["Chicka Chicka Boom Boom", "Bill Martin Jr. and John Archambault"],
    ["Clifford the Big Red Dog", "Norman Bridwell"],
    ["Cloudy with a Chance of Meatballs", "Judi Barrett"],
    ["Curious George", "H.A. and Margret Rey"],
    ["Don't Let the Pigeon Drive the Bus", "Mo Willems"],
    ["Dr. Seuss batch, King's Stilts through Butter Battle Book", "Dr. Seuss"],
    ["Dr. Seuss's Sleep Book", "Dr. Seuss"],
    ["Edgar and Allan Poe", "Gordon McAlpine"],
    ["Fortunately, the Milk", "Neil Gaiman"],
    ["Fox in Socks", "Dr. Seuss"],
    ["Geronimo Stilton series", "Geronimo Stilton"],
    ["Goodnight Moon", "Margaret Wise Brown"],
    ["Green Eggs and Ham", "Dr. Seuss"],
    ["Guess How Much I Love You", "Sam McBratney"],
    ["Happy Happy Clover", "Sayuri Tatsuyama"],
    ["Harold and the Purple Crayon", "Crockett Johnson"],
    ["Heidi", "Johanna Spyri"],
    ["Henry Huggins", "Beverly Cleary"],
    ["Hop on Pop", "Dr. Seuss"],
    ["Horton Hears a Who!", "Dr. Seuss"],
    ["If I Ran the Circus", "Dr. Seuss"],
    ["If I Ran the Zoo", "Dr. Seuss"],
    ["James and the Giant Peach", "Roald Dahl"],
    ["Love You Forever", "Robert Munsch"],
    ["Matilda", "Roald Dahl"],
    ["Oh, the Places You'll Go!", "Dr. Seuss"],
    ["One Fish Two Fish Red Fish Blue Fish", "Dr. Seuss"],
    ["Ramona Quimby", "Beverly Cleary"],
    ["Ribsy", "Beverly Cleary"],
    ["Squire & Knight", "Scott Chantler"],
    ["The 500 Hats of Bartholomew Cubbins", "Dr. Seuss"],
    ["The BFG", "Roald Dahl"],
    ["The Cat in the Hat", "Dr. Seuss"],
    ["The Cat in the Hat Comes Back", "Dr. Seuss"],
    ["The Enormous Crocodile", "Roald Dahl"],
    ["The Fancy Nancy series", "Jane O'Connor"],
    ["The Giraffe and the Pelly and Me", "Roald Dahl"],
    ["The Giving Tree and Where the Sidewalk Ends", "Shel Silverstein"],
    ["The Little Engine That Could", "Watty Piper"],
    ["The Lorax", "Dr. Seuss"],
    ["The Magic Finger", "Roald Dahl"],
    ["The Magic School Bus (original series)", "Joanna Cole"],
    ["The Rainbow Fish", "Marcus Pfister"],
    ["The Sneetches and Other Stories", "Dr. Seuss"],
    ["The Twits", "Roald Dahl"],
    ["The Very Busy Spider", "Eric Carle"],
    ["The Very Hungry Caterpillar", "Eric Carle"],
    ["The Witches", "Roald Dahl"],
    ["Tidesong", "Wendy Xu"],
    ["Unicorn School", "Linda Chapman"],
    ["Where the Wild Things Are", "Maurice Sendak"],
    ["Where's Spot?", "Eric Hill"],
    ["Winnie-the-Pooh", "A.A. Milne"],
    ["Yertle the Turtle and Other Stories", "Dr. Seuss"],
  ];

  var MORE = [
    ["Dragons in a Bag", "Zetta Elliott"],
    ["Fablehaven", "Brandon Mull"],
    ["Manatee Summer", "Evan Griffith"],
    ["Mrs. Smith's Spy School for Girls", "Beth McMullen"],
    ["Piper McCloud", "Victoria Forester"],
    ["Savvy", "Ingrid Law"],
    ["Seekers of the Wild Realm", "Alexandra Ott"],
    ["Snow and Rose", "Emily Winfield Martin"],
    ["Spark", "Sarah Beth Durst"],
    ["Spark", "Chris Baron"],
    ["The Gilded Girl duology", "Alyssa Colman"],
    ["The Girl and the Witch's Garden", "Erin Bowman"],
    ["The Girl Who Drank the Moon", "Kelly Barnhill"],
    ["The Girl with the Silver Eyes", "Willo Davis Roberts"],
    ["The Graveyard Book", "Neil Gaiman"],
    ["Coraline", "Neil Gaiman"],
    ["The Land of Roar", "Jenny McLachlan"],
    ["The Last Bear", "Hannah Gold"],
    ["The Prince of Nowhere", "Rochelle Hassan"],
    ["The Rose Legacy", "Jessica Day George"],
    ["The Two Princesses of Bamarre", "Gail Carson Levine"],
    ["The Unicorn Quest trilogy", "Kamilla Benko"],
    ["The Unwanteds", "Lisa McMann"],
    ["The Wolf Princess", "Cathryn Constable"],
    ["Wild Rescuers", "StacyPlays"],
    ["Wing & Claw", "Linda Sue Park"],
    ["Ameena's Ramadan Diary", "Sara Kabil"],
    ["Green Deen", "Ibrahim Abdul-Matin"],
    ["Happily for Now", "Kelly Jones"],
    ["The Call of the Wild", "Jack London"],
    ["This Changes Everything", "Naomi Klein"],
    ["White Fang", "Jack London"],
    ["Wonder Light / Unicorns of the Mist", "R.R. Russell"],
    ["To Kill a Mockingbird", "Harper Lee"],
    ["Bioluminescence", "Marc Zimmer"],
    ["Book Scavenger", "Jennifer Chambliss Bertman"],
    ["Brown Girl Dreaming", "Jacqueline Woodson"],
    ["Half Moon Investigations", "Eoin Colfer"],
  ];

  function checkKey(title, author) {
    return String(title) + "\n" + String(author || "");
  }

  function newId() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function readRaw() {
    var Store = global.HalalitAccountStorage;
    if (Store && typeof Store.getItem === "function") {
      var fromAccount = Store.getItem(STORAGE_KEY);
      if (fromAccount) return fromAccount;
    }
    try {
      return global.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function legacyChecks() {
    try {
      var raw = global.localStorage.getItem(LEGACY_CHECKS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function packRows(rows, group, prefix, checks) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var title = rows[i][0];
      var author = rows[i][1] || "";
      out.push({
        id: prefix + i,
        title: title,
        author: author,
        group: group,
        checked: !!checks[checkKey(title, author)],
      });
    }
    return out;
  }

  function starterLines(checks) {
    return packRows(KIDS, "kids", "k", checks).concat(packRows(MORE, "more", "m", checks));
  }

  function cleanLine(raw) {
    if (!raw || typeof raw !== "object") return null;
    var title = String(raw.title || "").trim();
    if (!title) return null;
    var group = raw.group === "kids" ? "kids" : "more";
    return {
      id: String(raw.id || newId()),
      title: title,
      author: String(raw.author || "").trim(),
      group: group,
      checked: !!raw.checked,
    };
  }

  function loadState() {
    var doc = null;
    try {
      var raw = readRaw();
      doc = raw ? JSON.parse(raw) : null;
    } catch (e) {
      doc = null;
    }
    if (doc && doc.custom && Array.isArray(doc.lines)) {
      var lines = [];
      for (var i = 0; i < doc.lines.length; i++) {
        var line = cleanLine(doc.lines[i]);
        if (line) lines.push(line);
      }
      return { custom: true, lines: lines };
    }
    var checks = {};
    if (doc && doc.checks && typeof doc.checks === "object") {
      checks = doc.checks;
    } else {
      checks = legacyChecks();
    }
    return { custom: false, lines: starterLines(checks) };
  }

  function persist(state) {
    var doc;
    if (state.custom) {
      doc = {
        custom: true,
        lines: state.lines.map(function (line) {
          return {
            id: line.id,
            title: line.title,
            author: line.author,
            group: line.group,
            checked: !!line.checked,
          };
        }),
      };
    } else {
      var checks = {};
      state.lines.forEach(function (line) {
        if (line.checked) checks[checkKey(line.title, line.author)] = true;
      });
      doc = { custom: false, checks: checks };
    }
    var text = JSON.stringify(doc);
    var Store = global.HalalitAccountStorage;
    if (Store && typeof Store.isSignedIn === "function" && Store.isSignedIn() && typeof Store.setItem === "function") {
      Store.setItem(STORAGE_KEY, text);
      return;
    }
    try {
      global.localStorage.setItem(STORAGE_KEY, text);
    } catch (e) {}
  }

  function lineLabel(line) {
    return line.author ? line.title + " — " + line.author : line.title;
  }

  function findLine(state, id) {
    for (var i = 0; i < state.lines.length; i++) {
      if (state.lines[i].id === id) return state.lines[i];
    }
    return null;
  }

  function rowHtml(line, editingId) {
    var checked = line.checked ? " checked" : "";
    var box =
      '<input type="checkbox" data-book-links-id="' +
      escapeHtml(line.id) +
      '" aria-label="' +
      escapeHtml(lineLabel(line)) +
      '"' +
      checked +
      " />";
    if (editingId === line.id) {
      return (
        '<div class="book-links-row book-links-row--edit" data-id="' +
        escapeHtml(line.id) +
        '">' +
        '<div class="book-links-edit">' +
        '<label>Title <input type="text" data-field="title" value="' +
        escapeHtml(line.title) +
        '" /></label>' +
        '<label>Author <input type="text" data-field="author" value="' +
        escapeHtml(line.author) +
        '" /></label>' +
        '<div class="book-links-edit-actions">' +
        '<button type="button" class="import-btn" data-action="save">Save</button>' +
        '<button type="button" class="book-links-textbtn" data-action="remove">Remove</button>' +
        '<button type="button" class="book-links-textbtn" data-action="cancel">Cancel</button>' +
        "</div></div>" +
        box +
        "</div>"
      );
    }
    return (
      '<div class="book-links-row" data-id="' +
      escapeHtml(line.id) +
      '">' +
      '<div class="book-links-main">' +
      '<span class="book-links-line">' +
      escapeHtml(lineLabel(line)) +
      "</span>" +
      '<button type="button" class="book-links-textbtn" data-action="edit">Edit</button>' +
      "</div>" +
      box +
      "</div>"
    );
  }

  function sectionHtml(heading, lines, editingId) {
    if (!lines.length) return "";
    var html = '<h3 class="book-links-heading">' + escapeHtml(heading) + "</h3>";
    for (var i = 0; i < lines.length; i++) html += rowHtml(lines[i], editingId);
    return html;
  }

  function addHtml(adding) {
    if (!adding) {
      return (
        '<div class="book-links-add">' +
        '<button type="button" class="book-links-textbtn" data-action="add-open">Add a book</button>' +
        "</div>"
      );
    }
    return (
      '<div class="book-links-add">' +
      "<label>Title <input type=\"text\" data-add-field=\"title\" /></label>" +
      "<label>Author <input type=\"text\" data-add-field=\"author\" /></label>" +
      '<div class="book-links-add-actions">' +
      '<button type="button" class="import-btn" data-action="add-save">Add</button>' +
      '<button type="button" class="book-links-textbtn" data-action="add-cancel">Cancel</button>' +
      "</div></div>"
    );
  }

  function render(root, state) {
    var kids = [];
    var more = [];
    for (var i = 0; i < state.lines.length; i++) {
      if (state.lines[i].group === "kids") kids.push(state.lines[i]);
      else more.push(state.lines[i]);
    }
    root.innerHTML =
      sectionHtml("Kids", kids, state.editingId) +
      sectionHtml("Also on this list", more, state.editingId) +
      addHtml(state.adding);
    var focus = null;
    if (state.editingId) focus = root.querySelector('.book-links-row--edit input[data-field="title"]');
    else if (state.adding) focus = root.querySelector('input[data-add-field="title"]');
    if (focus && typeof focus.focus === "function") focus.focus();
  }

  function mount(root) {
    if (!root || root.getAttribute("data-book-links-ready") === "1") return;
    root.setAttribute("data-book-links-ready", "1");
    var loaded = loadState();
    var state = {
      custom: loaded.custom,
      lines: loaded.lines,
      editingId: null,
      adding: false,
    };
    render(root, state);

    root.addEventListener("change", function (ev) {
      var input = ev.target;
      if (!input || input.type !== "checkbox") return;
      var id = input.getAttribute("data-book-links-id");
      var line = findLine(state, id);
      if (!line) return;
      line.checked = !!input.checked;
      persist(state);
    });

    root.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
      if (!btn || !root.contains(btn)) return;
      var action = btn.getAttribute("data-action");
      var row = btn.closest ? btn.closest("[data-id]") : null;
      var id = row ? row.getAttribute("data-id") : "";

      if (action === "edit") {
        state.adding = false;
        state.editingId = id;
        render(root, state);
        return;
      }
      if (action === "cancel") {
        state.editingId = null;
        render(root, state);
        return;
      }
      if (action === "remove") {
        state.lines = state.lines.filter(function (line) {
          return line.id !== id;
        });
        state.custom = true;
        state.editingId = null;
        persist(state);
        render(root, state);
        return;
      }
      if (action === "save") {
        var titleInput = row.querySelector('[data-field="title"]');
        var authorInput = row.querySelector('[data-field="author"]');
        var title = titleInput ? String(titleInput.value || "").trim() : "";
        if (!title) {
          if (titleInput) titleInput.focus();
          return;
        }
        var line = findLine(state, id);
        if (!line) return;
        line.title = title;
        line.author = authorInput ? String(authorInput.value || "").trim() : "";
        state.custom = true;
        state.editingId = null;
        persist(state);
        render(root, state);
        return;
      }
      if (action === "add-open") {
        state.editingId = null;
        state.adding = true;
        render(root, state);
        return;
      }
      if (action === "add-cancel") {
        state.adding = false;
        render(root, state);
        return;
      }
      if (action === "add-save") {
        var addTitle = root.querySelector('[data-add-field="title"]');
        var addAuthor = root.querySelector('[data-add-field="author"]');
        var nextTitle = addTitle ? String(addTitle.value || "").trim() : "";
        if (!nextTitle) {
          if (addTitle) addTitle.focus();
          return;
        }
        state.lines.push({
          id: newId(),
          title: nextTitle,
          author: addAuthor ? String(addAuthor.value || "").trim() : "",
          group: "more",
          checked: false,
        });
        state.custom = true;
        state.adding = false;
        persist(state);
        render(root, state);
      }
    });
  }

  global.HalalitBookLinksList = {
    mount: mount,
  };
})(typeof window !== "undefined" ? window : this);
