import { Capri } from './capri.js';
import { FxLayer, GRAB_FRAMES } from './fx.js';
import { Chip, Mask } from './chip.js';
import { Panel } from './panel.js';
import { Voice } from './voice.js';
import { Brain } from './brain.js';
import { Guide } from './guide.js';
import { Mission } from './mission.js';
import { Chat } from './chat.js';
import { Setup } from './setup.js';
import { Custom } from './custom.js';
import { linesFor } from './lines.js';
import { pick, fmt, reducedMotion } from './util.js';
import { Ears } from './ears.js';
import { Mouth } from './tts.js';
import { Glitch } from './glitch.js';
import { Life } from './life.js';
import { Listening } from './listen.js';
import { loadLang, T } from './i18n.js';

const host = window.host;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// close-ups of her for the cut-ins, frames of the show (tools/build-cutins.py)
const CUTINS = ['grin', 'laugh', 'eyes', 'many', 'look'];
// and the art that came with Capri Desktop 2.4 (assets/art): her emotions, a stretch, a yawn
const ART_CUTINS = {
  happyface: 'happyface', eyesLeft: 'eyes-left', eyesGlitch: 'eyes-glitch', scream: 'scream', mouth: 'mouth',
  arms: 'arms', happy: 'happy', manyEyes: 'eyes-many', content: 'content', eyesRight: 'eyes-right',
};
const WATCH_MS = 2000; // how often she checks the pointer still reaches her

// what you made her, from the config (custom.js)
const mine = (cfg) => ({ userName: cfg.userName || '', persona: cfg.persona || '', myLines: cfg.myLines || [], memories: cfg.memories || [] });

