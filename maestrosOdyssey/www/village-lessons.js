/* Three typed lessons. Hover stays for lessons 1 and 2. Lesson 3 has no gloss.
   Spanish and Turkish: hold a key for the other letter shape.
   Japanese: tap kana. A long-press cannot write those letters. */
(function () {
  function line(say, words, ask, accept, answer) {
    var row = { say: say, words: words, ask: ask, accept: accept };
    if (answer) row.answer = answer;
    return row;
  }

  var DAYS = [
    {
      name: "Monday", where: "The street", shot: "street", lesson: 1, hover: true,
      place: "A neighbor meets you on the street.",
      hint: true,
      beats: [
        {
          who: "A neighbor says",
          es: line("Buenos días.", [["Buenos", "Good"], ["días", "morning"]], "Say good morning.", ["buenos días"]),
          ja: line("おはよう。", [["おはよう", "good morning"]], "Say good morning.", ["おはよう"]),
          tr: line("Günaydın.", [["Günaydın", "Good morning"]], "Say good morning.", ["günaydın"])
        },
        {
          es: line("Hola. ¿Cómo estás?", [["Hola", "Hello"], ["Cómo", "How"], ["estás", "are you"]], "Say that you are well.", ["bien", "estoy bien"], { say: "Bien.", words: [["Bien", "well"]] }),
          ja: line("こんにちは。げんきですか。", [["こんにちは", "hello"], ["げんき", "well"], ["です", "are"], ["か", "question"]], "Say that you are well.", ["げんきです"], { say: "げんきです。", words: [["げんき", "well"], ["です", "am"]] }),
          tr: line("Merhaba. Nasılsın?", [["Merhaba", "Hello"], ["Nasılsın", "How are you"]], "Say that you are well.", ["iyiyim"], { say: "İyiyim.", words: [["İyiyim", "I am well"]] })
        }
      ]
    },
    {
      name: "Tuesday", where: "The shore", shot: "shore", lesson: 1, hover: true,
      place: "The same neighbor is down by the water.",
      beats: [
        {
          who: "A neighbor says",
          es: line("Buenos días.", [["Buenos", "Good"], ["días", "morning"]], "Ask how they are.", ["cómo estás"], { say: "¿Cómo estás?", words: [["Cómo", "How"], ["estás", "are you"]] }),
          ja: line("おはよう。", [["おはよう", "good morning"]], "Ask how they are.", ["げんきですか"], { say: "げんきですか。", words: [["げんき", "well"], ["です", "are"], ["か", "question"]] }),
          tr: line("Günaydın.", [["Günaydın", "Good morning"]], "Ask how they are.", ["nasılsın"], { say: "Nasılsın?", words: [["Nasılsın", "How are you"]] })
        },
        {
          es: line("Bien.", [["Bien", "well"]], "Say thank you.", ["gracias"], { say: "Gracias.", words: [["Gracias", "Thank you"]] }),
          ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "Say thank you.", ["ありがとう"], { say: "ありがとう。", words: [["ありがとう", "thank you"]] }),
          tr: line("İyiyim.", [["İyiyim", "I am well"]], "Say thank you.", ["teşekkürler"], { say: "Teşekkürler.", words: [["Teşekkürler", "Thank you"]] })
        },
        {
          es: line("Hasta mañana.", [["Hasta", "Until"], ["mañana", "tomorrow"]], "Say see you tomorrow.", ["hasta mañana"]),
          ja: line("またあした。", [["また", "again"], ["あした", "tomorrow"]], "Say see you tomorrow.", ["またあした"]),
          tr: line("Yarın görüşürüz.", [["Yarın", "Tomorrow"], ["görüşürüz", "we will see each other"]], "Say see you tomorrow.", ["yarın görüşürüz"])
        }
      ]
    },
    {
      name: "Wednesday", where: "The shop", shot: "shop", lesson: 2, hover: true,
      place: "Bread is on the counter.",
      beats: [
        {
          who: "The shopkeeper says",
          es: line("Me gusta el pan.", [["Me", "Me"], ["gusta", "likes"], ["el", "the"], ["pan", "bread"]], "Say that you like the bread.", ["me gusta el pan"]),
          ja: line("パンがすきです。", [["パン", "bread"], ["が", "as for"], ["すき", "like"], ["です", "is"]], "Say that you like the bread.", ["パンがすきです"]),
          tr: line("Ekmeği seviyorum.", [["Ekmeği", "The bread"], ["seviyorum", "I like"]], "Say that you like the bread.", ["ekmeği seviyorum"])
        },
        {
          lead: "A darker loaf sits to the side.",
          es: line("No me gusta el pan.", [["No", "Not"], ["me", "me"], ["gusta", "likes"], ["el", "the"], ["pan", "bread"]], "Say that you don't like the bread.", ["no me gusta el pan"]),
          ja: line("パンがすきじゃないです。", [["パン", "bread"], ["が", "as for"], ["すき", "like"], ["じゃない", "not"], ["です", "is"]], "Say that you don't like the bread.", ["パンがすきじゃないです"]),
          tr: line("Ekmeği sevmiyorum.", [["Ekmeği", "The bread"], ["sevmiyorum", "I don't like"]], "Say that you don't like the bread.", ["ekmeği sevmiyorum"])
        }
      ]
    },
    {
      name: "Thursday", where: "The shop", shot: "shop", lesson: 2, hover: true,
      place: "Tea is on the counter.",
      beats: [
        {
          who: "The shopkeeper says",
          es: line("¿Te gusta el té?", [["Te", "You"], ["gusta", "like"], ["el", "the"], ["té", "tea"]], "Say that you don't like the tea.", ["no me gusta el té"]),
          ja: line("おちゃがすきですか。", [["おちゃ", "tea"], ["が", "as for"], ["すき", "like"], ["です", "is"], ["か", "question"]], "Say that you don't like the tea.", ["おちゃがすきじゃないです"]),
          tr: line("Çayı seviyor musun?", [["Çayı", "The tea"], ["seviyor musun", "do you like"]], "Say that you don't like the tea.", ["çayı sevmiyorum"])
        }
      ]
    },
    {
      name: "Friday", where: "The street", shot: "street", lesson: 3, hover: false,
      place: "The sun is out. No word shows its English now.",
      beats: [
        {
          who: "A neighbor says",
          es: line("Hola. ¿Cómo estás?", [["Hola", ""], ["Cómo", ""], ["estás", ""]], "", ["bien", "estoy bien", "hola bien"]),
          ja: line("こんにちは。げんきですか。", [["こんにちは", ""], ["げんき", ""], ["です", ""], ["か", ""]], "", ["げんきです"]),
          tr: line("Merhaba. Nasılsın?", [["Merhaba", ""], ["Nasılsın", ""]], "", ["iyiyim"])
        },
        {
          es: line("¿Te gusta el sol?", [["Te", ""], ["gusta", ""], ["el", ""], ["sol", ""]], "", ["me gusta el sol", "no me gusta el sol"]),
          ja: line("ひがすきですか。", [["ひ", ""], ["が", ""], ["すき", ""], ["です", ""], ["か", ""]], "", ["ひがすきです", "ひがすきじゃないです"]),
          tr: line("Güneşi seviyor musun?", [["Güneşi", ""], ["seviyor musun", ""]], "", ["güneşi seviyorum", "güneşi sevmiyorum"])
        }
      ]
    },
    {
      name: "Saturday", where: "The shop", shot: "shop", lesson: 3, hover: false,
      place: "A cup of coffee is on the counter.",
      beats: [
        {
          who: "The shopkeeper says",
          es: line("¿Te gusta el café?", [["Te", ""], ["gusta", ""], ["el", ""], ["café", ""]], "", ["me gusta el café", "no me gusta el café"]),
          ja: line("コーヒーがすきですか。", [["コーヒー", ""], ["が", ""], ["すき", ""], ["です", ""], ["か", ""]], "", ["コーヒーがすきです", "コーヒーがすきじゃないです"]),
          tr: line("Kahveyi seviyor musun?", [["Kahveyi", ""], ["seviyor musun", ""]], "", ["kahveyi seviyorum", "kahveyi sevmiyorum"])
        },
        {
          es: line("Hasta mañana.", [["Hasta", ""], ["mañana", ""]], "", ["hasta mañana"]),
          ja: line("またね。", [["またね", ""]], "", ["またね", "またあした"]),
          tr: line("Görüşürüz.", [["Görüşürüz", ""]], "", ["görüşürüz", "yarın görüşürüz"])
        }
      ]
    },
    {
      name: "Sunday", where: "The station", shot: "station", lesson: 0, hover: false,
      place: "The train is waiting. You are not leaving on it today.",
      beats: [
        {
          who: "A traveler says",
          es: line("¿Te gusta el tren?", [["Te", ""], ["gusta", ""], ["el", ""], ["tren", ""]], "", ["me gusta el tren", "no me gusta el tren"]),
          ja: line("でんしゃがすきですか。", [["でんしゃ", ""], ["が", ""], ["すき", ""], ["です", ""], ["か", ""]], "", ["でんしゃがすきです", "でんしゃがすきじゃないです"]),
          tr: line("Treni seviyor musun?", [["Treni", ""], ["seviyor musun", ""]], "", ["treni seviyorum", "treni sevmiyorum"])
        },
        { walk: true }
      ]
    }
  ];

  var HOLDS = {
    es: { a: ["á"], e: ["é"], i: ["í"], o: ["ó"], u: ["ú", "ü"], n: ["ñ"], "?": ["¿"], "!": ["¡"] },
    tr: { c: ["ç"], g: ["ğ"], i: ["ı", "İ"], o: ["ö"], s: ["ş"], u: ["ü"] }
  };

  var ROMAJI = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo", "ん": "n",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "di", "づ": "du", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "っ": "small tsu",
    "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
    "カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
    "サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
    "タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
    "ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
    "ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
    "マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
    "ヤ": "ya", "ユ": "yu", "ヨ": "yo",
    "ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
    "ワ": "wa", "ヲ": "wo", "ン": "n",
    "ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
    "ー": "long", "パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po"
  };

  function api() {
    return window.MOVillage;
  }

  function progress() {
    var lesson = api().state.lesson;
    if (!lesson || typeof lesson.day !== "number") {
      lesson = { day: 0, step: 0 };
      api().state.lesson = lesson;
    }
    if (lesson.day < 0) lesson.day = 0;
    if (lesson.day > DAYS.length - 1) lesson.day = DAYS.length - 1;
    if (typeof lesson.step !== "number" || lesson.step < 0) lesson.step = 0;
    var day = DAYS[lesson.day];
    if (day && lesson.step >= day.beats.length) lesson.step = day.beats.length - 1;
    if (!lesson.replies) lesson.replies = [];
    return lesson;
  }

  function pack() {
    return api().langPack();
  }

  function norm(lang, text) {
    var s = String(text || "").trim();
    if (lang === "ja") return s.replace(/[\s。、？！?!.]/g, "");
    s = s.replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();
    if (lang === "tr") return s.replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR");
    return s.toLowerCase();
  }

  function foldClose(lang, text) {
    var s = norm(lang, text);
    if (lang === "ja") return s;
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lang === "tr") s = s.replace(/ı/g, "i");
    return s;
  }

  function grade(lang, typed, accept) {
    var got = norm(lang, typed);
    var i;
    if (!got) return { ok: false, empty: true };
    for (i = 0; i < accept.length; i++) {
      if (got === norm(lang, accept[i])) return { ok: true };
    }
    var closeTo = "";
    for (i = 0; i < accept.length; i++) {
      if (foldClose(lang, typed) === foldClose(lang, accept[i])) {
        closeTo = accept[i];
        break;
      }
    }
    if (closeTo) return { ok: false, letter: firstSpecial(lang, closeTo, typed) };
    if (lang === "ja" && /[a-zA-Z]/.test(typed)) return { ok: false, kana: true };
    return { ok: false };
  }

  function firstSpecial(lang, expected, typed) {
    var exp = norm(lang, expected);
    var got = norm(lang, typed);
    var i;
    var ch;
    var holds = HOLDS[lang] || {};
    for (i = 0; i < exp.length; i++) {
      ch = exp.charAt(i);
      if (got.indexOf(ch) !== -1) continue;
      var key;
      for (key in holds) {
        if (holds[key].indexOf(ch) !== -1) return { key: key, ch: ch, options: holds[key] };
      }
    }
    return null;
  }

  function kanaNeeded(upToDay, upToStep) {
    var seen = {};
    var order = [];
    var d;
    var b;
    var text;
    var c;
    var day;
    var beat;
    function add(str) {
      var n;
      for (n = 0; n < str.length; n++) {
        c = str.charAt(n);
        if (!ROMAJI[c] || seen[c]) continue;
        seen[c] = 1;
        order.push(c);
      }
    }
    for (d = 0; d <= upToDay && d < DAYS.length; d++) {
      day = DAYS[d];
      for (b = 0; b < day.beats.length; b++) {
        if (d === upToDay && b > upToStep) break;
        beat = day.beats[b];
        if (!beat.ja) continue;
        text = beat.ja.say + " " + (beat.ja.accept || []).join("");
        add(text);
      }
    }
    return order;
  }

  function missText(day, result) {
    if (result.empty) return "Type the words.";
    if (result.kana) return "Tap the letters below.";
    if (result.letter) {
      var opt = result.letter.options.join(" or ");
      return "Hold " + result.letter.key + " to write " + opt + ".";
    }
    if (day.lesson === 3 || day.lesson === 0) return "Not yet. Use what you already know.";
    return "Not yet. Use their words.";
  }

  function shotName(shot) {
    var who = api().state.gender === "boy" ? "boy" : "girl";
    if (shot === "station" || shot === "elder") return shot + "-" + who;
    return shot;
  }

  function paintLine(speech, say, words, hover) {
    var rest = say;
    function plain(text) {
      var span = document.createElement("span");
      span.className = "plain";
      span.textContent = text;
      speech.appendChild(span);
    }
    words.forEach(function (pair) {
      var at = rest.indexOf(pair[0]);
      if (at < 0) at = 0;
      if (at > 0) plain(rest.slice(0, at));
      var word = document.createElement("span");
      word.className = "word";
      var face = document.createElement("span");
      face.className = "face";
      face.textContent = pair[0];
      word.appendChild(face);
      if (hover && pair[1]) {
        var gloss = document.createElement("span");
        gloss.className = "gloss";
        gloss.textContent = pair[1];
        word.appendChild(gloss);
      }
      speech.appendChild(word);
      rest = rest.slice(at + pair[0].length);
    });
    if (rest) plain(rest);
  }

  function speak(text) {
    var voicePack = pack();
    api().stopVoice();
    if (!window.speechSynthesis) return;
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = voicePack.voice || "en-US";
    utter.rate = 0.86;
    window.speechSynthesis.speak(utter);
  }

  function advance(said) {
    var lesson = progress();
    var day = DAYS[lesson.day];
    if (!lesson.replies) lesson.replies = [];
    lesson.replies[lesson.step] = said;
    lesson.step += 1;
    if (lesson.step >= day.beats.length) {
      lesson.day += 1;
      lesson.step = 0;
      lesson.replies = [];
    }
    if (lesson.day >= DAYS.length) lesson.day = DAYS.length - 1;
    api().writeSave();
    render();
  }

  function nextLanguage() {
    var langs = window.VILLAGE_LANGS || [{ id: "es" }];
    var state = api().state;
    state.langIndex = ((state.langIndex || 0) + 1) % langs.length;
    state.lesson = { day: 0, step: 0, replies: [] };
    state.scene = "lessons";
    api().writeSave();
    render();
  }

  function render() {
    var page = api();
    if (!page) return;
    var lesson = progress();
    var day = DAYS[lesson.day];
    var beat = day.beats[lesson.step] || day.beats[day.beats.length - 1];
    var voicePack = pack();
    var lang = voicePack.id;
    page.dayEl.textContent = day.name + " · " + day.where + " · " + voicePack.name + (day.lesson ? " · Lesson " + day.lesson : "");
    document.title = day.name + " · " + day.where + " — Maestro's Odyssey";
    page.pictureEl.hidden = false;
    page.pictureEl.alt = day.place;
    page.pictureEl.src = page.artUrl(shotName(day.shot));
    page.proseEl.replaceChildren();
    var place = document.createElement("p");
    place.textContent = page.fill(day.place);
    page.proseEl.appendChild(place);
    if (day.hint && lesson.step === 0) {
      var tip = document.createElement("p");
      tip.className = "letter-hint";
      tip.textContent = lang === "ja"
        ? "Tap the letters. The small mark under each one is its roman key."
        : "Hold a key when the letter needs another shape.";
      page.proseEl.appendChild(tip);
    }
    page.choicesEl.replaceChildren();
    function addLead(text) {
      if (!text) return;
      var lead = document.createElement("p");
      lead.className = "talk-lead";
      lead.textContent = text;
      page.proseEl.appendChild(lead);
    }
    function addSpeaker(text) {
      if (!text) return;
      var who = document.createElement("p");
      who.className = "speaker";
      who.textContent = text;
      page.proseEl.appendChild(who);
    }
    function addSpeech(lineData, withHear) {
      var speech = document.createElement("p");
      speech.className = "speech" + (day.hover ? "" : " no-hover");
      speech.lang = voicePack.voice || "";
      paintLine(speech, lineData.say, lineData.words, day.hover);
      if (withHear) {
        var hear = document.createElement("span");
        hear.className = "hear";
        hear.tabIndex = 0;
        hear.setAttribute("role", "button");
        hear.textContent = "Hear";
        hear.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          speak(lineData.say);
        });
        speech.appendChild(document.createTextNode(" "));
        speech.appendChild(hear);
      }
      page.proseEl.appendChild(speech);
    }
    function addYou(text) {
      if (!text) return;
      var row = document.createElement("p");
      row.className = "you-line";
      var who = document.createElement("span");
      who.className = "you-who";
      who.textContent = "You";
      var said = document.createElement("span");
      said.className = "you-said";
      said.textContent = text;
      row.appendChild(who);
      row.appendChild(said);
      page.proseEl.appendChild(row);
    }
    var i;
    for (i = 0; i < lesson.step; i++) {
      var past = day.beats[i];
      if (!past || past.walk) continue;
      var pastLine = past[lang] || past.es;
      if (!pastLine) continue;
      addLead(past.lead);
      if (i === 0) addSpeaker(past.who);
      addSpeech(pastLine, false);
      addYou((lesson.replies && lesson.replies[i]) || (pastLine.accept && pastLine.accept[0]) || "");
    }
    if (beat.walk) {
      var stay = document.createElement("p");
      stay.textContent = "You stay on the platform. The next walk is the same days, in the next language.";
      page.proseEl.appendChild(stay);
      var again = document.createElement("button");
      again.type = "button";
      again.textContent = "Walk these days again.";
      again.addEventListener("click", nextLanguage);
      page.choicesEl.appendChild(again);
      return;
    }
    var lineData = beat[lang] || beat.es;
    addLead(beat.lead);
    if (lesson.step === 0) addSpeaker(beat.who);
    addSpeech(lineData, true);

    var form = document.createElement("form");
    form.className = "reply";
    if (lineData.ask) {
      var ask = document.createElement("p");
      ask.className = "reply-ask";
      ask.textContent = lineData.ask;
      form.appendChild(ask);
    }
    if (day.hover && lineData.answer) {
      var model = document.createElement("p");
      model.className = "speech you-model";
      model.lang = voicePack.voice || "";
      paintLine(model, lineData.answer.say, lineData.answer.words, true);
      form.appendChild(model);
    }
    var input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", lineData.ask || "Your reply");
    form.appendChild(input);
    var note = document.createElement("p");
    note.className = "reply-note";
    note.hidden = true;
    form.appendChild(note);
    var holdPop = document.createElement("div");
    holdPop.className = "hold-pop";
    holdPop.hidden = true;
    form.appendChild(holdPop);

    if (lang === "ja") {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Backspace" || event.key === "Enter") return;
        if (event.key.length === 1) event.preventDefault();
      });
      var board = document.createElement("div");
      board.className = "kana-board";
      kanaNeeded(lesson.day, lesson.step).forEach(function (ch) {
        var key = document.createElement("button");
        key.type = "button";
        key.className = "kana-key";
        var big = document.createElement("b");
        big.textContent = ch;
        var small = document.createElement("small");
        small.textContent = ROMAJI[ch] || "";
        key.appendChild(big);
        key.appendChild(small);
        key.addEventListener("click", function () {
          insertAt(input, ch);
          input.focus();
        });
        board.appendChild(key);
      });
      var back = document.createElement("button");
      back.type = "button";
      back.className = "kana-key";
      back.textContent = "Delete";
      back.addEventListener("click", function () {
        input.value = input.value.slice(0, -1);
        input.focus();
      });
      board.appendChild(back);
      form.appendChild(board);
    } else {
      wireHold(input, holdPop, lang);
    }

    var submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Say it";
    form.appendChild(submit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var result = grade(lang, input.value, lineData.accept);
      if (result.ok) {
        advance(input.value.trim());
        return;
      }
      note.hidden = false;
      note.textContent = missText(day, result);
      if (result.letter) {
        showHoldChoices(holdPop, result.letter.options, function (ch) {
          insertCaret(input, ch);
          holdPop.hidden = true;
          input.focus();
        });
      }
    });
    page.choicesEl.appendChild(form);
    input.focus();
  }

  function insertAt(input, ch) {
    var start = input.selectionStart;
    var end = input.selectionEnd;
    if (typeof start !== "number") {
      input.value += ch;
      return;
    }
    input.value = input.value.slice(0, start) + ch + input.value.slice(end);
    var next = start + ch.length;
    input.setSelectionRange(next, next);
  }

  function insertCaret(input, ch) {
    var start = input.selectionStart;
    var end = input.selectionEnd;
    if (typeof start !== "number") {
      input.value += ch;
      return;
    }
    if (end > start) start = end;
    input.value = input.value.slice(0, start) + ch + input.value.slice(start);
    var next = start + ch.length;
    input.setSelectionRange(next, next);
  }

  function showHoldChoices(pop, options, onPick) {
    pop.hidden = false;
    pop.replaceChildren();
    options.forEach(function (ch) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = ch;
      button.addEventListener("mousedown", function (event) {
        event.preventDefault();
      });
      button.addEventListener("click", function () {
        onPick(ch);
      });
      pop.appendChild(button);
    });
  }

  function wireHold(input, pop, lang) {
    var holds = HOLDS[lang] || {};
    var timer = 0;
    var held = "";
    var opened = false;
    var saved = null;
    var applying = false;
    var landedAt = 0;

    function remember() {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      saved = {
        value: input.value,
        start: typeof start === "number" ? start : input.value.length,
        end: typeof end === "number" ? end : input.value.length
      };
    }

    function putBack() {
      if (!saved) return;
      input.value = saved.value;
      try {
        input.setSelectionRange(saved.start, saved.start);
      } catch (err) {}
    }

    function closePop() {
      pop.hidden = true;
      opened = false;
      if (timer) clearTimeout(timer);
      timer = 0;
      held = "";
    }

    function guarding() {
      return !!held || pop.hidden === false;
    }

    function settling() {
      return Date.now() - landedAt < 250;
    }

    function placeAccent(ch) {
      if (!ch || applying) return;
      if (Date.now() - landedAt < 250) return;
      applying = true;
      var start = saved ? saved.start : (typeof input.selectionStart === "number" ? input.selectionStart : input.value.length);
      var value = saved ? saved.value : input.value;
      input.value = value.slice(0, start) + ch + value.slice(start);
      var next = start + ch.length;
      try { input.setSelectionRange(next, next); } catch (err) {}
      saved = { value: input.value, start: next, end: next };
      applying = false;
      landedAt = Date.now();
      closePop();
      input.focus();
    }

    function keepWord(event) {
      if (applying || !saved) return;
      var open = guarding();
      var settle = settling();
      if (!open && !settle) return;
      if (input.value === saved.value) return;
      if (settle && !open && input.value.length >= saved.value.length) return;
      var data = (event && event.data) || "";
      var chars = Array.from(data);
      putBack();
      if (open && chars.length === 1 && data !== held && !settle) placeAccent(data);
    }

    input.addEventListener("beforeinput", function (event) {
      var open = guarding();
      var settle = settling();
      if (applying || (!open && !settle)) return;
      var type = event.inputType || "";
      var systemEdit = type === "insertReplacementText" || type === "insertCompositionText" || type.indexOf("delete") === 0 || (!!held && type === "insertText");
      if (!systemEdit) return;
      event.preventDefault();
      var data = event.data || "";
      if (open && !settle && data && Array.from(data).length === 1 && data !== held && type.indexOf("delete") !== 0) placeAccent(data);
    }, true);

    input.addEventListener("input", keepWord);
    input.addEventListener("compositionend", keepWord, true);

    input.addEventListener("keydown", function (event) {
      var key = event.key;
      if (pop.hidden === false && key >= "1" && key <= "9") {
        var buttons = pop.querySelectorAll("button");
        var pick = buttons[Number(key) - 1];
        if (pick) {
          event.preventDefault();
          pick.click();
        }
        return;
      }
      if (event.key === "Escape" && pop.hidden === false) {
        event.preventDefault();
        putBack();
        closePop();
        return;
      }
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      var options = holds[key];
      if (!options) {
        if (pop.hidden === false) {
          pop.hidden = true;
          opened = false;
        }
        return;
      }
      event.preventDefault();
      held = key;
      opened = false;
      remember();
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        opened = true;
        showHoldChoices(pop, options, placeAccent);
      }, 450);
    });

    input.addEventListener("keyup", function (event) {
      if (event.key !== held) return;
      if (timer) clearTimeout(timer);
      timer = 0;
      var key = event.key;
      if (!opened) {
        held = "";
        putBack();
        insertAt(input, key);
        remember();
        return;
      }
      if (saved && input.value !== saved.value) putBack();
      held = "";
    });

    input.addEventListener("blur", function () {
      if (timer) clearTimeout(timer);
      timer = 0;
      if (!opened) held = "";
    });
  }

  window.MOLessons = {
    render: render,
    grade: grade
  };
})();
