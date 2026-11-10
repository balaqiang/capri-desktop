// Her models and her opening: the curves everything moves on, what each piece does, her expressions, her speckles.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const { smoothSquare, pulse, damp } = await import('../src/renderer/js/waves.js');
const { roleOf, modelFor, partPose, closestOnBox, contactOf, faceOnEdge, pickPose, POSE_MODEL, Model, Rig, micBeside } = await import('../src/renderer/js/rig.js');
const { NEUTRAL, EXPRESSIONS, expressionFor, moodExpression, mix, blendToward, mouthWeights } = await import('../src/renderer/js/expressions.js');
const { step, flash, sparkShape, sparkTurn, assemble, hiLevel, OPENING, COMBOS, Opening } = await import('../src/renderer/js/opening.js');
const require = createRequire(import.meta.url);
const { inner, merge } = require('../scripts/build-rig.js');

test('the square wave holds at each end and never jumps', () => {
  assert.ok(smoothSquare(0.25, 1, 5) > 0.99);
  assert.ok(smoothSquare(0.75, 1, 5) < -0.99);
  assert.ok(Math.abs(smoothSquare(0, 1)) < 1e-9);
  let held = 0;
  for (let i = 0; i < 1000; i++) if (Math.abs(smoothSquare(i / 1000, 1, 5)) > 0.9) held++;
  assert.ok(held > 700, `held ${held}/1000`);
});

test('the default wave is softer than a hard one: smaller steps frame to frame', () => {
  const worst = (sharp) => {
    let w = 0;
    for (let i = 1; i < 1000; i++) w = Math.max(w, Math.abs(smoothSquare(i / 1000, 1, sharp) - smoothSquare((i - 1) / 1000, 1, sharp)));
    return w;
  };
  assert.ok(worst(1.8) < worst(5) * 0.6);
  assert.ok(worst(1.8) < 0.02);
});

test('a pulse stays in 0..1; damping never overshoots', () => {
  for (let t = 0; t < 8; t += 0.013) {
    const v = pulse(t, 4, 0.1);
    assert.ok(v >= 0 && v <= 1, String(v));
  }
  let x = 0;
  for (let i = 0; i < 200; i++) {
    const next = damp(x, 1, 0.1, 0.09);
    assert.ok(next >= x && next <= 1);
    x = next;
  }
  assert.ok(x > 0.99);
});

test('what each piece of your drawing does, from its name', () => {
  assert.deepStrictEqual(roleOf('eye-open-left'), { role: 'eyeOpen' });
  assert.deepStrictEqual(roleOf('mouth-open-frame2'), { role: 'mouth', frame: 2 });
  assert.deepStrictEqual(roleOf('hair-noise-frame1'), { role: 'hairFrame', frame: 1, noise: true });
  assert.deepStrictEqual(roleOf('body-noise'), { role: 'noise' });
  assert.strictEqual(roleOf('hiar-layer-1').role, 'hair', 'spelled your way');
  assert.strictEqual(roleOf('tangan-kiri').role, 'arm');
  assert.strictEqual(roleOf('kaki-right').role, 'leg');
  assert.strictEqual(roleOf('face-eye-bg').role, 'face');
});

