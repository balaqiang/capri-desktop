// A body drawn in Illustrator and exported as SVG, moved by her: every part is a named group, turned around its own pivot, and
// each form is a group shown or hidden. It stays vector at any size, and whatever the drawing can do (gradients, clips), the
// browser draws. The names it needs are in assets/capri/blueprint.schema.json and docs/BLUEPRINT.md; `npm run check:blueprint
// <file.svg>` tells you what's missing from yours.

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Blueprint {
  // svgText: the file. schema: assets/capri/blueprint.schema.json
  constructor(svgText, schema, { doc = document } = {}) {
    const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const root = parsed.documentElement;
    if (root.nodeName !== 'svg' || parsed.querySelector('parsererror')) throw new Error('not an SVG');
    // only a drawing: nothing in it can run
    parsed.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
    parsed.querySelectorAll('*').forEach((n) => {
      for (const a of [...n.attributes]) if (/^on/i.test(a.name) || (/href$/i.test(a.name) && !a.value.startsWith('#') && !a.value.startsWith('data:image/'))) n.removeAttribute(a.name);
    });
    this.el = doc.importNode(root, true);
    this.el.style.position = 'absolute';
    this.el.style.left = '0';
    this.el.style.top = '0';
    this.el.style.overflow = 'visible';
    this.el.style.pointerEvents = 'none';
    this.schema = schema;
    const box = (root.getAttribute('viewBox') || '0 0 240 420').trim().split(/[\s,]+/).map(Number);
    this.width = box[2];
    this.height = box[3];
    this.parts = new Map();
    for (const name of schema.parts) {
      const node = this.el.querySelector(`[id="${name}"]`);
      if (!node) continue;
      this.parts.set(name, { node, base: node.getAttribute('transform') || '', pivot: this.pivotOf(name) });
    }
    this.forms = new Map(schema.forms.map((name) => [name, this.el.querySelector(`[id="form-${name}"]`)]).filter(([, n]) => n));
    // the markers are for finding the pivots, never for showing
    this.el.querySelectorAll('[id^="pivot-"]').forEach((n) => n.setAttribute('visibility', 'hidden'));
    this.setForm('full');
  }

  pivotOf(name) {
    const m = this.el.querySelector(`[id="pivot-${name}"]`);
    if (!m) return { x: 0, y: 0 };
    return { x: Number(m.getAttribute('cx')) || 0, y: Number(m.getAttribute('cy')) || 0 };
  }

  setForm(name) {
    const shown = this.forms.has(name) ? name : 'full';
    for (const [form, node] of this.forms) node.setAttribute('display', form === shown ? 'inline' : 'none');
    this.form = shown;
  }

  // { head: degrees, arm_L: degrees, … }: turned around each part's pivot, on top of where the drawing has it
  setPose(pose) {
    for (const [name, deg] of Object.entries(pose)) {
      const part = this.parts.get(name);
      if (part) part.node.setAttribute('transform', `${part.base} rotate(${deg.toFixed(2)} ${part.pivot.x} ${part.pivot.y})`.trim());
    }
  }

  // where she stands (her feet at x, y), how big, which way she faces
  place(x, y, scale = 1, facing = 1) {
    this.el.setAttribute('width', this.width * scale);
    this.el.setAttribute('height', this.height * scale);
    const dx = x - (this.width * scale) / 2;
    const dy = y - this.height * scale;
    this.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scaleX(${facing < 0 ? -1 : 1})`;
  }
}

export { SVG_NS };
