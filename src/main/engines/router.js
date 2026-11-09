'use strict';

// Where something you said should go, once her rules have found it isn't a plain command: a plan of several steps, one
// of her skills, what you gave her to read, her memory of you, the web, or just a chat. No model involved: it's decided
// before her model is asked anything, so a chat never waits for it.

const JOINER = /\s*,?\s+(?:and then|and|then|after that|lalu|terus|trus|kemudian|habis itu|abis itu|setelah itu|sesudah itu)\s+|\s*[;,]\s+/i;
const DOING = /\b(?:open|launch|start|search|look up|find|google|play|write|type|save|send|copy|summari[sz]e|translate|read|note|set|remind|close|click|download|buka\w*|jalan\w*|cari\w*|googling|putar\w*|puter\w*|setel\w*|tulis\w*|ketik\w*|simpan\w*|kirim\w*|salin\w*|ringkas\w*|rangkum\w*|terjemah\w*|baca\w*|catat\w*|pasang\w*|ingat\w*|tutup\w*|klik|bikin\w*|buat\w*)\b/gi;
const PLAN_CUE = /^(?:plan|make a plan (?:to|for)|work out how to|rencanakan|buat(?:kan)? rencana|kerjakan tugas|tolong kerjakan|do these|lakukan ini)\b/i;
const QUESTION = /^(?:who|what|why|how|when|where|which|whose|is|are|was|were|does|did|siapa|apa|apakah|kenapa|mengapa|bagaimana|gimana|kapan|di ?mana|berapa)\b|\?\s*$/i;
const PAST = /\b(?:remember|recall|last time|you said|i told you|we talked|yesterday|the other day|ingat|inget|waktu itu|kemarin|tadi|dulu|pernah|aku bilang|kamu bilang|kita ngobrol)\b/i;

// Does this take several steps of different kinds? (Her rules already did what they could with it.)
function wantsPlan(text) {
  const t = String(text || '').trim();
  if (t.length < 12 || t.length > 400 || /\n/.test(t)) return false;
  if (PLAN_CUE.test(t)) return true;
  if (QUESTION.test(t) || !JOINER.test(t)) return false;
  return new Set((t.match(DOING) || []).map((w) => w.toLowerCase().slice(0, 4))).size >= 2;
}

// "search for cats and write the summary in notepad": each piece reads like a command of hers, but one needs what another
// comes up with, so typing "the summary" as it is would be wrong. That's a plan.
const RESULT_WORDS = /^(?:(?:the|that|this|its|my)\s+)?(?:summary|results?|answers?|findings?|it|that|this)$|^(?:ringkasan|rangkuman|hasil|jawaban|kesimpulan|isi)(?:nya)?(?:\s+(?:itu|ini|tadi))?$|^(?:itu|ini|tadi)$/i;
const usesEarlierResult = (steps) => steps.some((s, i) => i > 0 && s.e.kind === 'type' && RESULT_WORDS.test(String(s.e.text).trim()));

// knowledgeHits: what her knowledge base found; skill: the skill it matched, if any.
// -> { route: 'knowledge' | 'skill' | 'memory' | 'chat', skill, web }; web: true (look it up first), false (don't), undefined (as usual)
function decide(text, { knowledgeHits = [], skill = null } = {}) {
  const strong = knowledgeHits.some((k) => k.close || k.words);
  if (skill) return { route: 'skill', skill, web: skill.web === true ? true : undefined };
  if (strong) return { route: 'knowledge', skill: null, web: false };
  if (PAST.test(text)) return { route: 'memory', skill: null, web: false };
  return { route: 'chat', skill: null, web: undefined };
}

module.exports = { wantsPlan, usesEarlierResult, decide };
