// Capri showing you around her settings, section by section. What she's talking about stays lit and works as usual: point at any setting in
// it and she explains that one; change one and she notices. Her desktop self comes and sits on this window for it (app.js settingsTour).

import { TOUR_STEPS } from './tour-steps.js';

const REACTIONS = ['Saved already. You never have to press save here.', 'There. It works right away.', 'Noted. You can always change it back.'];

export class Tour {
  // T: her translations. go(page): open a page. main: the scrolling area. send(phase, extra): tells her desktop self. onDone: tour ended.
  constructor({ T, go, main, send, icon, onDone, steps = TOUR_STEPS }) {
    Object.assign(this, { T, go, main, send, icon, onDone, steps });
    this.at = -1;
    this.voice = false;
    this.place = this.place.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onPoint = this.onPoint.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  get open() {
    return Boolean(this.root);
  }

  // Asks first, the first time you open this window.
  invite() {
    this.build();
    this.showLine(this.T('Want me to show you around? It takes a few minutes, and you can leave whenever you like.'), '', '');
    this.actions.replaceChildren(
      this.spring(),
      this.link('Maybe later', () => this.stop()),
      this.button('Show me', () => this.start(), true),
    );
  }

  start(at = 0) {
    this.build();
    this.send('start');
    this.show(at, 1);
  }

  build() {
    if (this.root) return;
    this.hole = document.createElement('div');
    this.hole.className = 'tour__hole is-whole';
    const face = Object.assign(document.createElement('img'), { className: 'tour__face', src: '../../assets/art/happyface.png', alt: '' });
    this.where = Object.assign(document.createElement('div'), { className: 'tour__where' });
    this.say = Object.assign(document.createElement('p'), { className: 'tour__say' });
    this.say.setAttribute('aria-live', 'polite');
    this.hint = Object.assign(document.createElement('p'), { className: 'tour__hint' });
    const words = document.createElement('div');
    words.append(this.where, this.say, this.hint);
    const bar = Object.assign(document.createElement('div'), { className: 'tour__bar' });
    this.fill = document.createElement('i');
    bar.append(this.fill);
    this.actions = Object.assign(document.createElement('div'), { className: 'tour__actions' });
    const close = Object.assign(document.createElement('button'), { className: 'tour__x', type: 'button', title: this.T('Close') });
    close.setAttribute('aria-label', this.T('Close'));
    close.append(this.icon('close'));
    close.addEventListener('click', () => this.stop());
    this.card = Object.assign(document.createElement('section'), { className: 'tour__card' });
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-label', this.T('Tour with Capri'));
    this.card.append(face, words, bar, this.actions, close);
    this.root = document.createElement('div');
    this.root.append(this.hole, this.card);
    document.body.append(this.root);
    this.main.addEventListener('scroll', this.place, { passive: true });
    this.main.addEventListener('mouseover', this.onPoint);
    this.main.addEventListener('change', this.onChange);
    window.addEventListener('resize', this.place);
    window.addEventListener('keydown', this.onKey);
  }

  stop() {
    if (!this.root) return;
    this.main.removeEventListener('scroll', this.place);
    this.main.removeEventListener('mouseover', this.onPoint);
    this.main.removeEventListener('change', this.onChange);
    window.removeEventListener('resize', this.place);
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.root = null;
    const started = this.at >= 0;
    this.at = -1;
    this.target = null;
    if (started) this.send('end');
    this.onDone?.();
  }

  find(step) {
    if (step.card) {
      const name = this.T(step.card);
      return [...this.main.querySelectorAll('.card__title')].find((n) => n.textContent === name)?.closest('.card') || null;
    }
    return step.page ? document.querySelector(`.nav button[data-page="${step.page}"]`) : null;
  }

  // Step i, or the nearest one in that direction that's on screen (some sections only exist with some settings).
  show(i, dir = 1) {
    let at = i;
    for (; at >= 0 && at < this.steps.length; at += dir) {
      const step = this.steps[at];
      if (step.page) this.go(step.page);
      if (!step.card && !step.page) break;
      if (this.find(step)) break;
    }
    if (at >= this.steps.length) {
      this.stop();
      return;
    }
    if (at < 0) {
      this.show(i + 1, 1);
      return;
    }
    this.at = at;
    const step = this.steps[at];
    this.target = this.find(step);
    if (step.card && this.target) this.main.scrollTop = Math.max(0, this.target.offsetTop - this.main.offsetTop - 16);
    else if (step.page) this.main.scrollTop = 0;
    const title = step.page ? document.querySelector(`.nav button[data-page="${step.page}"] span`)?.textContent || '' : '';
    this.current = this.T(step.say);
    this.showLine(this.current, title ? `${title} · ${at + 1}/${this.steps.length}` : `${at + 1}/${this.steps.length}`, step.card ? this.T('Point at any setting in here and I will explain it. You can try it too.') : '');
    this.drawActions(at);
    this.fill.style.setProperty('--done', `${Math.round(((at + 1) / this.steps.length) * 100)}%`);
    this.place();
    this.send('line', { line: this.current, speak: this.voice });
  }

  showLine(say, where, hint) {
    this.say.textContent = say;
    this.where.textContent = where;
    this.hint.textContent = hint;
  }

  button(label, onclick, primary = false) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: `btn${primary ? ' btn--primary' : ''}`, textContent: this.T(label) });
    b.addEventListener('click', onclick);
    return b;
  }

  link(label, onclick) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'tour__link', textContent: this.T(label) });
    b.addEventListener('click', onclick);
    return b;
  }

  spring() {
    return Object.assign(document.createElement('span'), { className: 'tour__spring' });
  }

  drawActions(at) {
    const last = at === this.steps.length - 1;
    const voice = this.link(this.voice ? 'Voice: on' : 'Voice: off', () => {
      this.voice = !this.voice;
      this.drawActions(this.at);
      if (this.voice) this.send('line', { line: this.current, speak: true });
    });
    const skip = !last && this.steps[at].page && this.link('Skip this page', () => this.skipPage());
    this.actions.replaceChildren(...[
      voice,
      this.spring(),
      skip,
      at > 0 && this.button('Back', () => this.show(at - 1, -1)),
      this.button(last ? 'Done' : 'Next', () => (last ? this.stop() : this.show(at + 1, 1)), true),
    ].filter(Boolean));
  }

  skipPage() {
    const here = this.steps[this.at].page;
    let i = this.at + 1;
    while (i < this.steps.length && this.steps[i].page === here) i++;
    this.show(Math.min(i, this.steps.length - 1), 1);
  }

  // The light goes around what she's talking about, as far as it can be seen.
  place() {
    if (!this.root) return;
    if (!this.target) {
      this.hole.classList.add('is-whole');
      Object.assign(this.hole.style, { left: '50%', top: '50%', width: '0', height: '0' });
      return;
    }
    this.hole.classList.remove('is-whole');
    const r = this.target.getBoundingClientRect();
    const inMain = this.main.contains(this.target);
    const area = this.main.getBoundingClientRect();
    const top = inMain ? Math.max(r.top, area.top + 4) : r.top;
    const bottom = inMain ? Math.min(r.bottom, area.bottom - 4) : r.bottom;
    const pad = inMain ? 4 : 2;
    Object.assign(this.hole.style, {
      left: `${r.left - pad}px`,
      top: `${top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${Math.max(0, bottom - top) + pad * 2}px`,
    });
  }

  onPoint(e) {
    if (this.at < 0 || !this.target || !this.main.contains(this.target)) return;
    const row = e.target.closest?.('.row');
    if (!row || !this.target.contains(row)) {
      this.say.textContent = this.current;
      return;
    }
    const label = row.querySelector('.row__label');
    const name = label ? [...label.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim() : '';
    const help = row.querySelector('.row__help')?.textContent || '';
    if (name) this.say.textContent = help ? `${name}: ${help}` : name;
  }

  onChange(e) {
    if (this.at < 0 || !this.target?.contains(e.target)) return;
    this.say.textContent = this.T(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
  }

  onKey(e) {
    if (e.key === 'Escape') {
      this.stop();
      return;
    }
    if (this.at < 0 || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight' && this.at < this.steps.length - 1) this.show(this.at + 1, 1);
    else if (e.key === 'ArrowLeft' && this.at > 0) this.show(this.at - 1, -1);
  }
}
