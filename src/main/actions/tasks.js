'use strict';

// A job she's on, told as it goes: she says what she's about to do before she starts, what step she's on while she
// works, and it can be stopped. One at a time; something asked for inside a job (a step of several) is a step of it.
// Goes to her window as a `task` event: { phase: 'start' | 'step' | 'ask' | 'end', id, kind, title, line, index, total, ok }.

function createTasks({ emit, now = Date.now }) {
  let seq = 0;
  let current = null;
  let waiting = null; // a question she's waiting on: (yes) => void

  const send = (phase, extra = {}) => emit({ type: 'task', phase, id: current.id, kind: current.kind, title: current.title, total: current.total, ...extra });

  const tasks = {
    get current() { return current; },
    get signal() { return current?.abort.signal || null; },
    get stopped() { return Boolean(current?.abort.signal.aborted); },

    // -> the task, or null when one is going on already (this is then a step of it)
    begin({ kind, title = '', line = '', total = 0 }) {
      if (current) {
        tasks.step(title);
        return null;
      }
      current = { id: ++seq, kind, title: String(title).slice(0, 120), total, index: 0, at: now(), abort: new AbortController() };
      send('start', { line });
      return current;
    },

    step(label, index = 0) {
      if (!current) return;
      current.index = index || current.index + 1;
      send('step', { label: String(label).slice(0, 120), index: current.index });
    },

    // a yes or no from you in the middle of it (a step that can't be taken back). No answer in a minute is a no.
    ask(question, { timeout = 60000 } = {}) {
      if (!current) return Promise.resolve(false);
      send('ask', { question: String(question).slice(0, 200) });
      return new Promise((resolve) => {
        const done = (yes) => {
          clearTimeout(timer);
          current?.abort.signal.removeEventListener('abort', no);
          waiting = null;
          resolve(Boolean(yes));
        };
        const no = () => done(false);
        const timer = setTimeout(no, timeout);
        current.abort.signal.addEventListener('abort', no, { once: true });
        waiting = done;
      });
    },

    answer(yes) {
      if (!waiting) return false;
      waiting(yes);
      return true;
    },

    end({ ok = true } = {}) {
      if (!current) return;
      send('end', { ok, stopped: current.abort.signal.aborted, seconds: Math.round((now() - current.at) / 1000) });
      current = null;
    },

    // her Stop button
    cancel() {
      if (!current) return false;
      current.abort.abort();
      return true;
    },

    // fn as a job of hers: told before it starts, ended whatever happens
    async run(spec, fn) {
      const own = tasks.begin(spec);
      try {
        const res = await fn(own || current);
        if (own) tasks.end({ ok: Boolean(res?.handled ?? res?.ok ?? true) && !res?.denied });
        return res;
      } catch (err) {
        if (own) tasks.end({ ok: false });
        throw err;
      }
    },
  };
  return tasks;
}

// How long a promise is waited for once the job is stopped: not at all. -> its value, or `whenStopped`.
function orStopped(promise, signal, whenStopped = null) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(whenStopped);
  return Promise.race([promise, new Promise((resolve) => signal.addEventListener('abort', () => resolve(whenStopped), { once: true }))]);
}

module.exports = { createTasks, orStopped };
