'use strict';

// Everything a plan of hers can do, each with what it takes and how far it reaches. A plan is written by her model, so
// this list is the whole of what can happen: nothing else exists for it, its arguments are checked before anything runs,
// and everything on your PC goes through the same errands (and the same switches in Access) as when you ask in words.
//
//   risk 0  nothing outside her      1  you see the plan and say go first                2  a yes of its own, when it comes up

const KEYS = ['enter', 'save', 'selectall', 'undo', 'newline', 'tab'];
const MEDIA = ['pause', 'play', 'next', 'previous', 'volup', 'voldown', 'mute'];
const MAX_TEXT = 6000;

const str = (max = 200, optional = false) => ({ type: 'string', max, optional });

// deps: { parse, act, ask, lookup, recall, skill, browser, close }
function createTools(deps) {
  const errand = async (e) => {
    const res = await deps.act(e);
    return { ok: Boolean(res?.handled) && !res.denied, say: res?.reply || '' };
  };
  // something she'd do if you said it: read by her own rules, and only ever one of the kinds it's meant to be
  const said = async (sentence, kinds) => {
    const e = deps.parse(sentence);
    if (!kinds.includes(e.kind)) return { ok: false, say: `"${sentence}" isn't something I can do.` };
    return errand(e);
  };
  const browsing = (fn) => async (args) => {
    if (!deps.browser) return { ok: false, say: 'My browser is off.' };
    return fn(args);
  };

  return {
    open: { about: 'open an app, a website or a folder by its name', args: { what: str(80) }, risk: 1, run: ({ what }) => said(`open ${what}`, ['app', 'open', 'browser']) },
    play_music: { about: 'play a song on Spotify', args: { song: str(100) }, risk: 1, run: ({ song }) => errand({ kind: 'song', text: song }) },
    media: { about: 'control what is playing', args: { action: { type: 'enum', values: MEDIA } }, risk: 1, run: ({ action }) => errand({ kind: 'media', action }) },
    set_timer: { about: 'set a timer, in minutes', args: { minutes: { type: 'number', min: 0.1, max: 1440 }, label: str(60, true) }, risk: 0, run: ({ minutes, label }) => errand({ kind: 'timer', seconds: Math.round(minutes * 60), label: label || '' }) },
    remember: { about: 'keep a fact about the user', args: { fact: str(200) }, risk: 0, run: ({ fact }) => errand({ kind: 'remember', text: fact }) },
    web_lookup: {
      about: 'find information online, gives text for the next step',
      args: { query: str(150) },
      risk: 0,
      run: async ({ query }) => {
        const found = await deps.lookup(query).catch(() => null);
        if (!found?.results?.length) return { ok: false, say: `Nothing came up for "${query}".` };
        return { ok: true, text: found.results.map((r) => `${r.title || ''}: ${r.text || r.snippet || ''}`).join('\n').slice(0, MAX_TEXT), say: '' };
      },
    },
    recall: {
      about: 'look in her memory and the knowledge base, gives text for the next step',
      args: { query: str(150) },
      risk: 0,
      run: async ({ query }) => {
        const text = deps.recall ? await deps.recall(query) : '';
        return text ? { ok: true, text: text.slice(0, MAX_TEXT), say: '' } : { ok: false, say: `I've got nothing on "${query}".` };
      },
    },
    think: {
      about: 'write, summarize or work something out from text; gives text for the next step',
      args: { prompt: str(MAX_TEXT + 500) },
      risk: 0,
      run: async ({ prompt }) => {
        const text = String(await deps.ask([{ role: 'user', content: prompt }], { timeout: 90000 }).catch(() => '')).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        return text ? { ok: true, text: text.slice(0, MAX_TEXT), say: '' } : { ok: false, say: "My brain didn't answer." };
      },
    },
    use_skill: {
      about: 'do something with one of her skills (writing, coding, math, research), gives text for the next step',
      args: { skill: str(40), input: str(MAX_TEXT) },
      risk: 0,
      run: async ({ skill, input }) => {
        const text = deps.skill ? await deps.skill(skill, input) : '';
        return text ? { ok: true, text: text.slice(0, MAX_TEXT), say: '' } : { ok: false, say: `The ${skill} skill gave me nothing.` };
      },
    },
    type_text: { about: 'type text into an app, by the name of the app; without one, into the window the user was in', args: { text: str(MAX_TEXT), app: str(60, true) }, risk: 1, run: ({ text, app }) => errand({ kind: 'type', text, target: app || '' }) },
    press_key: { about: 'press a key in an app', args: { key: { type: 'enum', values: KEYS }, app: str(60, true) }, risk: 1, run: ({ key, app }) => errand({ kind: 'key', key, target: app || '' }) },
    click_button: { about: 'press a button by its name in an app', args: { name: str(60), app: str(60, true) }, risk: 1, run: ({ name, app }) => errand({ kind: 'click', name, target: app || '' }) },
    write_code: { about: 'write code into a new file of its own', args: { task: str(800) }, risk: 1, run: ({ task }) => errand({ kind: 'code', task, via: 'self' }) },
    close_app: {
      about: 'close an app',
      args: { name: str(60) },
      risk: 2,
      run: async ({ name }) => {
        if (!deps.close) return { ok: false, say: "I can't close things from here." };
        const res = await deps.close(name).catch((err) => ({ error: err.message }));
        return res?.error ? { ok: false, say: res.error } : { ok: true, say: '' };
      },
    },
    browser_open: { about: 'open a page in her own browser', args: { url: str(400) }, risk: 0, run: browsing(({ url }) => deps.browser.open(url)) },
    browser_search: { about: 'search the web in her own browser', args: { query: str(150) }, risk: 0, run: browsing(({ query }) => deps.browser.search(query)) },
    browser_read: { about: 'read the page open in her own browser, gives text for the next step', args: {}, risk: 0, run: browsing(() => deps.browser.read()) },
    browser_click: { about: 'click a link or button on the page in her own browser, by its words', args: { text: str(80) }, risk: 1, run: browsing(({ text }) => deps.browser.click(text)) },
    browser_fill: { about: 'fill a field on the page in her own browser, by its label', args: { field: str(80), text: str(1000) }, risk: 1, run: browsing(({ field, text }) => deps.browser.fill(field, text)) },
  };
}

