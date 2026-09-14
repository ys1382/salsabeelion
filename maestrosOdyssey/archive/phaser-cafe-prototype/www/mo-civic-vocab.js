/**
 * Civic / government / law vocabulary — recognition in news, school, signs, forms,
 * ordinary conversations. Not political-theory depth; not protagonist-as-politician register.
 *
 * Narrative role: wider-world and post-train crossroads — headlines, permits, court signs,
 * embassy placards, election posters. Player goal: recognize like a prepared tourist/citizen
 * reading the news, not lecture Spanish culture.
 */
(function () {
  "use strict";

  var VISIT_KEY = "mo_civic_visits";

  function w(en, es, introTier, cognate) {
    return { en: en, es: es || en, introTier: introTier || 2, cognate: !!cognate };
  }

  function same(en, tier) {
    return w(en, en, tier, true);
  }

  /** @type {Record<string, Array<{ en: string, es: string, introTier: number, cognate?: boolean }>>} */
  var CORE = {
    leadersOfficials: [
      w("president", "presidente", 1, true),
      w("vice president", "vicepresidente", 2),
      w("governor", "gobernador", 2),
      w("mayor", "alcalde", 2),
      w("minister", "ministro", 2, true),
      w("prime minister", "primer ministro", 3),
      w("ambassador", "embajador", 2),
      w("senator", "senador", 2, true),
      w("representative", "representante", 2, true),
      w("congressman", "congresista", 3),
      w("congresswoman", "congresista", 3),
      w("council member", "concejal", 3),
      w("official", "funcionario", 2),
      w("leader", "líder", 2, true),
      w("candidate", "candidato", 2, true),
      w("judge", "juez", 2),
      w("lawyer", "abogado", 2),
      w("attorney", "abogado", 2),
      w("police officer", "policía", 1),
      w("sheriff", "alguacil", 3)
    ],
    governmentPlacesGroups: [
      w("government", "gobierno", 1),
      w("city hall", "ayuntamiento", 3),
      w("capitol", "capitolio", 2, true),
      w("embassy", "embajada", 2),
      w("consulate", "consulado", 3),
      w("court", "tribunal", 2),
      w("courthouse", "palacio de justicia", 3),
      w("police station", "comisaría", 2),
      w("department", "departamento", 2, true),
      w("office", "oficina", 2, true),
      w("agency", "agencia", 2, true),
      w("council", "concejo", 3),
      w("congress", "congreso", 2, true),
      w("senate", "senado", 2, true),
      w("parliament", "parlamento", 3, true),
      w("committee", "comité", 3, true),
      w("cabinet", "gabinete", 3)
    ],
    electionsVoting: [
      w("election", "elección", 2),
      w("vote", "voto", 2),
      w("voter", "votante", 3),
      w("ballot", "boleta", 3),
      w("poll", "encuesta", 3),
      w("polling place", "centro de votación", 3),
      w("campaign", "campaña", 2, true),
      w("debate", "debate", 2, true),
      w("speech", "discurso", 2),
      w("rally", "mitin", 3),
      w("primary", "primarias", 3),
      w("winner", "ganador", 2),
      w("majority", "mayoría", 3),
      w("minority", "minoría", 3, true),
      w("result", "resultado", 2, true),
      w("recount", "recuento", 4)
    ],
    lawCourt: [
      w("law", "ley", 1),
      w("rule", "regla", 2),
      w("rights", "derechos", 2),
      w("case", "caso", 2, true),
      w("trial", "juicio", 3),
      w("jury", "jurado", 3),
      w("witness", "testigo", 3),
      w("evidence", "prueba", 3),
      w("charge", "acusación", 3),
      w("crime", "delito", 2),
      w("fine", "multa", 2),
      w("sentence", "sentencia", 4),
      w("appeal", "apelación", 4),
      w("guilty", "culpable", 3),
      w("not guilty", "inocente", 3),
      w("legal", "legal", 2, true),
      w("illegal", "ilegal", 2, true)
    ],
    civicPublic: [
      w("citizen", "ciudadano", 2),
      w("resident", "residente", 2, true),
      w("public", "público", 2, true),
      w("community", "comunidad", 2, true),
      w("state", "estado", 2, true),
      w("country", "país", 1),
      w("nation", "nación", 2, true),
      w("city", "ciudad", 1),
      w("county", "condado", 3),
      w("district", "distrito", 3, true),
      w("border", "frontera", 2),
      w("passport", "pasaporte", 2, true),
      same("visa", 2),
      w("tax", "impuesto", 2),
      w("license", "licencia", 2, true),
      w("permit", "permiso", 2),
      w("ID", "identificación", 2),
      w("document", "documento", 2, true),
      w("form", "formulario", 2),
      w("signature", "firma", 2)
    ],
    policyIssues: [
      w("policy", "política", 2),
      same("plan", 2),
      w("bill", "proyecto de ley", 3),
      w("budget", "presupuesto", 3),
      w("taxes", "impuestos", 2),
      w("health care", "atención médica", 2),
      w("education", "educación", 2, true),
      w("housing", "vivienda", 3),
      w("transportation", "transporte", 2, true),
      w("immigration", "inmigración", 3),
      w("environment", "medio ambiente", 2),
      w("safety", "seguridad", 2),
      w("security", "seguridad", 2),
      w("jobs", "empleos", 2),
      w("economy", "economía", 2, true),
      w("schools", "escuelas", 1),
      w("roads", "carreteras", 2)
    ],
    newsConflict: [
      w("announcement", "anuncio", 2),
      w("statement", "declaración", 3),
      w("press conference", "conferencia de prensa", 3),
      w("report", "informe", 2),
      w("investigation", "investigación", 3, true),
      w("protest", "protesta", 2),
      w("march", "marcha", 2),
      w("strike", "huelga", 3),
      w("scandal", "escándalo", 3, true),
      same("crisis", 2),
      w("emergency", "emergencia", 2, true),
      w("agreement", "acuerdo", 2),
      w("deal", "acuerdo", 3),
      w("treaty", "tratado", 3),
      w("war", "guerra", 3),
      w("peace", "paz", 2)
    ]
  };

  /** More specific — forms, legal detail, political labels, international relations. */
  var MAYBE = {
    specificOfficials: [
      w("secretary", "secretario", 3, true),
      w("treasurer", "tesorero", 4),
      w("clerk", "secretario", 3),
      w("commissioner", "comisionado", 4, true),
      w("supervisor", "supervisor", 3, true),
      w("delegate", "delegado", 4, true),
      w("diplomat", "diplomático", 3),
      w("spokesperson", "portavoz", 4),
      w("prosecutor", "fiscal", 4),
      w("defense lawyer", "abogado defensor", 4),
      w("public defender", "defensor público", 4),
      w("chief of staff", "jefe de personal", 4),
      w("campaign manager", "director de campaña", 4)
    ],
    specificPlacesGroups: [
      w("city council", "concejo municipal", 4),
      w("school board", "junta escolar", 4),
      w("supreme court", "corte suprema", 4),
      w("appeals court", "corte de apelaciones", 4),
      w("district court", "tribunal de distrito", 4),
      w("federal government", "gobierno federal", 3),
      w("state government", "gobierno estatal", 3),
      w("local government", "gobierno local", 3),
      w("United Nations", "Naciones Unidas", 4),
      w("military", "militar", 3, true),
      w("army", "ejército", 3),
      w("navy", "marina", 3),
      w("air force", "fuerza aérea", 4)
    ],
    electionDetails: [
      w("registration", "registro", 3, true),
      w("voter registration", "registro de votantes", 4),
      w("absentee ballot", "voto en ausencia", 4),
      w("mail-in ballot", "voto por correo", 4),
      w("early voting", "voto anticipado", 4),
      w("runoff", "segunda vuelta", 4),
      w("referendum", "referéndum", 4, true),
      w("initiative", "iniciativa", 4, true),
      w("proposition", "proposición", 4, true),
      w("poll worker", "trabajador electoral", 4),
      w("campaign ad", "anuncio de campaña", 4),
      w("campaign sign", "letrero de campaña", 4),
      w("donation", "donación", 3, true),
      w("fundraising", "recaudación de fondos", 4)
    ],
    legalDetails: [
      w("lawsuit", "demanda", 4),
      w("plaintiff", "demandante", 4),
      w("defendant", "acusado", 4),
      w("verdict", "veredicto", 4, true),
      w("settlement", "acuerdo", 4),
      w("warrant", "orden judicial", 4),
      w("arrest", "arresto", 3),
      w("bail", "fianza", 4),
      w("probation", "libertad condicional", 4),
      w("prison", "prisión", 3),
      w("jail", "cárcel", 3),
      w("felony", "delito grave", 4),
      w("misdemeanor", "delito menor", 4),
      w("testimony", "testimonio", 4, true),
      w("subpoena", "citación judicial", 4),
      w("contract", "contrato", 3, true)
    ],
    politicalLabels: [
      w("democracy", "democracia", 3, true),
      w("republic", "república", 3, true),
      w("constitution", "constitución", 3, true),
      w("freedom", "libertad", 3),
      w("justice", "justicia", 3),
      w("equality", "igualdad", 3),
      w("party", "partido", 3),
      w("political party", "partido político", 3),
      w("left", "izquierda", 4),
      w("right", "derecha", 4),
      w("liberal", "liberal", 4, true),
      w("conservative", "conservador", 4),
      w("moderate", "moderado", 4, true),
      w("independent", "independiente", 4, true),
      w("reform", "reforma", 3, true)
    ],
    internationalRelations: [
      w("foreign policy", "política exterior", 4),
      w("diplomat", "diplomático", 3),
      w("alliance", "alianza", 4, true),
      w("sanctions", "sanciones", 4, true),
      w("border control", "control fronterizo", 4),
      w("refugee", "refugiado", 3),
      w("asylum", "asilo", 4),
      w("immigration officer", "oficial de inmigración", 4),
      w("customs", "aduana", 3),
      w("visa office", "oficina de visas", 4)
    ]
  };

  /** Owner-picked strongest beginner-recognition set (Spanish lemmas). */
  var STRONG_STARTER = [
    "presidente", "alcalde", "gobernador", "embajador", "senador",
    "juez", "abogado", "ley", "tribunal", "voto", "elección", "candidato",
    "gobierno", "policía", "ciudadano", "derechos", "impuesto",
    "pasaporte", "visa", "embajada"
  ];

  function flattenGroups(groups) {
    var out = [];
    Object.keys(groups).forEach(function (k) {
      (groups[k] || []).forEach(function (entry) {
        out.push(entry);
      });
    });
    return out;
  }

  function allEntries() {
    return flattenGroups(CORE).concat(flattenGroups(MAYBE));
  }

  function getVisitCount() {
    try {
      return parseInt(localStorage.getItem(VISIT_KEY) || "0", 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function recordVisit() {
    try {
      localStorage.setItem(VISIT_KEY, String(getVisitCount() + 1));
    } catch (e) { /* private mode */ }
  }

  /** Words unlocked by visit tier (1 = first exposure pass). */
  function getKnownSpanishWords(maxTier) {
    var cap = maxTier == null ? 4 : maxTier;
    var seen = {};
    allEntries().forEach(function (entry) {
      if (entry.introTier <= cap) {
        seen[entry.es.toLowerCase()] = true;
      }
    });
    return Object.keys(seen).sort();
  }

  function getStrongStarterWords() {
    return STRONG_STARTER.slice();
  }

  function isStrongStarter(es) {
    return STRONG_STARTER.indexOf(String(es || "").trim().toLowerCase()) !== -1;
  }

  /** 1–2 headline/sign recognition; 3+ more civic detail in copy. */
  function getMixLevel() {
    var visits = getVisitCount();
    if (visits >= 6) return 3;
    if (visits >= 3) return 2;
    return 1;
  }

  window.MO_CIVIC_VOCAB = {
    CONTEXT: "civic recognition — news, signs, forms, school, ordinary public life",
    TONE: "recognize-and-follow — not politician or culture-teacher voice",
    CORE: CORE,
    MAYBE: MAYBE,
    STRONG_STARTER: STRONG_STARTER,
    allEntries: allEntries,
    flattenGroups: flattenGroups,
    getKnownSpanishWords: getKnownSpanishWords,
    getStrongStarterWords: getStrongStarterWords,
    isStrongStarter: isStrongStarter,
    getVisitCount: getVisitCount,
    recordVisit: recordVisit,
    getMixLevel: getMixLevel
  };
})();
