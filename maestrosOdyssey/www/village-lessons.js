/* Three typed lessons. Hover stays for lessons 1 and 2. Lesson 3 has no gloss.
   A corner phrasebook lists pieces, not the whole reply. Look, then type or speak.
   No line tells them what to say. Any phrase they know can move the talk.
   A missing accent still counts. What they said changes the next line.
   Each person has a name. The label stays "a neighbor" until you ask it.
   After that, later lines use the name. Spanish and Turkish: hold a key
   for the other letter shape. Japanese: tap kana. A long-press cannot
   write those letters. */
(function () {
  function line(say, words, ask, accept, answer) {
    var row = { say: say, words: words, ask: ask, accept: accept };
    if (answer) row.answer = answer;
    return row;
  }

  var CAST = {
    neighbor: { role: "A neighbor says", es: "Rosa", ja: "Hana", kana: "はな", tr: "Elif" },
    shop: { role: "The shopkeeper says", es: "Ana", ja: "Aoi", kana: "あおい", tr: "Ayşe" },
    traveler: { role: "A traveler says", es: "Miguel", ja: "Kenji", kana: "けんじ", tr: "Yusuf" }
  };

  var DAYS = [
    {
      name: "Monday", where: "The street", shot: "street", lesson: 1, hover: true, cast: "neighbor",
      place: "A neighbor meets you on the street.",
      placeNamed: "{name} meets you on the street.",
      hint: true,
      beats: [
        {
          who: "A neighbor says",
          es: line("Buenos días.", [["Buenos", "Good"], ["días", "morning"]], "", ["buenos días"]),
          ja: line("おはよう。", [["おはよう", "good morning"]], "", ["おはよう"]),
          tr: line("Günaydın.", [["Günaydın", "Good morning"]], "", ["günaydın"])
        },
        {
          when: {
            how: {
              es: line("Estoy bien.", [["Estoy", "I am"], ["bien", "well"]], "", ["bien", "estoy bien"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["げんきです"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["iyiyim"])
            },
            well: {
              es: line("Bien.", [["Bien", "well"]], "", ["bien"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["げんきです"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["iyiyim"])
            },
            bye: {
              es: line("Hasta mañana.", [["Hasta", "Until"], ["mañana", "tomorrow"]], "", ["hasta mañana"]),
              ja: line("またあした。", [["また", "again"], ["あした", "tomorrow"]], "", ["またあした"]),
              tr: line("Yarın görüşürüz.", [["Yarın", "Tomorrow"], ["görüşürüz", "we will see each other"]], "", ["yarın görüşürüz"])
            },
            thanks: {
              es: line("Bien.", [["Bien", "well"]], "", ["gracias"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["ありがとう"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["teşekkürler"])
            }
          },
          es: line("Hola. ¿Cómo estás?", [["Hola", "Hello"], ["Cómo", "How"], ["estás", "are you"]], "", ["bien", "estoy bien"]),
          ja: line("こんにちは。げんきですか。", [["こんにちは", "hello"], ["げんき", "well"], ["です", "are"], ["か", "question"]], "", ["げんきです"]),
          tr: line("Merhaba. Nasılsın?", [["Merhaba", "Hello"], ["Nasılsın", "How are you"]], "", ["iyiyim"])
        }
      ]
    },
    {
      name: "Tuesday", where: "The shore", shot: "shore", lesson: 1, hover: true, cast: "neighbor",
      place: "The same neighbor is down by the water.",
      placeNamed: "{name} is down by the water.",
      beats: [
        {
          who: "A neighbor says",
          jump: { bye: 2 },
          es: line("Buenos días.", [["Buenos", "Good"], ["días", "morning"]], "", ["cómo estás"]),
          ja: line("おはよう。", [["おはよう", "good morning"]], "", ["げんきですか"]),
          tr: line("Günaydın.", [["Günaydın", "Good morning"]], "", ["nasılsın"])
        },
        {
          when: {
            how: {
              es: line("Bien.", [["Bien", "well"]], "", ["gracias"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["ありがとう"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["teşekkürler"])
            },
            well: {
              es: line("Bien.", [["Bien", "well"]], "", ["gracias"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["ありがとう"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["teşekkürler"])
            },
            bye: {
              es: line("Hasta mañana.", [["Hasta", "Until"], ["mañana", "tomorrow"]], "", ["hasta mañana"]),
              ja: line("またあした。", [["また", "again"], ["あした", "tomorrow"]], "", ["またあした"]),
              tr: line("Yarın görüşürüz.", [["Yarın", "Tomorrow"], ["görüşürüz", "we will see each other"]], "", ["yarın görüşürüz"])
            },
            morning: {
              es: line("¿Cómo estás?", [["Cómo", "How"], ["estás", "are you"]], "", ["cómo estás"]),
              ja: line("げんきですか。", [["げんき", "well"], ["です", "are"], ["か", "question"]], "", ["げんきですか"]),
              tr: line("Nasılsın?", [["Nasılsın", "How are you"]], "", ["nasılsın"])
            },
            hello: {
              es: line("¿Cómo estás?", [["Cómo", "How"], ["estás", "are you"]], "", ["cómo estás"]),
              ja: line("げんきですか。", [["げんき", "well"], ["です", "are"], ["か", "question"]], "", ["げんきですか"]),
              tr: line("Nasılsın?", [["Nasılsın", "How are you"]], "", ["nasılsın"])
            }
          },
          es: line("Bien.", [["Bien", "well"]], "", ["gracias"]),
          ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["ありがとう"]),
          tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["teşekkürler"])
        },
        {
          es: line("Hasta mañana.", [["Hasta", "Until"], ["mañana", "tomorrow"]], "", ["hasta mañana"]),
          ja: line("またあした。", [["また", "again"], ["あした", "tomorrow"]], "", ["またあした"]),
          tr: line("Yarın görüşürüz.", [["Yarın", "Tomorrow"], ["görüşürüz", "we will see each other"]], "", ["yarın görüşürüz"])
        }
      ]
    },
    {
      name: "Wednesday", where: "The shop", shot: "shop", lesson: 2, hover: true, cast: "shop",
      place: "Bread is on the counter.",
      beats: [
        {
          who: "The shopkeeper says",
          es: line("¿Te gusta el pan?", [["Te", "You"], ["gusta", "like"], ["el", "the"], ["pan", "bread"]], "", ["me gusta el pan", "no me gusta el pan"]),
          ja: line("パンがすきですか。", [["パン", "bread"], ["が", "as for"], ["すき", "like"], ["です", "is"], ["か", "question"]], "", ["パンがすきです", "パンがすきじゃないです"]),
          tr: line("Ekmeği seviyor musun?", [["Ekmeği", "The bread"], ["seviyor musun", "do you like"]], "", ["ekmeği seviyorum", "ekmeği sevmiyorum"])
        },
        {
          lead: "A darker loaf sits to the side.",
          leadWhen: ["like", "not"],
          when: {
            like: {
              es: line("No me gusta este.", [["No", "Not"], ["me", "me"], ["gusta", "likes"], ["este", "this one"]], "", ["me gusta el pan", "no me gusta el pan"]),
              ja: line("これはすきじゃないです。", [["これ", "this"], ["は", "as for"], ["すき", "like"], ["じゃない", "not"], ["です", "is"]], "", ["パンがすきです", "パンがすきじゃないです"]),
              tr: line("Bunu sevmiyorum.", [["Bunu", "This one"], ["sevmiyorum", "I don't like"]], "", ["ekmeği seviyorum", "ekmeği sevmiyorum"])
            },
            not: {
              es: line("¿Te gusta este?", [["Te", "You"], ["gusta", "like"], ["este", "this one"]], "", ["me gusta el pan", "no me gusta el pan"]),
              ja: line("これはすきですか。", [["これ", "this"], ["は", "as for"], ["すき", "like"], ["です", "is"], ["か", "question"]], "", ["パンがすきです", "パンがすきじゃないです"]),
              tr: line("Bunu seviyor musun?", [["Bunu", "This one"], ["seviyor musun", "do you like"]], "", ["ekmeği seviyorum", "ekmeği sevmiyorum"])
            },
            how: {
              es: line("Estoy bien.", [["Estoy", "I am"], ["bien", "well"]], "", ["bien"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["げんきです"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["iyiyim"])
            },
            hello: {
              es: line("Hola.", [["Hola", "Hello"]], "", ["hola"]),
              ja: line("こんにちは。", [["こんにちは", "hello"]], "", ["こんにちは"]),
              tr: line("Merhaba.", [["Merhaba", "Hello"]], "", ["merhaba"])
            },
            morning: {
              es: line("Buenos días.", [["Buenos", "Good"], ["días", "morning"]], "", ["buenos días"]),
              ja: line("おはよう。", [["おはよう", "good morning"]], "", ["おはよう"]),
              tr: line("Günaydın.", [["Günaydın", "Good morning"]], "", ["günaydın"])
            },
            bye: {
              es: line("Hasta mañana.", [["Hasta", "Until"], ["mañana", "tomorrow"]], "", ["hasta mañana"]),
              ja: line("またあした。", [["また", "again"], ["あした", "tomorrow"]], "", ["またあした"]),
              tr: line("Yarın görüşürüz.", [["Yarın", "Tomorrow"], ["görüşürüz", "we will see each other"]], "", ["yarın görüşürüz"])
            }
          },
          es: line("¿Te gusta este?", [["Te", "You"], ["gusta", "like"], ["este", "this one"]], "", ["me gusta el pan", "no me gusta el pan"]),
          ja: line("これはすきですか。", [["これ", "this"], ["は", "as for"], ["すき", "like"], ["です", "is"], ["か", "question"]], "", ["パンがすきです", "パンがすきじゃないです"]),
          tr: line("Bunu seviyor musun?", [["Bunu", "This one"], ["seviyor musun", "do you like"]], "", ["ekmeği seviyorum", "ekmeği sevmiyorum"])
        }
      ]
    },
    {
      name: "Thursday", where: "The shop", shot: "shop", lesson: 2, hover: true, cast: "shop",
      place: "Tea is on the counter.",
      beats: [
        {
          who: "The shopkeeper says",
          leadFrom: {
            like: "She remembers you liked it.",
            not: "She remembers you left it."
          },
          es: line("¿Te gusta el té?", [["Te", "You"], ["gusta", "like"], ["el", "the"], ["té", "tea"]], "", ["me gusta el té", "no me gusta el té"]),
          ja: line("おちゃがすきですか。", [["おちゃ", "tea"], ["が", "as for"], ["すき", "like"], ["です", "is"], ["か", "question"]], "", ["おちゃがすきです", "おちゃがすきじゃないです"]),
          tr: line("Çayı seviyor musun?", [["Çayı", "The tea"], ["seviyor musun", "do you like"]], "", ["çayı seviyorum", "çayı sevmiyorum"])
        },
        {
          when: {
            like: {
              es: line("A mí también.", [["A", "To"], ["mí", "me"], ["también", "too"]], "", ["gracias"]),
              ja: line("わたしもすきです。", [["わたし", "I"], ["も", "too"], ["すき", "like"], ["です", "is"]], "", ["ありがとう"]),
              tr: line("Ben de.", [["Ben", "I"], ["de", "too"]], "", ["teşekkürler"])
            },
            not: {
              es: line("Está bien.", [["Está", "It is"], ["bien", "all right"]], "", ["gracias"]),
              ja: line("いいです。", [["いい", "all right"], ["です", "is"]], "", ["ありがとう"]),
              tr: line("Olur.", [["Olur", "That's all right"]], "", ["teşekkürler"])
            },
            how: {
              es: line("Estoy bien.", [["Estoy", "I am"], ["bien", "well"]], "", ["bien"]),
              ja: line("げんきです。", [["げんき", "well"], ["です", "am"]], "", ["げんきです"]),
              tr: line("İyiyim.", [["İyiyim", "I am well"]], "", ["iyiyim"])
            }
          },
          es: line("Está bien.", [["Está", "It is"], ["bien", "all right"]], "", ["gracias"]),
          ja: line("いいです。", [["いい", "all right"], ["です", "is"]], "", ["ありがとう"]),
          tr: line("Olur.", [["Olur", "That's all right"]], "", ["teşekkürler"])
        }
      ]
    },
    {
      name: "Friday", where: "The street", shot: "street", lesson: 3, hover: false, cast: "neighbor",
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
        },
        {
          when: {
            like: {
              es: line("A mí también.", [["A", ""], ["mí", ""], ["también", ""]], "", ["gracias", "bien", "hasta mañana"]),
              ja: line("わたしもすきです。", [["わたし", ""], ["も", ""], ["すき", ""], ["です", ""]], "", ["ありがとう", "げんきです", "またね"]),
              tr: line("Ben de.", [["Ben", ""], ["de", ""]], "", ["teşekkürler", "iyiyim", "görüşürüz"])
            },
            not: {
              es: line("Está bien.", [["Está", ""], ["bien", ""]], "", ["gracias", "bien", "hasta mañana"]),
              ja: line("いいです。", [["いい", ""], ["です", ""]], "", ["ありがとう", "げんきです", "またね"]),
              tr: line("Olur.", [["Olur", ""]], "", ["teşekkürler", "iyiyim", "görüşürüz"])
            }
          },
          es: line("Está bien.", [["Está", ""], ["bien", ""]], "", ["gracias", "bien", "hasta mañana"]),
          ja: line("いいです。", [["いい", ""], ["です", ""]], "", ["ありがとう", "げんきです", "またね"]),
          tr: line("Olur.", [["Olur", ""]], "", ["teşekkürler", "iyiyim", "görüşürüz"])
        }
      ]
    },
    {
      name: "Saturday", where: "The shop", shot: "shop", lesson: 3, hover: false, cast: "shop",
      place: "A cup of coffee is on the counter.",
      beats: [
        {
          who: "The shopkeeper says",
          es: line("¿Te gusta el café?", [["Te", ""], ["gusta", ""], ["el", ""], ["café", ""]], "", ["me gusta el café", "no me gusta el café"]),
          ja: line("コーヒーがすきですか。", [["コーヒー", ""], ["が", ""], ["すき", ""], ["です", ""], ["か", ""]], "", ["コーヒーがすきです", "コーヒーがすきじゃないです"]),
          tr: line("Kahveyi seviyor musun?", [["Kahveyi", ""], ["seviyor musun", ""]], "", ["kahveyi seviyorum", "kahveyi sevmiyorum"])
        },
        {
          when: {
            like: {
              es: line("Me gusta el café. Hasta mañana.", [["Me", ""], ["gusta", ""], ["el", ""], ["café", ""], ["Hasta", ""], ["mañana", ""]], "", ["hasta mañana"]),
              ja: line("コーヒーがすきです。またね。", [["コーヒー", ""], ["が", ""], ["すき", ""], ["です", ""], ["またね", ""]], "", ["またね", "またあした"]),
              tr: line("Kahveyi seviyorum. Görüşürüz.", [["Kahveyi", ""], ["seviyorum", ""], ["Görüşürüz", ""]], "", ["görüşürüz", "yarın görüşürüz"])
            },
            not: {
              es: line("Está bien. Hasta mañana.", [["Está", ""], ["bien", ""], ["Hasta", ""], ["mañana", ""]], "", ["hasta mañana"]),
              ja: line("いいです。またね。", [["いい", ""], ["です", ""], ["またね", ""]], "", ["またね", "またあした"]),
              tr: line("Olur. Görüşürüz.", [["Olur", ""], ["Görüşürüz", ""]], "", ["görüşürüz", "yarın görüşürüz"])
            }
          },
          es: line("Hasta mañana.", [["Hasta", ""], ["mañana", ""]], "", ["hasta mañana"]),
          ja: line("またね。", [["またね", ""]], "", ["またね", "またあした"]),
          tr: line("Görüşürüz.", [["Görüşürüz", ""]], "", ["görüşürüz", "yarın görüşürüz"])
        }
      ]
    },
    {
      name: "Sunday", where: "The station", shot: "station", lesson: 0, hover: false, cast: "traveler",
      place: "The train is waiting. You are not leaving on it today.",
      beats: [
        {
          who: "A traveler says",
          es: line("¿Te gusta el tren?", [["Te", ""], ["gusta", ""], ["el", ""], ["tren", ""]], "", ["me gusta el tren", "no me gusta el tren"]),
          ja: line("でんしゃがすきですか。", [["でんしゃ", ""], ["が", ""], ["すき", ""], ["です", ""], ["か", ""]], "", ["でんしゃがすきです", "でんしゃがすきじゃないです"]),
          tr: line("Treni seviyor musun?", [["Treni", ""], ["seviyor musun", ""]], "", ["treni seviyorum", "treni sevmiyorum"])
        },
        {
          when: {
            like: {
              es: line("A mí también.", [["A", ""], ["mí", ""], ["también", ""]], "", ["hasta mañana", "gracias"]),
              ja: line("わたしもすきです。", [["わたし", ""], ["も", ""], ["すき", ""], ["です", ""]], "", ["またね", "ありがとう"]),
              tr: line("Ben de.", [["Ben", ""], ["de", ""]], "", ["görüşürüz", "teşekkürler"])
            },
            not: {
              es: line("Está bien.", [["Está", ""], ["bien", ""]], "", ["hasta mañana", "gracias"]),
              ja: line("いいです。", [["いい", ""], ["です", ""]], "", ["またね", "ありがとう"]),
              tr: line("Olur.", [["Olur", ""]], "", ["görüşürüz", "teşekkürler"])
            }
          },
          es: line("Está bien.", [["Está", ""], ["bien", ""]], "", ["hasta mañana", "gracias"]),
          ja: line("いいです。", [["いい", ""], ["です", ""]], "", ["またね", "ありがとう"]),
          tr: line("Olur.", [["Olur", ""]], "", ["görüşürüz", "teşekkürler"])
        },
        { walk: true }
      ]
    }
  ];

  var BOOK = {
    es: [
      { day: 0, say: "Buenos días", en: "Good morning" },
      { day: 0, say: "Hola", en: "Hello" },
      { day: 0, say: "Cómo estás", en: "How are you" },
      { day: 0, say: "Cómo te llamas", en: "What's your name" },
      { day: 0, say: "Bien", en: "Well" },
      { day: 0, say: "Estoy bien", en: "I am well" },
      { day: 0, say: "Gracias", en: "Thank you" },
      { day: 0, say: "Hasta mañana", en: "See you tomorrow" },
      { day: 2, say: "Me gusta", en: "I like" },
      { day: 2, say: "No me gusta", en: "I don't like" },
      { day: 2, say: "El pan", en: "The bread" },
      { day: 3, say: "El té", en: "The tea" },
      { day: 4, say: "El sol", en: "The sun" },
      { day: 5, say: "El café", en: "The coffee" },
      { day: 6, say: "El tren", en: "The train" }
    ],
    ja: [
      { day: 0, say: "おはよう", en: "Good morning" },
      { day: 0, say: "こんにちは", en: "Hello" },
      { day: 0, say: "げんきですか", en: "How are you" },
      { day: 0, say: "おなまえは", en: "What's your name" },
      { day: 0, say: "げんき", en: "Well" },
      { day: 0, say: "げんきです", en: "I am well" },
      { day: 0, say: "ありがとう", en: "Thank you" },
      { day: 0, say: "またあした", en: "See you tomorrow" },
      { day: 0, say: "またね", en: "See you" },
      { day: 2, say: "すきです", en: "I like" },
      { day: 2, say: "すきじゃないです", en: "I don't like" },
      { day: 2, say: "パン", en: "Bread" },
      { day: 3, say: "おちゃ", en: "Tea" },
      { day: 4, say: "ひ", en: "Sun" },
      { day: 5, say: "コーヒー", en: "Coffee" },
      { day: 6, say: "でんしゃ", en: "Train" }
    ],
    tr: [
      { day: 0, say: "Günaydın", en: "Good morning" },
      { day: 0, say: "Merhaba", en: "Hello" },
      { day: 0, say: "Nasılsın", en: "How are you" },
      { day: 0, say: "Adın ne", en: "What's your name" },
      { day: 0, say: "İyiyim", en: "I am well" },
      { day: 0, say: "Teşekkürler", en: "Thank you" },
      { day: 0, say: "Yarın görüşürüz", en: "See you tomorrow" },
      { day: 0, say: "Görüşürüz", en: "See you" },
      { day: 2, say: "Seviyorum", en: "I like" },
      { day: 2, say: "Sevmiyorum", en: "I don't like" },
      { day: 2, say: "Ekmeği", en: "The bread" },
      { day: 3, say: "Çayı", en: "The tea" },
      { day: 4, say: "Güneşi", en: "The sun" },
      { day: 5, say: "Kahveyi", en: "The coffee" },
      { day: 6, say: "Treni", en: "The train" }
    ]
  };

  var OPEN = {
    es: [
      "buenos días", "hola", "cómo estás", "hola cómo estás", "cómo estás hola",
      "cómo te llamas", "cuál es tu nombre",
      "bien", "estoy bien", "hola bien", "gracias", "hasta mañana",
      "me gusta", "no me gusta",
      "me gusta el pan", "no me gusta el pan",
      "me gusta el té", "no me gusta el té",
      "me gusta el sol", "no me gusta el sol",
      "me gusta el café", "no me gusta el café",
      "me gusta el tren", "no me gusta el tren"
    ],
    ja: [
      "おはよう", "こんにちは", "げんきですか", "こんにちはげんきですか",
      "おなまえは", "おなまえはなんですか",
      "げんきです", "ありがとう", "またあした", "またね",
      "すきです", "すきじゃないです",
      "パンがすきです", "パンがすきじゃないです",
      "おちゃがすきです", "おちゃがすきじゃないです",
      "ひがすきです", "ひがすきじゃないです",
      "コーヒーがすきです", "コーヒーがすきじゃないです",
      "でんしゃがすきです", "でんしゃがすきじゃないです"
    ],
    tr: [
      "günaydın", "merhaba", "nasılsın", "merhaba nasılsın",
      "adın ne", "ismin ne",
      "iyiyim", "teşekkürler", "yarın görüşürüz", "görüşürüz",
      "seviyorum", "sevmiyorum",
      "ekmeği seviyorum", "ekmeği sevmiyorum",
      "çayı seviyorum", "çayı sevmiyorum",
      "güneşi seviyorum", "güneşi sevmiyorum",
      "kahveyi seviyorum", "kahveyi sevmiyorum",
      "treni seviyorum", "treni sevmiyorum"
    ]
  };

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
    if (!lesson.moods) lesson.moods = [];
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
    var list = (OPEN[lang] || OPEN.es).concat(accept || []);
    var i;
    if (!got) return { ok: false, empty: true };
    for (i = 0; i < list.length; i++) {
      if (got === norm(lang, list[i])) return { ok: true };
    }
    for (i = 0; i < list.length; i++) {
      if (foldClose(lang, typed) === foldClose(lang, list[i])) return { ok: true };
    }
    if (lang === "ja" && /[a-zA-Z]/.test(typed)) return { ok: false, kana: true };
    return { ok: false };
  }

  function gradeSpoken(lang, heard, accept) {
    var result = grade(lang, heard, accept);
    var i;
    if (result.ok || result.letter) return { ok: !!result.ok || !!result.letter };
    for (i = 0; i < accept.length; i++) {
      if (foldClose(lang, heard) === foldClose(lang, accept[i])) return { ok: true };
    }
    return result;
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
        if (!beat.ja && !(beat.when && beat.when.how && beat.when.how.ja)) continue;
        text = "";
        if (beat.ja) text = beat.ja.say + " " + (beat.ja.accept || []).join("");
        if (beat.when) {
          Object.keys(beat.when).forEach(function (key) {
            var branch = beat.when[key].ja;
            if (branch) text += " " + branch.say + " " + (branch.accept || []).join("");
          });
        }
        add(text);
      }
    }
    (BOOK.ja || []).forEach(function (row) {
      if (row.day <= upToDay) add(row.say);
    });
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
    return "Not yet. Use the phrasebook.";
  }

  function spokenMiss(day, result, code) {
    if (code === "none" || code === "language-not-supported") return "This browser can't hear you. Type it instead.";
    if (code === "denied" || code === "audio-capture" || code === "not-allowed") {
      return "Click Allow on the microphone prompt, then press Say it again.";
    }
    if (result && result.kana) return "Tap the letters, or speak the words.";
    if (!result || result.empty) return "I didn't catch that. Press Say it again, or type it.";
    if (day.lesson === 3 || day.lesson === 0) return "Not yet. Press Say it again, or type what you already know.";
    return "Not yet. Use the phrasebook, or say it again.";
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

  function meaning(lang, typed) {
    var s = foldClose(lang, typed);
    if (!s) return "";
    if (lang === "ja") {
      if (s.indexOf("なまえ") !== -1) return "name";
      if (s.indexOf("じゃない") !== -1) return "not";
      if (s.indexOf("すき") !== -1) return "like";
      if (s.indexOf("げんきですか") !== -1) return "how";
      if (s.indexOf("また") !== -1) return "bye";
      if (s.indexOf("ありがとう") !== -1) return "thanks";
      if (s.indexOf("げんき") !== -1) return "well";
      if (s.indexOf("おはよう") !== -1) return "morning";
      if (s.indexOf("こんにちは") !== -1) return "hello";
      return "";
    }
    if (lang === "tr") {
      if (s.indexOf("adin ne") !== -1 || s.indexOf("ismin ne") !== -1) return "name";
      if (s.indexOf("sevmiyorum") !== -1) return "not";
      if (s.indexOf("seviyorum") !== -1) return "like";
      if (s.indexOf("nasilsin") !== -1) return "how";
      if (s.indexOf("gorusuruz") !== -1) return "bye";
      if (s.indexOf("tesekkurler") !== -1) return "thanks";
      if (s.indexOf("iyiyim") !== -1) return "well";
      if (s.indexOf("gunaydin") !== -1) return "morning";
      if (s.indexOf("merhaba") !== -1) return "hello";
      return "";
    }
    if (s.indexOf("te llamas") !== -1 || s.indexOf("tu nombre") !== -1) return "name";
    if ((s.indexOf("no ") === 0 || s.indexOf(" no ") !== -1) && s.indexOf("gusta") !== -1) return "not";
    if (s.indexOf("gusta") !== -1) return "like";
    if (s.indexOf("como estas") !== -1) return "how";
    if (s.indexOf("hasta manana") !== -1) return "bye";
    if (s.indexOf("gracias") !== -1) return "thanks";
    if (s.indexOf("estoy bien") !== -1 || s === "bien" || s.indexOf(" bien") !== -1) return "well";
    if (s.indexOf("buenos dias") !== -1) return "morning";
    if (s.indexOf("hola") !== -1) return "hello";
    return "";
  }

  function castName(person, lang) {
    var who = CAST[person] || CAST.neighbor;
    return who[lang] || who.es;
  }

  function nameKnown(lesson, person, dayIndex, step) {
    var at = lesson.knownAt && lesson.knownAt[person];
    if (!at) return false;
    if (dayIndex > at.day) return true;
    if (dayIndex < at.day) return false;
    return step >= at.step;
  }

  function rememberName(person, day, step) {
    var lesson = progress();
    if (!person) return;
    if (!lesson.knownAt) lesson.knownAt = {};
    if (lesson.knownAt[person]) return;
    lesson.knownAt[person] = { day: day, step: step };
  }

  function speakerText(day, step, force) {
    var person = day.cast || "neighbor";
    var lesson = progress();
    if (force || nameKnown(lesson, person, lesson.day, step)) return castName(person, pack().id) + " says";
    return (CAST[person] || CAST.neighbor).role;
  }

  function gloss(hover, en) {
    return hover ? en : "";
  }

  function nameIntro(person, lang, accept, hover) {
    var name = castName(person, lang);
    var who = CAST[person] || CAST.neighbor;
    if (lang === "ja") {
      var kana = who.kana;
      return line(
        "わたしは" + kana + "です。",
        [["わたし", gloss(hover, "I")], ["は", gloss(hover, "as for")], [kana, gloss(hover, name)], ["です", gloss(hover, "am")]],
        "",
        accept
      );
    }
    if (lang === "tr") {
      return line(
        "Adım " + name + ".",
        [["Adım", gloss(hover, "My name")], [name, gloss(hover, name)]],
        "",
        accept
      );
    }
    return line(
      "Me llamo " + name + ".",
      [["Me", gloss(hover, "I")], ["llamo", gloss(hover, "am called")], [name, gloss(hover, name)]],
      "",
      accept
    );
  }

  function lineFor(beat, lang, priorMood, person, hover) {
    var base = beat[lang] || beat.es;
    if (priorMood === "name" && person) return nameIntro(person, lang, (base && base.accept) || [], hover);
    var branch = priorMood && beat.when && beat.when[priorMood];
    if (branch && (branch[lang] || branch.es)) return branch[lang] || branch.es;
    return base;
  }

  function leadFor(beat, priorMood, step) {
    var lesson = progress();
    var day = DAYS[lesson.day];
    var at = typeof step === "number" ? step : lesson.step;
    if (beat.leadFrom && lesson.dayMood && beat.leadFrom[lesson.dayMood]) {
      var text = beat.leadFrom[lesson.dayMood];
      if (day.cast && nameKnown(lesson, day.cast, lesson.day, at)) {
        text = text.replace(/^She\b/, castName(day.cast, pack().id));
      }
      return text;
    }
    if (beat.leadWhen && beat.leadWhen.indexOf(priorMood || "") === -1) return "";
    return beat.lead || "";
  }

  function placeText(day) {
    var lesson = progress();
    if (day.placeNamed && day.cast && nameKnown(lesson, day.cast, lesson.day, 0)) {
      return day.placeNamed.replace("{name}", castName(day.cast, pack().id));
    }
    return day.place;
  }

  function paintBook(dayIndex, showEnglish) {
    var book = document.getElementById("book");
    if (!book) return;
    var list = book.querySelector("ul");
    if (!list) return;
    var lang = pack().id;
    var rows = (BOOK[lang] || BOOK.es).filter(function (row) { return row.day <= dayIndex; });
    book.hidden = false;
    list.replaceChildren();
    rows.forEach(function (row) {
      var item = document.createElement("li");
      var say = document.createElement("span");
      say.className = "book-say";
      say.textContent = row.say;
      item.appendChild(say);
      if (showEnglish && row.en) {
        var en = document.createElement("span");
        en.className = "book-en";
        en.textContent = row.en;
        item.appendChild(en);
      }
      list.appendChild(item);
    });
  }

  function rollDay(lesson, day) {
    if (lesson.step < day.beats.length) return;
    lesson.day += 1;
    lesson.step = 0;
    lesson.replies = [];
    lesson.moods = [];
    lesson.dayMood = lesson.carryMood || "";
    if (lesson.day >= DAYS.length) lesson.day = DAYS.length - 1;
  }

  function advance(said) {
    var lesson = progress();
    var day = DAYS[lesson.day];
    var lang = pack().id;
    if (lesson.nameHold) {
      lesson.nameHold = false;
      lesson.step += 1;
      rollDay(lesson, day);
      api().writeSave();
      render();
      return;
    }
    if (!lesson.replies) lesson.replies = [];
    if (!lesson.moods) lesson.moods = [];
    lesson.replies[lesson.step] = said;
    var mood = meaning(lang, said);
    lesson.moods[lesson.step] = mood;
    if (mood === "like" || mood === "not") lesson.carryMood = mood;
    var next = lesson.step + 1;
    var spoken = day.beats[lesson.step];
    if (mood !== "name" && spoken && spoken.jump && spoken.jump[mood] != null) next = spoken.jump[mood];
    if (mood === "name" && day.cast) {
      var upcoming = day.beats[next];
      if (!upcoming || upcoming.walk) {
        rememberName(day.cast, lesson.day + 1, 0);
        lesson.nameHold = true;
        api().writeSave();
        render();
        return;
      }
      rememberName(day.cast, lesson.day, next);
    }
    lesson.step = next;
    rollDay(lesson, day);
    api().writeSave();
    render();
  }

  function nextLanguage() {
    var langs = window.VILLAGE_LANGS || [{ id: "es" }];
    var state = api().state;
    state.langIndex = ((state.langIndex || 0) + 1) % langs.length;
    state.lesson = { day: 0, step: 0, replies: [], moods: [], dayMood: "" };
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
    page.pictureEl.alt = placeText(day);
    page.pictureEl.src = page.artUrl(shotName(day.shot));
    var notes = document.getElementById("notes");
    if (notes) notes.hidden = true;
    paintBook(lesson.day, !!day.hover);
    page.proseEl.replaceChildren();
    var place = document.createElement("p");
    place.textContent = page.fill(placeText(day));
    page.proseEl.appendChild(place);
    if (day.hint && lesson.step === 0) {
      var tip = document.createElement("p");
      tip.className = "letter-hint";
      tip.textContent = lang === "ja"
        ? "Tap the letters. The small mark under each one is its roman key."
        : "Hold a key if you want the other letter shape.";
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
    var lineData;
    var through = lesson.nameHold ? lesson.step + 1 : lesson.step;
    for (i = 0; i < through; i++) {
      var past = day.beats[i];
      if (!past || past.walk) continue;
      if (!(lesson.replies && lesson.replies[i])) continue;
      var pastMood = i > 0 && lesson.moods ? lesson.moods[i - 1] : "";
      var pastLine = lineFor(past, lang, pastMood, day.cast, day.hover);
      if (!pastLine) continue;
      addLead(leadFor(past, pastMood, i));
      addSpeaker(speakerText(day, i, false));
      addSpeech(pastLine, false);
      addYou((lesson.replies && lesson.replies[i]) || (pastLine.accept && pastLine.accept[0]) || "");
    }
    if (beat.walk && !lesson.nameHold) {
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
    if (lesson.nameHold) {
      lineData = nameIntro(day.cast, lang, [], day.hover);
      addSpeaker(speakerText(day, lesson.step, true));
      addSpeech(lineData, true);
    } else {
      var prior = lesson.step > 0 && lesson.moods ? lesson.moods[lesson.step - 1] : "";
      lineData = lineFor(beat, lang, prior, day.cast, day.hover);
      addLead(leadFor(beat, prior, lesson.step));
      addSpeaker(speakerText(day, lesson.step, false));
      addSpeech(lineData, true);
    }

    var form = document.createElement("form");
    form.className = "reply";
    var input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Your reply");
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

    var actions = document.createElement("div");
    actions.className = "reply-actions";
    var speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.textContent = "Say it";
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Send";
    actions.appendChild(speakBtn);
    actions.appendChild(submit);
    form.appendChild(actions);
    function showNote(text) {
      note.hidden = !text;
      note.textContent = text || "";
    }
    function spokenHit(sample) {
      var n;
      if (!sample) return "";
      for (n = 0; n < sample.length; n++) {
        if (gradeSpoken(lang, sample[n], lineData.accept).ok) {
          return String(sample[n] || "").replace(/\s+/g, " ").trim();
        }
      }
      return "";
    }
    speakBtn.addEventListener("click", function () {
      if (speakBtn.disabled || !page.listenReply) return;
      speakBtn.disabled = true;
      speakBtn.textContent = "Listening…";
      showNote("Mic is on. Say the line.");
      page.listenReply(voicePack.voice, function (heard) {
        if (speakBtn.disabled) showNote(heard ? ("Heard: " + heard) : "Mic is on. Say the line.");
      }, function (sample) {
        return !!spokenHit(sample);
      }).then(function (result) {
        speakBtn.disabled = false;
        speakBtn.textContent = "Say it";
        var said = spokenHit((result && result.texts) || []);
        if (!said && result) said = spokenHit([result.heard]);
        if (said) {
          advance(said);
          return;
        }
        showNote(spokenMiss(day, grade(lang, result && result.heard, lineData.accept)));
      }).catch(function (err) {
        var code = err && err.message;
        speakBtn.disabled = false;
        if (code === "cancelled") {
          speakBtn.textContent = "Say it";
          if (note.textContent === "Mic is on. Say the line." || note.textContent.indexOf("Heard:") === 0) showNote("");
          return;
        }
        speakBtn.textContent = (code === "denied" || code === "audio-capture" || code === "not-allowed") ? "Allow mic" : "Say it";
        showNote(spokenMiss(day, null, code));
      });
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      page.stopVoice();
      speakBtn.disabled = false;
      speakBtn.textContent = "Say it";
      var result = grade(lang, input.value, lineData.accept);
      if (result.ok) {
        advance(input.value.trim());
        return;
      }
      showNote(missText(day, result));
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
      var used = false;
      function choose(event) {
        event.preventDefault();
        if (used) return;
        used = true;
        onPick(ch);
      }
      button.addEventListener("mousedown", choose);
      button.addEventListener("click", choose);
      pop.appendChild(button);
    });
  }

  function wireHold(input, pop, lang) {
    var holds = HOLDS[lang] || {};
    var timer = 0;
    var held = "";
    var opened = false;
    var mark = null;
    var saved = null;
    var applying = false;
    var userDelete = false;
    var watchPick = false;
    var pickedValue = "";
    var suppress = "";
    var mods = { Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1 };

    function snapshot() {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var len = input.value.length;
      return {
        value: input.value,
        start: typeof start === "number" ? start : len,
        end: typeof end === "number" ? end : len
      };
    }

    function restore(snap) {
      if (!snap) return;
      applying = true;
      input.value = snap.value;
      try { input.setSelectionRange(snap.start, snap.end); } catch (err) {}
      applying = false;
    }

    function cancelTimer() {
      if (timer) clearTimeout(timer);
      timer = 0;
    }

    function endHold() {
      cancelTimer();
      pop.hidden = true;
      opened = false;
      held = "";
      mark = null;
    }

    function placeAccent(ch) {
      if (!ch || applying) return;
      var value = input.value;
      var index = mark ? mark.index : (typeof input.selectionStart === "number" ? input.selectionStart : value.length);
      var key = mark ? mark.key : "";
      applying = true;
      if (key && value.slice(index, index + key.length) === key) {
        input.value = value.slice(0, index) + ch + value.slice(index + key.length);
      } else {
        input.value = value.slice(0, index) + ch + value.slice(index);
      }
      var caret = index + ch.length;
      try { input.setSelectionRange(caret, caret); } catch (err) {}
      applying = false;
      suppress = key;
      watchPick = true;
      pickedValue = input.value;
      saved = snapshot();
      endHold();
      input.focus();
    }

    function protectPick() {
      if (!watchPick || applying || input.value === pickedValue) return;
      var caret = saved ? saved.start : pickedValue.length;
      applying = true;
      input.value = pickedValue;
      try { input.setSelectionRange(caret, caret); } catch (err) {}
      applying = false;
    }

    function restoreMark() {
      if (!mark) return;
      applying = true;
      input.value = mark.value;
      var caret = mark.index + mark.key.length;
      try { input.setSelectionRange(caret, caret); } catch (err) {}
      applying = false;
    }

    function keepWord() {
      if (applying) return;
      if (userDelete) {
        userDelete = false;
        watchPick = false;
        pickedValue = "";
        suppress = "";
        endHold();
        return;
      }
      protectPick();
      if (!mark || !held) return;
      if (input.value === mark.value) return;
      if (input.value.length < mark.value.length) {
        restoreMark();
        return;
      }
      var at = input.value.slice(mark.index, mark.index + mark.key.length);
      if (at === mark.key) {
        mark.value = input.value;
        return;
      }
      restoreMark();
    }

    input.addEventListener("beforeinput", function (event) {
      if (applying || userDelete) return;
      var type = event.inputType || "";
      if (type.indexOf("delete") === 0) return;
      if (!held && pop.hidden !== false) return;
      var systemEdit = type === "insertReplacementText" || type === "insertCompositionText" || (!!held && type === "insertText");
      if (!systemEdit) return;
      event.preventDefault();
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
      if (key === "Escape" && pop.hidden === false) {
        event.preventDefault();
        watchPick = false;
        pickedValue = "";
        suppress = "";
        endHold();
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        userDelete = true;
        watchPick = false;
        pickedValue = "";
        suppress = "";
        endHold();
        setTimeout(function () { userDelete = false; }, 0);
        return;
      }
      if (mods[key]) return;
      if (suppress && key === suppress) {
        event.preventDefault();
        return;
      }
      if (watchPick) {
        watchPick = false;
        pickedValue = "";
      }
      if (event.repeat) {
        if (held || holds[key]) event.preventDefault();
        return;
      }
      if (opened || (held && key !== held)) endHold();
      var options = holds[key];
      if (!options) return;
      event.preventDefault();
      var before = snapshot();
      applying = true;
      insertAt(input, key);
      applying = false;
      mark = { value: input.value, index: before.start, key: key };
      held = key;
      opened = false;
      cancelTimer();
      timer = setTimeout(function () {
        if (held !== key || !mark) return;
        if (input.value.slice(mark.index, mark.index + key.length) !== key) {
          endHold();
          return;
        }
        opened = true;
        showHoldChoices(pop, options, placeAccent);
      }, 450);
    });

    input.addEventListener("keyup", function (event) {
      if (suppress && event.key === suppress) {
        var keyName = event.key;
        setTimeout(function () {
          protectPick();
          if (suppress === keyName) {
            suppress = "";
            watchPick = false;
            pickedValue = "";
          }
        }, 0);
      }
      if (event.key !== held) return;
      cancelTimer();
      if (!opened) {
        held = "";
        mark = null;
      }
    });

    input.addEventListener("blur", function () {
      cancelTimer();
      if (opened || watchPick) return;
      held = "";
      mark = null;
    });
  }

  window.MOLessons = {
    render: render,
    grade: grade,
    gradeSpoken: gradeSpoken
  };
})();