test('which model for how she is', () => {
  const idle = { stance: 'stand', mode: 'idle' };
  assert.strictEqual(modelFor({ ...idle, dormant: true }), 'just-head');
  assert.strictEqual(modelFor({ ...idle, mode: 'sleep' }), 'lean-sleep');
  assert.strictEqual(modelFor({ ...idle, riding: true }), 'perch');
  assert.strictEqual(modelFor({ ...idle, stance: 'sit' }), 'sit');
  assert.strictEqual(modelFor(idle, 20), 'lean');
  assert.strictEqual(modelFor(idle, 3), null, 'not straight away');
  assert.strictEqual(modelFor(idle, 1, true), 'lean', 'talking or feeling something: a face that can show it');
  assert.strictEqual(modelFor({ ...idle, stance: 'sit', busy: true, form: 'glitch' }), 'sit', 'her glitch is drawn on the model she is in');
  assert.strictEqual(modelFor({ ...idle, stance: 'sit', busy: true, form: 'silhouette' }), 'sit');
  assert.strictEqual(modelFor({ ...idle, stance: 'sit', act: {} }), 'sit', 'an idle gesture does not blink a model out');
  assert.strictEqual(modelFor({ ...idle, act: {} }, 20), null, 'a gesture standing up is her standing body');
  for (const busy of [{ busy: true }, { dragging: true }, { walking: true }, { stowed: true }, { form: 'spark' }]) assert.strictEqual(modelFor({ ...idle, stance: 'sit', ...busy }, 20, true), null, JSON.stringify(busy));
});

test('every emotion is its own combination of eyes and mouth', () => {
  const shapes = Object.entries(EXPRESSIONS).filter(([k]) => k !== 'neutral').map(([, e]) => `${e.eyeY}|${e.eyeTilt}|${e.mouth}|${e.mouthY}`);
  assert.strictEqual(new Set(shapes).size, shapes.length);
  assert.ok(EXPRESSIONS.angry.eyeTilt > 0, 'brows down at the middle');
  assert.ok(EXPRESSIONS.sad.eyeTilt < 0, 'brows up at the middle');
  assert.ok(EXPRESSIONS.happy.mouth[2] > EXPRESSIONS.happy.mouth[0], 'happy: an open smile');
  assert.ok(EXPRESSIONS.angry.mouth[0] > 0.5, 'angry: teeth shut');
  assert.ok(EXPRESSIONS.surprised.mouth[3] > 0.5, 'surprised: wide open');
  assert.ok(EXPRESSIONS.bored.eyeY < 0.6, 'bored: half lidded');
  assert.strictEqual(expressionFor('annoyed'), EXPRESSIONS.angry, 'her tags reach them');
  assert.strictEqual(expressionFor('nonsense'), NEUTRAL);
  for (const e of Object.values(EXPRESSIONS)) assert.deepStrictEqual(Object.keys(e).sort(), Object.keys(NEUTRAL).sort());
});

test('going from one to another is a blend, never a cut', () => {
  let cur = EXPRESSIONS.happy;
  let last = cur.eyeTilt;
  for (let i = 0; i < 120; i++) {
    cur = blendToward(cur, EXPRESSIONS.angry, 1 / 60);
    assert.ok(cur.eyeTilt - last < 3, 'no jump');
    last = cur.eyeTilt;
  }
  assert.ok(Math.abs(cur.eyeTilt - EXPRESSIONS.angry.eyeTilt) < 0.2);
  assert.ok(Math.abs(mix(NEUTRAL, EXPRESSIONS.sad, 0.5).eyeTilt - EXPRESSIONS.sad.eyeTilt / 2) < 1e-9);
  assert.ok(moodExpression('irritable').eyeTilt > 0);
  assert.strictEqual(moodExpression('calm').eyeTilt, 0);
});

test('her mouth follows how loud she is', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  close(mouthWeights(0, [1, 0, 0, 0], 1)[0], 1);
  assert.strictEqual(mouthWeights(1, [1, 0, 0, 0], 1)[0], 0, 'talking: not closed');
  const avg = (level, i) => {
    let s = 0;
    for (let t = 0; t < 2; t += 0.011) s += mouthWeights(level, [1, 0, 0, 0], t)[i];
    return s / 182;
  };
  assert.ok(avg(0.15, 1) > avg(0.15, 3), 'quiet: small');
  assert.ok(avg(1, 3) > avg(1, 1), 'loud: wide');
  for (const level of [0, 0.05, 0.3, 0.7, 1]) close(mouthWeights(level, [0, 0, 1, 0], 0.7).reduce((a, b) => a + b, 0), 1);
  close(mouthWeights(0, EXPRESSIONS.happy.mouth, 1)[2], 1);
});