async function boot() {
  const artNames = Object.keys(ART_CUTINS);
  const [art] = await Promise.all([
    Promise.all(artNames.map((name) => loadImage(`../../assets/art/${ART_CUTINS[name]}.png`).catch(() => null))),
    loadLang(host),
  ]);
  const [config, image, intro, ...cutins] = await Promise.all([
    host.getConfig(),
    loadImage('../../assets/capri/capri-full.png'),
    // her intro: her close-up grabbing the screen, and its drawings with her mouth and arm moving
    Promise.all(GRAB_FRAMES.map((name) => loadImage(`../../assets/capri/intro-${name}.webp`).catch(() => null)))
      // decoded now, not the first time each one shows up (a hitch right on "hi", on the wave)
      .then((cels) => Promise.all(cels.map((cel) => cel && createImageBitmap(cel))))
      .then((cels) => (cels[0] ? Object.fromEntries(GRAB_FRAMES.map((name, i) => [name, cels[i]])) : null)),
    ...CUTINS.map((name) => loadImage(`../../assets/capri/cutin-${name}.png`)),
    document.fonts.load('600 16px "Chakra Petch"'),
    document.fonts.load('400 11px "JetBrains Mono"'),
  ]);
  document.documentElement.lang = config.lang;
  let currentCfg = config; // her settings as they are now (the config changes below)
  // her animations: like Windows, full or reduced (her menu)
  const applyMotion = (setting) => {
    reducedMotion.setting = setting || 'auto';
    document.documentElement.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
  };
  applyMotion(config.motion);
  reducedMotion.onSystemChange(() => applyMotion(reducedMotion.setting));

  const fx = new FxLayer(document.getElementById('fx'), {
    cutins: {
      ...Object.fromEntries(CUTINS.map((name, i) => [name, cutins[i]])),
      ...Object.fromEntries(artNames.map((name, i) => [name, art[i]]).filter(([, img]) => img)),
    },
    intro,
  });
  fx.resize(innerWidth, innerHeight);
  // how far the top of the taskbar is from the bottom of her window: she covers it too while she
  // rests on it (the floor she stands on stays its top)
  let floorGap = config.floorGap ?? 0;
  const chip = new Chip(document.getElementById('chip'));
  chip.place(innerWidth, innerHeight - floorGap);
  const mask = new Mask(document.getElementById('mask'));

  const voice = new Voice();
  voice.configure(config);
  host.listSounds().then((list) => list.length && voice.loadCustom(list));
  const loadClips = () => host.listVoices().then((list) => voice.loadClips(list)).catch(() => 0);
  loadClips();
  host.onVoicesChanged(loadClips);

  const panel = new Panel({
    panel: document.getElementById('panel'),
    ticker: document.getElementById('ticker'),
    labels: linesFor(config.lang, config.assistant),
  });

  const capri = new Capri({
    root: document.getElementById('capri'),
    canvas: document.getElementById('sprite'),
    image,
    fx,
    voice,
  });
  capri.wander = config.wander;
  capri.possessWindows = config.possess;
  capri.restOn = config.rest || 'corner';
  capri.setView(innerWidth, innerHeight, innerHeight - floorGap);
  capri.setScale(config.scale);
  // her with your music: the song's words over her head, grooving, dancing, dozing off (listen.js)
  const listening = new Listening({ capri, fx, panel, voice, el: document.getElementById('lyric') });
  listening.configure(config);

  // from Capri Desktop 2.4: her mischief, her ears (the mic next to her), her voice out loud, her life
  const glitch = new Glitch(document.getElementById('glitch'));
  const micButton = document.getElementById('mic');
  const ears = new Ears({ host, button: micButton });
  const mouth = new Mouth({ host, voice });
  const mission = new Mission();
  const brain = new Brain({ capri, panel, voice, host, mission, lang: config.lang, assistant: config.assistant });

  // Click-through everywhere except on her body, the panel and her biochip.
  let interactive = false;
  let mouse = null;
  const setInteractive = (on) => {
    if (on === interactive) return;
    interactive = on;
    host.setInteractive(on);
    if (window.__hitLog) console.log('[hit] interactive', on, mouse && `${mouse.x},${mouse.y}`, Math.round(performance.now()));
  };
  const onChip = () => Boolean(chip.visible && mouse && chip.contains(mouse.x, mouse.y, 0));
  const refreshHit = () => {
    if (capri.dragging) return setInteractive(true);
    if (!mouse) return setInteractive(false);
    const r = panel.rect();
    const onPanel = r && mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
    document.body.style.cursor = onChip() ? 'pointer' : '';
    const onMic = !micButton.hidden && (() => {
      const m = micButton.getBoundingClientRect();
      return mouse.x >= m.left && mouse.x <= m.right && mouse.y >= m.top && mouse.y <= m.bottom;
    })();
    const onMask = mask.visible && mask.contains(mouse.x, mouse.y, 10);
    return setInteractive(Boolean(onPanel || capri.hit(mouse.x, mouse.y) || onChip() || onMic || onMask));
  };
  // Her biochip: her eyes on it follow the pointer over it, and she comes out when you click it
  // (only then, so the pointer passing through that corner doesn't call her back).
  // Her mask, asleep: the pointer coming over it stirs her, and a moment of that wakes her up.
  let wakeTimer = 0;
  const comeOut = () => {
    if (capri.stowed) host.setConfig({ visible: true }); // the tray and Ctrl+Alt+C follow
    capri.unstow();
  };
  const hoverChip = () => {
    chip.pointer = chip.visible && mouse && chip.contains(mouse.x, mouse.y) ? mouse : null;
    const near = mask.visible && mouse && mask.contains(mouse.x, mouse.y, 30);
    mask.pointer = near ? mouse : null;
    if (!near) {
      clearTimeout(wakeTimer);
      wakeTimer = 0;
    } else if (!wakeTimer) {
      wakeTimer = setTimeout(() => {
        wakeTimer = 0;
        if (capri.dormant) capri.wake();
      }, 400);
    }
  };
  let lastMove = 0;
  window.addEventListener('mousemove', (e) => {
    lastMove = performance.now();
    if (window.__hitLog) console.log('[hit] move', e.clientX, e.clientY, 'hit', capri.hit(e.clientX, e.clientY), Math.round(lastMove));
    mouse = { x: e.clientX, y: e.clientY };
    refreshHit();
    hoverChip();
    if (capri.riding) capri.rideTo(mouse.x, mouse.y);
  });
  document.addEventListener('mouseleave', () => {
    mouse = null;
    refreshHit();
    hoverChip();
  });
  // Where the pointer really is, every couple of seconds: if it moved over her window and no
  // mousemove came, the hook that brings it to her is gone (Windows drops it without a word, after
  // sleep say), and main.js puts in a new one.
  let seen = null;
  let rearmedAt = -Infinity;
  setInterval(async () => {
    const at = await host.cursor().catch(() => null);
    const before = seen;
    seen = at;
    if (!at?.inside) return;
    const now = performance.now();
    // the pointer is on her and she isn't clickable (its moves stopped reaching her): she is now
    if (!interactive && now - lastMove > WATCH_MS) {
      mouse = { x: at.x, y: at.y };
      refreshHit();
    }
    if (!before?.inside || (at.x === before.x && at.y === before.y)) return;
    if (now - lastMove < WATCH_MS * 1.5 || now - rearmedAt < 20000) return;
    rearmedAt = now;
    host.rearm();
  }, WATCH_MS);
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (chip.visible && chip.contains(e.clientX, e.clientY, 0)) host.openMenu();
  });
  window.addEventListener('click', (e) => {
    if (chip.visible && chip.contains(e.clientX, e.clientY, 0)) comeOut();
    else if (mask.visible && mask.contains(e.clientX, e.clientY, 10)) capri.wake({ release: true }); // asleep down to her mask: a click wakes her
  });
  // A panel (its buttons), her mask or her mic that came up under a pointer that isn't moving: Windows only
  // tells her window about the pointer when it moves, so without this a click went through to the desktop
  // ("Talk to me" did nothing) until you wiggled the mouse.
  setInterval(async () => {
    if (interactive || capri.dragging) return;
    const at = await host.cursor().catch(() => null);
    if (!at?.inside) return;
    const r = panel.rect();
    const m = !micButton.hidden && micButton.getBoundingClientRect();
    const under = (r && at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom)
      || capri.hit(at.x, at.y)
      || (mask.visible && mask.contains(at.x, at.y, 10))
      || (chip.visible && chip.contains(at.x, at.y, 0))
      || (m && at.x >= m.left && at.x <= m.right && at.y >= m.top && at.y <= m.bottom);
    if (window.__hitLog) console.log('[hit] poll', at.x, at.y, 'under', Boolean(under), 'hit', capri.hit(at.x, at.y), 'alpha', capri.p.alpha, 'hidden', capri.hidden);
    if (under) {
      mouse = { x: at.x, y: at.y };
      refreshHit();
    }
  }, 350);

  // wiring
  capri.onMove = (head) => {
    // pointing at something: the panel goes on her other side, so it doesn't cover it
    panel.setAnchor({ ...head, lean: capri.pointing ? -capri.pointing.dir : 0 }, capri.view);
    listening.place(head);
    // her mic rides by her head
    const side = head.x > innerWidth - 120 ? -1 : 1;
    micButton.style.transform = `translate(${Math.round(head.x + side * 70 * Math.max(0.6, capri.scale) - 17)}px, ${Math.round(head.y - 10)}px)`;
    // she may have moved out from under a still pointer: never leave a dead click zone behind
    refreshHit();
  };
  capri.onTeleport = (phase) => (phase === 'start' ? panel.suspend() : panel.resume());
  capri.chipAt = () => chip.center();
  capri.onStow = () => {
    chip.setMode(capri.mode);
    chip.show();
  };
  capri.onUnstow = () => chip.hide();
  capri.onDoze = (phase, face) => {
    if (phase === 'start') {
      mask.place(face.x, face.y, capri.scale * 1.1);
      mask.show();
    } else if (phase === 'waking') {
      mask.wake();
    } else {
      mask.hide();
    }
  };
  capri.onMode = (mode, prev) => {
    chip.setMode(mode, prev);
    if (mode === 'sleep') voice.say('sleep');
    else if (prev === 'sleep') voice.say('wake');
  };
  // her recorded lines when she sits or peeks
  capri.onStance = (stance) => {
    if (stance === 'sit' || stance === 'peek') voice.say(stance);
  };
  // perched on your cursor (2.4): the pointer's place, many times a second (its moves don't always reach
  // her window), and her menu knows to offer "Hop off"
  let rideTimer = 0;
  capri.onRide = (on) => {
    host.rideState(on);
    clearInterval(rideTimer);
    rideTimer = 0;
    if (!on) return;
    rideTimer = setInterval(async () => {
      const at = await host.cursor().catch(() => null);
      if (at) capri.rideTo(at.x, at.y);
    }, 33);
    panel.say({ kind: 'info', face: 'happy', badge: 'RIDE', line: T('Comfy! Shake me off, or {0} to hop off.').replace('{0}', currentCfg.hotkeys?.toggle?.replace(/Control/g, 'Ctrl') || 'Ctrl+Alt+C'), hold: 4500 });
  };
  // a double-click on her: a spin. (It used to put her on your cursor, where clicks go through her: closing tabs
  // fast under her, that's a double-click, and she was stuck there. Now it's "sit on my cursor", or her menu.)
  capri.onDoubleClick = () => {
    capri.gesture('spin');
  };
  // now and then she says something about the satellite: while she looks at it, or once
  // the red light has gone up (never during, nothing should cover that)
  capri.onGaze = (when) => {
    const lines = when === 'end' ? brain.t.uplink : brain.t.gaze;
    if (!panel.visible && Math.random() < (when === 'end' ? 0.6 : 0.4)) panel.say({ kind: 'info', line: pick(lines), hold: 3800 });
    if (when !== 'end') voice.say('look');
  };
  capri.onClick = () => {
    if (panel.visible) panel.hide();
    else brain.status();
    if (Math.random() < 0.25) voice.say('click');
  };
  // what your hand did to her (thrown, thrown into the floor, shaken): a word about it, in her face
  const HANDLED = {
    thrown: { face: 'happy', emotion: 'happy', chance: 0.45, lines: ['Wheee!', 'Again! Again!', 'Rude. But fun.'] },
    crash: { face: 'annoyed', emotion: 'annoyed', chance: 1, lines: ["Ow. That was on purpose, wasn't it?", 'My pixels! You scattered my pixels.', "Rude. We're filing a complaint."] },
    shaken: { face: 'annoyed', emotion: 'annoyed', chance: 0.8, lines: ['Whoa! Too fast, choom!', 'Hey! I was sitting there!', 'Rude. Drive slower.'] },
    dizzy: { face: 'glitch', emotion: 'glitch', chance: 1, lines: ["Stop shaking us… everything's spinning.", 'Whoa, whoa… which one of you is the real cursor?', 'All of us in here are seasick now. Thanks.'] },
  };
  capri.onHandled = (what) => {
    if (what === 'grabbed') chat.motion.sign('grab'); // picked up right after a move of hers: too much
    const h = HANDLED[what];
    if (!h || Math.random() > h.chance) return;
    const line = T(pick(h.lines));
    panel.say({ kind: 'info', face: h.face, badge: 'CAPRI', line, hold: 3800 });
    life.speak(line, h.emotion);
  };
  panel.onChar = (kind) => voice.play('blip', { mood: kind });
  panel.onTalk = (talking) => talking && capri.perform('talk');
  capri.onMenu = () => host.openMenu();

  // Her guide (guide.js): her welcome on first launch, and "How does it work?" in her menu,
  // where she takes you to things and points at them.
  const guide = new Guide({ capri, panel, voice, host, brain });
  // Talking to her (chat.js): "Talk to her" in her menu, or the button when you click her idle.
  const chat = new Chat({ capri, panel, voice, host, brain });
  brain.onTalk = () => chat.start();
  const life = new Life({ capri, panel, voice, host, brain, fx, glitch, mouth });
  capri.onPet = (phase, n) => {
    life.pet(phase, n);
    if (phase === 'start') chat.motion.sign('pet'); // her last move went over well
  };
  // a move her AI asked for in its answer ([[move: wave]]): played on her rig
  chat.onAct = (name, amp) => capri.gesture(name, { amp });
  chat.onMove = async (move) => {
    // game mode, focus mode, quiet mode: down to her mask until you call her (her chat closes after her answer)
    if (move.startsWith('hold-')) {
      if (move === 'hold-off') capri.release();
      else {
        // her line first ("Game mode. Click my mask…"), then she comes apart
        const reason = move.slice(5);
        capri.setHold(reason);
        setTimeout(() => {
          if (capri.hold !== reason) return; // called back meanwhile
          if (chat.open) chat.close();
          capri.holdIn(reason);
        }, 2600);
      }
      return;
    }
    if (capri.hold) capri.release(); // a move you asked for: she's out of her mask for it
    if (capri.stowed && move !== 'hide') {
      host.setConfig({ visible: true });
      await capri.unstow();
    }
    switch (move) {
      case 'left': case 'right': case 'center':
        capri.goTo(move);
        break;
      case 'here': // "where are you?": she comes to your pointer, asleep or put away included
        if (capri.dormant) capri.wake({ release: true });
      // falls through
      case 'cursor': {
        if (capri.riding) break;
        const at = await host.cursor().catch(() => null);
        if (at) await capri.summon(at);
        break;
      }
      case 'ride': capri.startRide(); break;
      case 'unride': capri.stopRide(); break;
      case 'home': if (capri.riding) capri.stopRide(); capri.goHome(); break;
      case 'taskbar':
        if (capri.riding) capri.stopRide();
        capri.sitOn({ win: capri.ledge(), dx: Math.min(Math.max(capri.pos.x, 200), capri.view.w - 200) });
        break;
      case 'top': if (!capri.riding) capri.peek('top'); break;
      case 'hide':
        if (capri.riding) capri.stopRide();
        host.setConfig({ visible: false });
        capri.stow();
        break;
      case 'show': break; // she's out already (above)
      case 'sleep': capri.setMode('sleep'); break;
      case 'wake': capri.wake({ release: true }); break;
      case 'dance': capri.gesture('dance') || capri.perform('spin'); break;
      case 'wave': capri.gesture('wave'); break;
      case 'bow': capri.gesture('bow'); break;
      case 'stay': host.setConfig({ wander: false }); break;
      case 'wander': host.setConfig({ wander: true }); capri.walkTo(capri.spot('random').x); break;
      case 'walk': capri.walkTo(capri.spot('random').x); break;
      default: break;
    }
  };
  // she asked you to play or talk, and you said yes
  life.onMove = (move) => chat.onMove(move); // a plugin's move (main/plugins.js)
  capri.onHold = (reason) => host.lifeHold?.(reason); // her main process keeps quiet while she's held
  life.onInvite = (what) => (what === 'game' ? chat.hear(pick(['main suit', 'tebak angka'])) : chat.start());
  chat.onPoint = async ({ label }, fgBefore) => {
    const front = () => capri.windows.wins.find((w) => w.id === capri.windows.fg) || null;
    const win = (await guide.until(() => (capri.windows.fg !== fgBefore ? front() : null), 3500)) || front();
    if (!win || !capri.canPoint(win)) return;
    await capri.pointAt(win, { label: label || '' });
    setTimeout(() => { if (capri.pointing) capri.stopPointing(); }, 9000);
  };
  chat.onEmotion = (emotion, opts) => life.react(emotion, opts);
  chat.onAnswered = (text, emotion) => {
    ears.follow(); // a moment where her name isn't needed
    if (currentCfg.tts) life.speak(text, emotion, { answer: true });
    else voice.say('reply');
  };
  mouth.onSpeaking = (on) => ears.setSpeaking(on);
  // her lips (and a little of her body) on her real voice
  let lastTalk = 0;
  mouth.onLevel = (level) => {
    panel.lipSync(level);
    const now = performance.now();
    if (level > 0.06 && now - lastTalk > 700 && !capri.busy && !capri.act) {
      lastTalk = now;
      capri.perform('talk');
    }
  };
  // her voice engine failed (a key, a server down): said once in a while, not on every line
  let lastVoiceError = -Infinity;
  mouth.onError = ({ error }) => {
    if (performance.now() - lastVoiceError < 120000) return;
    lastVoiceError = performance.now();
    panel.say({
      kind: 'info', face: 'annoyed', badge: 'VOICE', line: T('My voice engine failed. Settings, Voice.'), quote: String(error || '').slice(0, 160), hold: 7000,
      actions: [{ id: 'settings', label: T('Settings…'), primary: true }], onAction: () => { panel.hide(); host.openSettings('voice'); },
    });
  };
  ears.onHeard = (text, info) => chat.hear(text, info);
  ears.onError = (code, detail) => {
    const lines = {
      nomic: "I can't hear any sound at all. Pick your microphone in Settings, Voice.",
      noears: 'I have no ears yet! Settings, Voice: download better ears, or add a Groq key.',
      failed: "I couldn't make that out. Say it again?",
      silent: "Didn't hear anything.",
    };
    if (code === 'silent' && panel.visible) return;
    panel.say({
      kind: 'info', face: code === 'silent' ? 'bored' : 'annoyed', badge: 'MIC', line: T(lines[code] || lines.failed),
      quote: code === 'failed' || code === 'nomic' ? detail || '' : '', hold: code === 'silent' ? 2500 : 7000,
      ...(code === 'nomic' || code === 'noears' ? { actions: [{ id: 'settings', label: T('Settings…'), primary: true }], onAction: () => { panel.hide(); host.openSettings('voice'); } } : {}),
    });
  };
  host.onLife((evt) => {
    life.onEvent(evt);
    listening.onEvent(evt);
  });
  host.songNow().then((now) => listening.restore(now)).catch(() => {});
  const configureLife = (cfg) => {
    chat.configure(cfg);
    life.configure(cfg);
    listening.configure(cfg);
    mouth.configure(cfg);
    ears.configure(cfg);
  };
  configureLife(config);
  // Getting her chat going with buttons (setup.js): Ollama and a model, a key, or an address
  const setup = new Setup({ guide, panel, host, brain, capri, voice });
  guide.setup = setup;
  guide.onTalk = () => chat.start();
  chat.onSetup = (status) => setup.chat(status);
  chat.onBetterModel = () => setup.better();
  setup.onReady = () => chat.start();
  // What she calls you, how she is, your lines, what she remembers (custom.js)
  const custom = new Custom({ guide, host, brain, capri, voice });
  guide.custom = custom;
  brain.custom = mine(config);
  // the first Claude Code event that ever reaches her: so you know it worked
  brain.linked = config.linked;
  brain.watching = config.claude !== false;
  brain.onLinked = () => {
    host.setConfig({ linked: true, welcomed: true });
    voice.play('hello');
    capri.perform('hop');
    panel.say({ kind: 'done', badge: 'LINK', line: brain.t.welcome.linked, hold: 6000 });
  };

  // The demo's second half, after its fake Claude session: everything she does on her own, one
  // after the other, a line before each.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (done, max = 15000) => {
    for (const t0 = Date.now(); !done() && Date.now() - t0 < max;) await wait(100);
  };
  const free = () => !capri.busy && !capri.act && capri.stance !== 'fall';
  brain.onShowcase = async () => {
    const t = brain.t.showcase;
    const caption = (line) => panel.say({ kind: 'info', line, hold: 2200 });
    capri.nextMove = capri.nextGaze = performance.now() + 120000; // nothing of her own in between
    if (capri.stowed) await capri.unstow();
    if (capri.dormant) capri.wake({ release: true });
    await until(free);
    panel.hide();

    caption(t.minds);
    await wait(1000);
    await capri.perform('split');
    await wait(900);

    caption(t.zap);
    await wait(1000);
    const h = capri.head();
    capri.zap(h.x + capri.towardCenter() * 280, h.y - 170);
    await wait(1800);

    panel.hide();
    if (capri.gaze({ big: true })) await until(() => !capri.sky);
    await wait(2500);

    // a little terminal opens for her to take over, and closes under her once she's done with it
    if (capri.possessWindows && (await host.demoWindow(true))) {
      const top = () => capri.windows.wins.find((w) => capri.canSit(w)); // it opens on top of everything
      await until(top, 4000);
      const win = top();
      const seat = win && { win, dx: win.w * 0.4 };
      if (seat) {
        panel.hide();
        await capri.sitOn(seat);
        await until(free);
        caption(t.possess);
        await wait(1400);
        panel.hide();
        await capri.possess();
        await wait(1800);
      }
      host.demoWindow(false);
      await wait(400);
      await until(free); // she may have fallen off it
      await wait(900);
    }

    caption(t.sleep);
    await wait(1400);
    panel.hide();
    capri.setMode('sleep');
    await wait(2500); // dozing off
    await capri.doze();
    await wait(4500);
    capri.wake({ release: true });
    await until(free);
    await wait(1200);

    caption(t.chip);
    await wait(1600);
    panel.hide();
    await capri.stow();
    await wait(3500);
    await capri.unstow();
    await wait(600);
    panel.say({ kind: 'info', line: t.end, hold: 5000 });
  };

  host.onClaudeEvent((evt) => brain.handle(evt));
  host.onWindows((data) => {
    capri.setWindows(data);
    brain.onWindows(data);
  });
  // the windows as they are now: the watcher only speaks again when something changes
  host.windowsNow().then((data) => data && capri.setWindows(data));

  host.onResize(({ width, height, gap = 0 }) => {
    floorGap = gap;
    fx.resize(width, height);
    chip.place(width, height - gap);
    capri.setView(width, height, height - gap);
  });
  window.addEventListener('resize', () => {
    fx.resize(innerWidth, innerHeight);
    chip.place(innerWidth, innerHeight - floorGap);
    capri.setView(innerWidth, innerHeight, innerHeight - floorGap);
  });

  host.onConfig(async (cfg) => {
    voice.configure(cfg);
    if (cfg.lang !== brain.lang) await loadLang(host);
    currentCfg = cfg;
    configureLife(cfg);
    capri.wander = cfg.wander;
    capri.possessWindows = cfg.possess;
    capri.restOn = cfg.rest || 'corner';
    applyMotion(cfg.motion);
    if ((cfg.claude === false && brain.watching) || cfg.assistant !== brain.assistant) {
      guide.answer(null);
      panel.hide();
      capri.stopPointing();
      brain.replyFor = null;
      brain.linked = cfg.linked;
      // no longer watching Claude Code: whatever it was in the middle of is no business of hers
      brain.sessions.clear();
      panel.setTicker(null);
      if (capri.mode === 'work' || capri.mode === 'alert') capri.setMode('idle');
    }
    brain.watching = cfg.claude !== false;
    brain.custom = mine(cfg);
    brain.assistant = cfg.assistant;
    panel.labels = linesFor(cfg.lang, cfg.assistant);
    if (cfg.scale !== capri.scale) capri.setScale(cfg.scale);
    if (cfg.lang !== brain.lang) {
      brain.lang = cfg.lang;
      panel.labels = linesFor(cfg.lang, cfg.assistant);
      document.documentElement.lang = cfg.lang;
    }
  });

  host.onCommand(async (cmd) => {
    const t = brain.t;
    switch (cmd.name) {
      case 'aiMove': // --dev: one of the moves her AI can ask for ([[move: …]])
        console.log('[act]', cmd.move, capri.gesture(cmd.move));
        break;
      case 'hitLog': // --dev: log the click-through switching
        window.__hitLog = Boolean(cmd.on);
        break;
      case 'state': // --dev: where she is and what she's doing, in the log
        console.log('[state]', JSON.stringify({
          pos: { x: Math.round(capri.pos.x), y: Math.round(capri.pos.y) }, floor: capri.floor, stance: capri.stance,
          busy: capri.busy, dragging: capri.dragging, flight: Boolean(capri.flight), alpha: capri.p.alpha, hidden: capri.hidden,
          interactive, lastMoveAgo: Math.round(performance.now() - lastMove), riding: capri.riding,
        }));
        break;
      case 'fx': { // --dev: { what: 'poke' | 'eyes' | 'whoosh' | 'land' }: her elastic body and its sparks, acted out
        const h = capri.head();
        if (cmd.what === 'eyes') capri.manyEyes();
        else if (cmd.what === 'whoosh') { capri.nextWhoosh = 0; capri.whoosh(h.x, h.y - 20, 2400, 0); }
        else if (cmd.what === 'land') capri.boing({ squash: -3.5, mane: 1.5 });
        else if (cmd.what === 'hack') { // her show on the biggest window, 3 s, nothing typed (the keyboard isn't touched)
          const win = [...capri.windows.wins].sort((a, b) => b.w * b.h - a.w * a.h)[0];
          const show = win && capri.hack(win.id);
          setTimeout(() => show?.end(true), 3000);
        }
        else capri.poke(h.x + 30, h.y);
        break;
      }
      case 'music': // --dev: her with the music, in the log (the line's number and length, not its words); { verdict, doze (a sigh now) } to act one out
        // (not 'listen': that's Ctrl+Alt+V, push to talk, below)
        if (cmd.verdict) listening.judged(listening.song, cmd.verdict);
        if (cmd.doze) listening.sighAt = 1;
        console.log('[listen]', JSON.stringify({
          song: Boolean(listening.song), playing: listening.playing, pos: Math.round(listening.position() * 10) / 10, verdict: listening.verdict,
          lines: listening.words.song === listening.song ? listening.words.lines?.length || 0 : -1, shown: listening.shown,
          shownChars: listening.el.hidden ? 0 : listening.lineEl.textContent.length, groove: capri.groove, mode: capri.mode, hearing: capri.hearing,
          base: capri.base?.name, lyricBox: listening.el.hidden ? null : listening.el.style.transform,
        }));
        break;
      case 'teleport': // --dev: { x, y } where to (her feet), else somewhere
        capri.teleport(cmd.x != null ? { x: cmd.x, y: cmd.y ?? capri.floor } : capri.spot('random'));
        break;
      case 'status':
        brain.status();
        break;
      case 'customize': // "Make her yours" in her menu
        custom.open();
        break;
      case 'setupChat': // "Set it up with her" in her menu's AI model
        setup.chat();
        break;
      case 'setupKey': // "API key or address" in her menu's AI model, or a service picked there that needs one
        setup.key();
        break;
      case 'setupFree': // --dev: Claude Code (or Codex) through Ollama
        setup.free();
        break;
      case 'setupStep': // --dev: one step of her setup on its own (pickModel, pull, pickKeyed, address…)
        guide.scene(() => setup[cmd.step]?.(...(cmd.args || [])));
        break;
      case 'rearmed': // a new mouse hook (main.js): click-through until the pointer comes over her again
        if (window.__hitLog) console.log('[hit] rearmed', Math.round(performance.now()));
        interactive = false; // main.js has just made her window click-through: what she thinks follows
        mouse = null;
        refreshHit(); // (being dragged, she takes the pointer right back)
        break;
      case 'rearm': // --dev: as if she'd noticed the pointer no longer reaches her
        host.rearm();
        break;
      case 'loseGl': { // --dev: as if the GPU had been reset (waking from sleep): she goes, then comes back
        const lose = capri.sprite.gl.getExtension('WEBGL_lose_context');
        lose?.loseContext();
        setTimeout(() => lose?.restoreContext(), cmd.ms ?? 1500);
        break;
      }
      case 'answer': { // --dev: as if that button of her panel had been clicked (her chat's too)
        const button = document.querySelector(`.panel__action[data-id="${CSS.escape(cmd.id)}"]`);
        if (button) button.click();
        else guide.answer(cmd.id);
        break;
      }
      case 'assistantChanged': // Claude Code, Codex or Antigravity, picked in her menu
        guide.welcome();
        break;
      case 'welcome': // "How does it work?" in her menu
        guide.menu();
        break;
      case 'forget': // "Forget our conversations" in her menu, maybe with her chat open
        chat.history = [];
        break;
      case 'chat': // "Talk to her" in her menu
        chat.start();
        break;
      case 'listen': // Ctrl+Alt+V, or her menu › Voice: she listens (push), or a click of her name (hands-free)
        if (ears.mode === 'off') {
          panel.say({ kind: 'info', face: 'annoyed', badge: 'MIC', line: T("My ears are switched off! Settings, Voice."), hold: 6000, actions: [{ id: 'settings', label: T('Settings…'), primary: true }], onAction: () => { panel.hide(); host.openSettings('voice'); } });
          break;
        }
        if (capri.stowed) {
          host.setConfig({ visible: true });
          await capri.unstow();
        }
        capri.wake({ release: true });
        ears.toggle();
        break;
      case 'look': // Ctrl+Alt+L, or her menu: one look at your screen
        if (capri.stowed) {
          host.setConfig({ visible: true });
          await capri.unstow();
        }
        capri.wake({ release: true });
        chat.look();
        break;
      case 'dare': { // her menu › Dare me now
        if (capri.stowed) await capri.unstow();
        capri.wake({ release: true });
        const dare = await host.dare().catch(() => null);
        if (dare) {
          panel.say({ kind: 'info', face: 'happy', badge: 'DARE', line: dare, hold: 10000 });
          life.react('happy');
          life.speak(dare, 'happy');
        }
        break;
      }
      case 'glitch': // her menu › Mischief, or a test from her settings
        life.mischief({ kind: Number.isInteger(cmd.kind) ? cmd.kind : null, note: cmd.note ?? null });
        break;
      case 'game': // her menu › Play a game: like saying it ("main suit")
        chat.hear(cmd.text || 'main suit');
        break;
      case 'stopGlitch': // Ctrl+Alt+C stops a glitch at once
        glitch.stop();
        break;
      case 'ride': // her menu › Perch on cursor (or a double-click on her)
        if (capri.stowed) {
          host.setConfig({ visible: true });
          await capri.unstow();
        }
        panel.hide();
        capri.startRide();
        break;
      case 'hopOff': // Ctrl+Alt+C, or her menu, while she rides your cursor
        capri.stopRide();
        break;
      case 'voiceSample': { // her menu › Voice › Play a sample: one of her recorded lines
        await loadClips();
        const have = [...voice.clips.keys()];
        if (!have.length || currentCfg.muted) {
          panel.say({
            kind: 'info', face: 'bored', badge: 'VOICE', hold: 7000,
            line: T(currentCfg.muted ? "I'm muted." : 'I have no voice yet. Open the voice folder to give me one.'),
            ...(!currentCfg.muted && { actions: [{ id: 'voice', label: T('Settings…'), primary: true }], onAction: () => { panel.hide(); host.openSettings('voice'); } }),
          });
          break;
        }
        voice.say(pick(have), { force: true });
        capri.perform('talk');
        break;
      }
      case 'speak': // her settings › Voice › test
        mouth.speak(cmd.text || T("Hi! It's me! I live here now!"), { force: true, emotion: cmd.emotion || 'happy' });
        break;
      case 'report': // "Mission report" in her menu
        if (capri.stowed) {
          host.setConfig({ visible: true });
          await capri.unstow();
        }
        capri.wake({ release: true });
        if (brain.report()) capri.perform('curious', capri.towardCenter());
        break;
      case 'fakeClaude': { // --dev: the topmost window (the test window) is where a prompt was typed, and you're elsewhere
        const win = capri.windows.wins[0];
        if (win) {
          brain.sessions.set('dev', { id: 'dev', project: 'dev', taskStart: Date.now(), count: 0, files: new Set(), log: [], working: true, waiting: false, window: win.id, seen: Date.now() });
          capri.windows = { ...capri.windows, fg: -1 };
        }
        break;
      }
      case 'guide': // --dev: one topic of her guide (welcome, menu, connect, icon, claude, folder)
        if (cmd.topic === 'welcome') guide.welcome();
        else if (cmd.topic === 'menu') guide.menu();
        else if (typeof guide[cmd.topic] === 'function') guide.scene(() => guide[cmd.topic]());
        break;
      case 'stow': // Ctrl+Alt+C: into her biochip, or back out
        if (cmd.on) capri.stow();
        else capri.unstow();
        break;
      case 'satellite': // the whole sequence, on demand (tray)
        if (capri.stowed) {
          host.setConfig({ visible: true });
          await capri.unstow();
        }
        capri.wake({ release: true });
        if (capri.stance === 'peek') await capri.unpeek();
        if (!capri.gaze({ big: true })) setTimeout(() => capri.gaze({ big: true }), 1500);
        break;
      case 'hooks':
        if (cmd.ok) panel.say({ kind: 'info', line: cmd.action === 'install' ? t.hooksOk : t.hooksRemoved, hold: 6000 });
        else panel.say({ kind: 'error', line: fmt(t.hooksFail, { error: cmd.error }), hold: 9000 });
        break;
      // --dev helpers
      case 'intro': // her intro again, as when she starts (still: as with Windows' animations off)
        panel.hide();
        await capri.intro(capri.spot('post'), cmd.still ? { still: true } : {});
        break;
      case 'pose':
        capri.debug = cmd.params || null;
        if (cmd.still) capri.nextMove = capri.nextGaze = Infinity; // no wandering off mid-test
        if (cmd.hush) {
          panel.setTicker(null);
          panel.hide();
        }
        if (cmd.scale) capri.setScale(cmd.scale);
        if (cmd.stance) capri.setStance(cmd.stance, cmd);
        if (cmd.at) capri.pos = cmd.at;
        if (cmd.facing) capri.facing = cmd.facing;
        capri.drawFrame();
        break;
      case 'config': // a setting, as if changed from her menu
        host.setConfig(cmd.patch || {});
        break;
      case 'focus': // as if window `fg` had come to the front
        capri.windows = { ...capri.windows, fg: cmd.fg };
        brain.onWindows(capri.windows);
        break;
      case 'freeze':
        capri.hidden = Boolean(cmd.on);
        break;
      case 'act':
        // behaviours by method name (gaze, celebrate, hurt, shed, peek, fall, wanderStep...) or acts by name
        if (cmd.act === 'sit') {
          // pile: n-th window she could sit on from the top of the pile (0: the --dev test window
          // opened last), instead of the usual choice
          const top = cmd.pile !== undefined && capri.windows.wins.filter((w) => capri.canSit(w))[cmd.pile];
          const seat = top ? { win: top, dx: top.w * 0.4 } : capri.pickSeat();
          if (seat) capri.sitOn(seat);
        } else if (typeof capri[cmd.act] === 'function') capri[cmd.act](...(cmd.args || []));
        else capri.perform(cmd.act, cmd.dir || 0);
        break;
      default:
        break;
    }
  });

  // entrance: her face big in the corner says hi, then she dives down to her spot
  // (put away last time: she starts in her biochip)
  if (config.visible === false) capri.stowNow();
  else if (intro) await capri.intro(capri.spot('post'));
  else await capri.materialize(capri.spot('post'));
  // Windows has its animations off and she's following it: she barely moves. The first time, she
  // says so and asks whether to move anyway (her menu › Animations changes it later).
  if (reducedMotion.setting === 'auto' && reducedMotion.system && !config.motionAsked) {
    const m = brain.t.motion;
    await new Promise((done) => {
      const asked = panel.say({
        kind: 'info',
        face: 'aside',
        guide: true,
        line: m.line,
        quote: m.quote,
        actions: [{ id: 'full', label: m.full, primary: true }, { id: 'reduced', label: m.still }],
        onAction: (id) => {
          host.setConfig({ motion: id, motionAsked: true });
          panel.hide();
          if (id === 'full') capri.perform('hop');
        },
        onLeave: done,
        hold: null,
      });
      if (!asked) done();
    });
  }
  const hooks = await host.hooksStatus();
  // her welcome: the first time, or while she's meant to watch Claude Code and isn't plugged into it
  if (!config.welcomed || (config.claude && !hooks.installed)) guide.welcome();
  else if (!config.seenMerge) {
    host.setConfig({ seenMerge: true });
    panel.say({
      kind: 'info', face: 'happy', badge: 'v0.5', guide: true,
      line: T("New tricks! I can hear you now, run errands, dare you, and glitch your screen."),
      quote: T('Ctrl+Alt+S: my settings (who I am, who you are, my voice). Ctrl+Alt+V: talk to me. Ctrl+Alt+L: I look at your screen.'),
      actions: [{ id: 'settings', label: T('Settings…'), primary: true }, { id: 'ok', label: 'OK' }],
      onAction: (id) => { panel.hide(); if (id === 'settings') host.openSettings(); },
      hold: 20000,
    });
  } else panel.say({ kind: 'info', line: brain.onlineLine(), hold: 4000 });
  setTimeout(() => voice.say('hello'), 600);

  // In the evening, after a real day's work, she brings you her report card once, on her own,
  // at a quiet moment.
  setInterval(() => {
    const day = mission.day;
    const quiet = !brain.busySessions.length && !panel.visible && !guide.running && !capri.busy && !capri.act;
    if (new Date().getHours() < 18 || day.reported || day.missions < 3 || !quiet) return;
    if (capri.stowed || capri.dormant || capri.mode === 'sleep') return;
    if (brain.report()) {
      mission.markReported();
      capri.perform('curious', capri.towardCenter());
    }
  }, 60000);
}

boot().catch((err) => {
  console.error('[capri] boot failed', err);
});
