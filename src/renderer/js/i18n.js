// Her words for what came over from Capri Desktop 2.4 (and her settings): the English is the key,
// assets/lang/<code>.txt the translation (main/lang.js reads them; this gets its table).

let table = { code: 'en', lines: {} };

export async function loadLang(host) {
  table = (await host.langTable().catch(() => null)) || table;
  return table;
}

export const T = (english) => (english && table.lines[english]) || english;
export const F = (english, ...values) => T(english).replace(/\{(\d+)\}/g, (_, i) => (values[i] ?? ''));
export const langCode = () => table.code;
