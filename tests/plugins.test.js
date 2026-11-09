'use strict';
// Plugins made without code (src/main/plugins.js): what's kept of one, what sets it off, its steps in order.
const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, summary, createEngine, TEMPLATES } = require('../src/main/actions/plugins');

test('clean: only what she can run, nothing more', () => {
  assert.equal(clean(null), null);
  assert.equal(clean({ name: 'x', when: { type: 'said', phrase: 'hi' }, do: [] }), null); // nothing to do
  assert.equal(clean({ name: 'x', when: { type: 'hack the planet' }, do: [{ type: 'say', text: 'hi' }] }), null);
  const p = clean({
    id: '../../etc', name: '  Morning\n routine  ', when: { type: 'time', at: '7:5' }, do: [{ type: 'say', text: 'hi' }],
  });
  assert.equal(p, null); // 7:5 isn't a time
  const q = clean({
    id: 'bad id!', name: 'Morning', when: { type: 'time', at: '7:05', days: [1, 9, 1, 'x', 5] },
    do: [{ type: 'say', text: 'Hi' }, { type: 'run', text: 'rm -rf' }, { type: 'wait', seconds: 99999 }, { type: 'move', move: 'fly' }, { type: 'move', move: 'dance' }],
    cooldown: -4,
  });
  assert.match(q.id, /^p[a-z0-9]+$/);
  assert.deepEqual(q.when, { type: 'time', at: '07:05', days: [1, 5] });
  assert.deepEqual(q.do, [{ type: 'say', text: 'Hi' }, { type: 'wait', seconds: 600 }, { type: 'move', move: 'dance' }]);
  assert.equal(q.cooldown, 0);
  assert.equal(q.on, true);
  for (const t of TEMPLATES) assert.ok(clean(t), t.name);
});

test('summary: its "when" in words', () => {
  assert.equal(summary(clean({ when: { type: 'time', at: '12:00', days: [1, 2, 3, 4, 5] }, do: [{ type: 'say', text: 'x' }] })), 'At 12:00, on weekdays');
  assert.equal(summary(clean({ when: { type: 'said', phrase: 'work mode' }, do: [{ type: 'say', text: 'x' }] })), 'When you say "work mode"');
  assert.equal(summary(clean({ when: { type: 'battery', below: 15 }, do: [{ type: 'say', text: 'x' }] })), 'When your battery drops below 15%');
});

function harness(plugins) {
  const said = [];
  const ran = [];
  const waits = [];
  const engine = createEngine({
    list: () => plugins,
    run: async (text, opts) => {
      ran.push([text, opts.fromPlugin]);
      return text === 'fail' ? { handled: false } : { handled: true, reply: `did ${text}`, emotion: 'happy', move: text === 'dance' ? 'dance' : undefined };
    },
    say: (evt) => said.push(evt),
    notify: (t) => said.push({ notify: t }),
    sleep: async (ms) => { waits.push(ms); },
    now: () => harness.t,
  });
  return { engine, said, ran, waits };
}
harness.t = 1e12;

test('said: its first lines for her answer, the rest after its wait', async () => {
  const p = clean({ id: 'morning', name: 'Morning', when: { type: 'said', phrase: 'Good morning!' },
    do: [{ type: 'say', text: 'Morning!' }, { type: 'command', text: 'play music' }, { type: 'wait', seconds: 3 }, { type: 'command', text: 'dance' }, { type: 'notify', text: 'up' }] });
  const { engine, said, ran, waits } = harness([p]);
  assert.equal(await engine.said('what a morning'), null);
  const res = await engine.said('good morning');
  assert.equal(res.reply, 'Morning! did play music');
  assert.equal(res.handled, true);
  await new Promise((r) => setTimeout(r, 10)); // the rest, in the background
  assert.deepEqual(ran, [['play music', true], ['dance', true]]);
  assert.deepEqual(waits, [3000]);
  assert.deepEqual(said.map((e) => e.text || e.notify), ['did dance', 'up']);
  assert.equal(said[0].move, 'dance');
});

test('said: "contains", cooldown, and a failed command ends it', async () => {
  const p = clean({ id: 'c1', name: 'C', when: { type: 'said', phrase: 'work mode', match: 'contains' }, do: [{ type: 'command', text: 'fail' }, { type: 'say', text: 'never' }], cooldown: 5 });
  const { engine } = harness([p]);
  const res = await engine.said('Capri, work mode please');
  assert.equal(res.reply, 'I couldn\'t do "fail".');
  const again = await engine.said('work mode');
  assert.equal(again.reply, ''); // cooling down: nothing done
  assert.equal(await engine.said('workmode'), null);
});

test('events: time (once a minute, its days), app, song, back, battery, start; off ones never', async () => {
  const say = (t) => ({ type: 'say', text: t });
  const plugins = [
    clean({ id: 'time1', when: { type: 'time', at: '07:30', days: [1] }, do: [say('time')] }), // Mondays
    clean({ id: 'app1', when: { type: 'app', app: 'code' }, do: [say('app')], cooldown: 0 }),
    clean({ id: 'song1', when: { type: 'song', artist: 'weeknd' }, do: [say('song')], cooldown: 0 }),
    clean({ id: 'back1', when: { type: 'back', minutes: 30 }, do: [say('back')] }),
    clean({ id: 'bat1', when: { type: 'battery', below: 20 }, do: [say('battery')] }),
    clean({ id: 'start1', when: { type: 'start' }, do: [say('start')] }),
    { ...clean({ id: 'off1', when: { type: 'start' }, do: [say('off')] }), on: false },
  ];
  const { engine, said } = harness(plugins);
  const monday = new Date(2026, 10, 2, 7, 30, 10); // Mon 2 Nov 2026
  engine.tick(monday);
  engine.tick(new Date(2026, 10, 2, 7, 30, 40)); // same minute: not again
  engine.tick(new Date(2026, 10, 3, 7, 30, 0)); // Tuesday: not its day
  engine.onApp('Visual Studio Code');
  engine.onApp('Notepad');
  engine.onSong({ title: 'Die For You', artist: 'The Weeknd' });
  engine.onSong({ title: 'Sorai', artist: 'Nadin Amizah' });
  engine.onBack(10);
  engine.onBack(45);
  engine.onBattery(50);
  engine.onBattery(19); // crossing below 20
  engine.onBattery(18); // already below: not again
  engine.onStart();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(said.map((e) => e.text), ['time', 'app', 'song', 'back', 'battery', 'start']);
});