test('eyes and mouth in a pose', () => {
  const eye = (role, side) => ({ role, phase: 0, side });
  assert.strictEqual(partPose(eye('eyeClosed'), 2, { eyes: 'closed' }).alpha, 1);
  assert.strictEqual(partPose(eye('eyeOpen'), 2, { eyes: 'closed' }).alpha, 0);
  assert.ok(partPose(eye('eyeOpen'), 2).alpha > 0.95);
  assert.ok(partPose(eye('eyeClosed'), 4.3 * 3 + 0.09).alpha > 0.8, 'a blink now and then');
  const angry = { expr: EXPRESSIONS.angry };
  assert.ok(partPose(eye('eyeOpen', 1), 2, angry).shape.rot < 0 && partPose(eye('eyeOpen', -1), 2, angry).shape.rot > 0, 'mirrored: both inner corners down');
  assert.ok(partPose(eye('eyeOpen', 1), 2, { expr: EXPRESSIONS.bored }).shape.sy < 0.6);
  assert.strictEqual(partPose({ role: 'mouthRest' }, 1, { talk: 0 }).alpha, 1);
  assert.strictEqual(partPose({ role: 'mouth', frame: 1 }, 1, { talk: 0 }).alpha, 0);
  assert.strictEqual(partPose({ role: 'mouthRest' }, 1, { talk: 1 }).alpha, 0);
  for (let t = 0.05; t < 2; t += 0.17) {
    const sum = [1, 2, 3].reduce((a, frame) => a + partPose({ role: 'hairFrame', frame }, t).alpha, 0);
    assert.ok(sum > 0.8 && sum < 1.6, `hair frames overlap softly at ${t}: ${sum}`);
  }
  for (let t = 0; t < 6; t += 0.3) assert.ok(Math.abs(partPose({ role: 'arm', phase: 0.2 }, t).angle) <= 3.6);
  assert.deepStrictEqual(closestOnBox({ x: 10, y: 10, w: 20, h: 20 }, 0, 50), { x: 10, y: 30 });
});

test('each way of being on a window is its own drawing', () => {
  const on = (pose) => modelFor({ mode: 'idle', stance: 'sit', perch: { id: 1, dx: 90, pose } });
  assert.strictEqual(on('sit'), 'sit');
  assert.strictEqual(on(undefined), 'sit', 'an old perch still sits');
  for (const [pose, model] of Object.entries(POSE_MODEL)) assert.strictEqual(on(pose), model);
  assert.strictEqual(modelFor({ mode: 'sleep', stance: 'sit', perch: { id: 1, dx: 90, pose: 'cling' } }), 'lean-sleep', 'she naps wherever she is');
});

test('what touches the window lands on the window', () => {
  const face = { x: 50, y: 40, w: 20 };
  const parts = [{ name: 'body', box: { x: 40, y: 50, w: 20, h: 20 } }, { name: 'foot-left-layer-1', box: { x: 0, y: 60, w: 60, h: 20 } }];
  const contact = contactOf('sit', parts, face);
  assert.deepStrictEqual(contact, { x: 50, y: 80 });
  const at = faceOnEdge(contact, face, { x: 300, y: 200 }, 2);
  assert.deepStrictEqual(at, { x: 300, y: 120 });
  const off = faceOnEdge({ x: 70, y: 80 }, face, { x: 300, y: 200 }, 2, true);
  assert.strictEqual(off.x, 340, 'mirrored, the contact is on the other side of her face');
  assert.strictEqual(contactOf('opening', parts, face), null);
  assert.deepStrictEqual(contactOf('lean', [], face), { x: 50, y: 40 }, 'a piece renamed in your file does not break her');
});