// One step her model wrote: { ok, step: { tool, args, why, risk } } with only the arguments that tool takes, or { ok: false, error }.
function check(step, tools) {
  const tool = tools[step?.tool];
  if (!tool || typeof step.tool !== 'string' || !Object.hasOwn(tools, step.tool)) return { ok: false, error: `no tool "${step?.tool}"` };
  const given = step.args && typeof step.args === 'object' && !Array.isArray(step.args) ? step.args : {};
  const args = {};
  for (const [name, rule] of Object.entries(tool.args)) {
    const value = given[name];
    if (value === undefined || value === null || value === '') {
      if (rule.optional) continue;
      return { ok: false, error: `${step.tool}: "${name}" is missing` };
    }
    if (rule.type === 'string') {
      if (typeof value !== 'string' && typeof value !== 'number') return { ok: false, error: `${step.tool}: "${name}" isn't text` };
      args[name] = String(value).slice(0, rule.max);
    } else if (rule.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < rule.min || n > rule.max) return { ok: false, error: `${step.tool}: "${name}" is out of range` };
      args[name] = n;
    } else if (rule.type === 'enum') {
      if (!rule.values.includes(value)) return { ok: false, error: `${step.tool}: "${name}" can't be "${value}"` };
      args[name] = value;
    }
  }
  return { ok: true, step: { tool: step.tool, args, why: String(step.why || step.tool).slice(0, 100), risk: tool.risk } };
}

// How she's told what there is, for her model.
const describe = (tools) => Object.entries(tools).map(([name, t]) => `- ${name}(${Object.entries(t.args).map(([a, r]) => `${a}${r.optional ? '?' : ''}${r.type === 'enum' ? `: ${r.values.join('|')}` : ''}`).join(', ')}): ${t.about}`).join('\n');

module.exports = { createTools, check, describe, MAX_TEXT };