test('poses are chosen by what is possible', () => {
  const kinds = (o) => new Set(Array.from({ length: 200 }, (_, i) => pickPose(i / 200, o).pose));
  assert.deepStrictEqual([...kinds({ work: true })], ['sit'], 'working, she pays attention');
  assert.ok(!kinds({ sides: [] }).has('cling'), 'no room to hang');
  assert.ok(kinds({ sides: ['left'] }).has('cling'));
  assert.ok(!kinds({ taskbar: true, sides: ['left'] }).has('cling'), 'the taskbar has no side');
  for (let r = 0; r < 1; r += 0.01) {
    const p = pickPose(r, { sides: ['left', 'right'] });
    if (p.pose === 'cling') assert.ok(['left', 'right'].includes(p.side));
  }
});

test('her standing body wears the colours of your drawings', () => {
  const sprite = fs.readFileSync(new URL('../src/renderer/js/sprite.js', import.meta.url), 'utf8');
  const was = { red: [255, 25, 87], green: [0, 243, 104], black: [11, 7, 22] };
  const now = { red: [255, 2, 65], green: [0, 255, 96], black: [1, 2, 8] };
  const tint = { red: [1, 0.08, 0.747], green: [1, 1.049, 0.923], black: [0.09, 0.286, 0.364] };
  for (const k of Object.keys(was)) {
    assert.ok(sprite.includes(`vec3(${tint[k].map((v) => (Number.isInteger(v) ? v.toFixed(1) : v)).join(', ')})`), k);
    was[k].forEach((v, i) => assert.ok(Math.abs(Math.min(255, v * tint[k][i]) - now[k][i]) <= 1, `${k} ${i}`));
  }
});

test('her mic sits beside her face in every drawing, never on it', () => {
  const m = { face: { w: 120 } };
  const size = 34;
  for (const x of [200, 900, 1890]) {
    const at = micBeside({ x, y: 400, k: 0.5, m }, 1920, size);
    const faceHalf = (m.face.w * 0.5) / 2;
    assert.ok(at.x >= x + faceHalf || at.x + size <= x - faceHalf, `${x}: ${at.x}`);
    assert.ok(at.x >= 0 && at.x + size <= 1920, 'and on the screen');
  }
  assert.strictEqual(micBeside({ x: 500, y: 5, k: 0.5, m }, 1920).y, 0);
});

test('you can take hold of her wherever your drawing shows her', () => {
  const alpha = new Uint8ClampedArray(100 * 100 * 4);
  alpha[(50 * 100 + 50) * 4 + 3] = 255;
  const m = Object.assign(Object.create(Model.prototype), { face: { x: 50, y: 50, w: 10 }, mask: { w: 100, h: 100, scale: 1, alpha } });
  const rig = Object.create(Rig.prototype);
  assert.strictEqual(rig.hit?.(0, 0) || false, false, 'no drawing shown');
  rig.shown = { m, x: 300, y: 200, k: 2, flip: false, clip: null };
  assert.ok(rig.hit(300, 200), 'on her');
  assert.ok(!rig.hit(360, 260), 'not on the empty part of the picture');
  rig.shown = { ...rig.shown, clip: 150 };
  assert.ok(!rig.hit(300, 200), 'nothing of her below the edge she is behind');
});

test('her layers stack as you set them', () => {
  const layers = (name) => [...fs.readFileSync(new URL(`../assets/capri/rig/${name}.svg`, import.meta.url), 'utf8').matchAll(/<g id="([^"]+)" data-order/g)].map((m) => m[1]);
  assert.deepStrictEqual(layers('sit').slice(0, 3), ['foot-left-layer-1', 'foot-right', 'foot-left-layer-2'], 'furthest back first');
  assert.strictEqual(layers('lean-sleep')[0], 'hair-back');
});

test('her opening waits until it is ready, and without its art she just arrives', async () => {
  let asked = 0;
  const rig = { h: 800, dpr: 1, playing: false, model: async () => { asked++; throw new Error('no art'); } };
  const op = new Opening(rig);
  await op.prepare().catch(() => {});
  await op.prepare().catch(() => {});
  assert.strictEqual(asked, 1, 'prepared once');
  await op.play({ to: { x: 0, y: 0 } });
  assert.strictEqual(rig.playing, false, 'nothing left half-started');
});

test('she appears whole, before the first bolt', () => {
  const m = { face: { x: 100 } };
  const piece = (role, x = 0) => ({ role, box: { x, w: 10 } });
  assert.strictEqual(assemble(piece('body'), COMBOS[0].at, m).alpha, 1);
  for (const role of ['body', 'arm', 'hair', 'face']) assert.strictEqual(assemble(piece(role), 0.3, m).alpha, 1, `${role}: no half-there pieces`);
  for (let i = 0; i < 37; i++) assert.strictEqual(sparkShape(COMBOS[0].at - 0.01, i).alpha, 0);
  assert.ok(assemble(piece('arm', 300), 0.05, m).angle > 0);
  assert.strictEqual(assemble(piece('arm', 300), 2, m).angle, 0, 'and ends where you drew it');
  assert.strictEqual(assemble(piece('hair'), 2, m).scale, 1);
});

test('a flash: on, a moment, off, nothing lingers', () => {
  assert.strictEqual(flash(0), 0);
  assert.strictEqual(flash(0.06), 1);
  assert.strictEqual(flash(0.3), 0);
  assert.strictEqual(flash(0.03, true), 1);
  assert.strictEqual(flash(0.1, true), 0, 'a big one flickers');
  assert.strictEqual(flash(0.14, true), 1);
  assert.strictEqual(flash(0.4, true), 0);
});

test('the spark comes in combinations: every layer once, never all of it', () => {
  const art = fs.readFileSync(new URL('../assets/capri/rig/spark.svg', import.meta.url), 'utf8');
  const n = art.match(/data-order=/g).length;
  const used = COMBOS.flatMap((c) => c.layers).sort((a, b) => a - b);
  assert.deepStrictEqual(used, Array.from({ length: n }, (_, i) => i), 'each layer of your file in one combination');
  COMBOS.forEach((c, i) => {
    assert.ok(c.layers.length >= 3, 'a combination, not a lone shape');
    if (i) assert.ok(c.at > COMBOS[i - 1].at);
  });
  for (let t = 0; t < OPENING.end; t += 0.008) {
    let lit = 0;
    for (let i = 0; i < n; i++) if (sparkShape(t, i).alpha > 0.5) lit++;
    assert.ok(lit <= 10, `${lit} layers on at ${t.toFixed(2)}`);
  }
  for (let i = 0; i < n; i++) assert.strictEqual(sparkShape(OPENING.hi, i).alpha, 0, 'and the screen is clear when she says hi');
  assert.ok(sparkTurn(n + 5).at >= COMBOS[0].at, 'a layer you add later still gets a turn');
});

test('the hi, and the order of things', () => {
  assert.strictEqual(hiLevel(OPENING.hi - 0.1), 0);
  assert.ok(hiLevel(OPENING.hi + 0.3) > 0.4);
  assert.strictEqual(hiLevel(OPENING.hi + 1), 0);
  assert.ok(OPENING.eyes < OPENING.climax && OPENING.climax < OPENING.hi && OPENING.hi < OPENING.dive && OPENING.dive < OPENING.end);
  assert.ok(Math.abs(step(1.5, 1, 2) - 0.5) < 1e-9);
});

test('pieces exported apart become one model, as you stacked them', () => {
  const piece = (body) => `<?xml version="1.0"?>\n<!-- Generator -->\n<svg id="Layer_1" viewBox="0 0 10 10">\n<rect id="capri-canvas" fill="none" width="10" height="10"/>\n${body}\n<g></g>\n</svg>`;
  const files = {
    'a.svg': piece('<radialGradient id="SVGID_1_"/><path fill="url(#SVGID_1_)" d="M0 0"/>'),
    'b.svg': piece('<radialGradient id="SVGID_1_"/><path fill="url(#SVGID_1_)" d="M1 1"/>'),
    'c.svg': piece('<g id="eye_0001_" display="none"><path d="M2 2"/></g>'),
  };
  const out = merge({ name: 'Capri-x', width: 10, height: 10, parts: [{ index: 0, file: 'a.svg', name: 'hair' }, { index: 1, file: 'b.svg', name: 'body' }, { index: 2, file: 'c.svg', name: '' }] }, (f) => files[f]);
  assert.ok(!/<\?xml|Generator|capri-canvas/.test(out));
  assert.ok(out.indexOf('id="layer-03"') < out.indexOf('id="body"') && out.indexOf('id="body"') < out.indexOf('id="hair"'), 'the top of your panel drawn last');
  assert.match(out, /id="hair" data-order="0"/);
  assert.match(out, /url\(#p1-SVGID_1_\)/, 'each piece keeps its own gradient');
  assert.ok(!/display="none"/.test(out), 'a hidden frame is still a frame');
  assert.strictEqual(inner('<svg></svg>', 'x'), '');
  assert.match(inner('<svg><path style="fill-rule:evenodd;clip-rule:evenodd;" d="M0 0"/></svg>', 'x'), /fill-rule="evenodd" clip-rule="evenodd"/);
});

test('every model goes through the same shader effects as her standing body', () => {
  const root = new URL('../', import.meta.url);
  const sprite = fs.readFileSync(new URL('src/renderer/js/sprite.js', root), 'utf8');
  const fx = fs.readFileSync(new URL('src/renderer/js/rigfx.js', root), 'utf8');
  for (const line of ['float star = step(0.976, hash(cell + 3.1)) * 0.85;', 'float tw = step(0.993, hash(cell + uSeed * 1.37));', 'c.rgb = mix(c.rgb, vec3(1.0, 0.95, 0.97), clamp((star + tw) * red * uSparkle, 0.0, 1.0));', 'col += uRim * rim;', 'hx = mix(hx, 0.968, red * 0.6 * uGrade);', 'float bh = mix(5.0, 26.0, hash(vec2(uGlitchSeed, 7.0)));', 'q.x += on * (hash(vec2(band + 3.0, uGlitchSeed)) - 0.5) * 72.0 * uGlitch;', 'col = mix(col, uSil.rgb * a, uSil.a);', 'col = vec3(cr.r, col.g, cb.b);', 'col += vec3(0.21, 1.0, 0.48) * e1;']) {
    assert.ok(sprite.includes(line) && fx.includes(line), line);
  }
  assert.ok(sprite.includes('gl.uniform3f(u.uRim, 0.48, 0.24, 1.0)') && fx.includes('RIM = [0.48, 0.24, 1.0]'), 'the same violet');
});

test('the webp intro is gone, her source art stays out of the installer', () => {
  const root = new URL('../', import.meta.url);
  const app = fs.readFileSync(new URL('src/renderer/js/app.js', root), 'utf8');
  const fx = fs.readFileSync(new URL('src/renderer/js/fx.js', root), 'utf8');
  assert.ok(!/intro-\$\{name\}\.webp|GRAB_FRAMES/.test(app));
  assert.ok(!/GRAB_FRAMES|prepareGrab|case 'intro'/.test(fx));
  assert.deepStrictEqual(fs.readdirSync(new URL('assets/capri/', root)).filter((f) => /^intro-.*\.webp$/.test(f)), []);
  for (const name of ['opening', 'spark', 'sit', 'lean', 'lean-sleep', 'perch', 'just-head']) assert.ok(fs.existsSync(new URL(`assets/capri/rig/${name}.svg`, root)), name);
  const pkg = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'));
  assert.ok(pkg.build.files.includes('!assets/CapriAdobe/**') && pkg.build.files.includes('!assets/CapriPremier/**'));
});
