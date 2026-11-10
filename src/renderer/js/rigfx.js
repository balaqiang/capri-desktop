// What makes her models the same as her standing body: its shader, on the finished drawing. The colors graded towards the show's hot red and
// neon green, her white specks, the line boil of a drawing redone by hand, the violet misregistration behind her, glitch slices, the chromatic split, dissolve,
// the flat impact silhouette and the afterimages. The numbers and the formulas are the ones in sprite.js, driven by the same values on her
// body (capri.p).

const VERT = `
attribute vec2 aPos;
uniform vec2 uSize;
varying vec2 vPx;
void main() {
  vPx = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5) * uSize;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vPx;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uScale;  // screen pixels per pixel of her standing body
uniform float uSeed;
uniform float uBoil;
uniform float uGrade;
uniform float uGlitch;
uniform float uGlitchSeed;
uniform float uSplit;
uniform float uDissolve;
uniform vec4 uSil;
uniform vec2 uEcho;
uniform vec2 uMisreg;
uniform vec3 uRim;
uniform float uAlpha;
uniform float uSparkle;
uniform vec2 uOrigin;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec4 tex(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > uSize.x || p.y > uSize.y) return vec4(0.0);
  return texture2D(uTex, p / uSize);
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 grade(vec3 c, out float red) {
  vec3 h = rgb2hsv(c);
  float hx = h.x < 0.5 ? h.x + 1.0 : h.x;
  float lit = smoothstep(0.1, 0.3, h.z);
  red = smoothstep(0.78, 0.85, hx) * (1.0 - smoothstep(1.06, 1.1, hx)) * lit * smoothstep(0.06, 0.2, h.y);
  float green = smoothstep(0.22, 0.27, h.x) * (1.0 - smoothstep(0.47, 0.52, h.x)) * lit * smoothstep(0.15, 0.3, h.y);
  hx = mix(hx, 0.968, red * 0.6 * uGrade);
  h.x = fract(hx);
  h.y = mix(h.y, max(h.y, 0.86), red * uGrade);
  h.y = mix(h.y, min(1.0, h.y * 1.1 + 0.06), green * uGrade);
  h.z = mix(h.z, min(1.0, h.z * 1.5 + 0.1), (red + green) * uGrade);
  return hsv2rgb(h);
}

// from her standing body's pixels (0 at her face) to the drawing's
vec2 at(vec2 s) {
  return s * uScale + uOrigin;
}

// graded, speckled and premultiplied, at a point in her standing body's pixels
vec4 cel(vec2 s) {
  vec4 c = tex(at(s));
  if (c.a <= 0.0) return vec4(0.0);
  float red;
  c.rgb = grade(c.rgb, red);
  // speckles on the red parts: a fixed star field plus a few that twinkle per drawing.
  // One speck is about one screen pixel whatever her size, and sticks to the body.
  if (red > 0.0 && uSparkle > 0.0) {
    vec2 cell = floor(s / max(0.8, (1.0 / uScale) * 1.2));
    float star = step(0.976, hash(cell + 3.1)) * 0.85;
    float tw = step(0.993, hash(cell + uSeed * 1.37));
    c.rgb = mix(c.rgb, vec3(1.0, 0.95, 0.97), clamp((star + tw) * red * uSparkle, 0.0, 1.0));
  }
  return vec4(c.rgb * c.a, c.a);
}

float solid(vec2 s) {
  return tex(at(s)).a;
}

vec2 rot(vec2 p, vec2 c, float a) {
  float s = sin(a), k = cos(a);
  p -= c;
  return c + vec2(k * p.x - s * p.y, s * p.x + k * p.y);
}

void main() {
  // everything in the pixels of her standing body, so every effect is the same size on her
  vec2 q = (vPx - uOrigin) / uScale;

  if (uDissolve > 0.0) {
    vec2 g = rot(q, vec2(110.0, 210.0), 0.55);
    vec2 cell = floor(g / vec2(16.0, 9.0));
    if (hash(cell + floor(uGlitchSeed)) < uDissolve) discard;
  }

  if (uGlitch > 0.0) {
    float bh = mix(5.0, 26.0, hash(vec2(uGlitchSeed, 7.0)));
    float band = floor(q.y / bh);
    float on = step(1.0 - uGlitch * 0.6, hash(vec2(band, uGlitchSeed)));
    q.x += on * (hash(vec2(band + 3.0, uGlitchSeed)) - 0.5) * 72.0 * uGlitch;
  }

  q += (vec2(vnoise(q * 0.075 + uSeed * 13.7), vnoise(q * 0.075 + uSeed * 7.3 + 31.0)) - 0.5) * 2.0 * uBoil;

  vec4 c = cel(q);
  vec3 col = c.rgb;
  float a = c.a;

  // chromatic split: red and blue channels pulled apart
  if (uSplit > 0.0) {
    vec4 cr = cel(q + vec2(uSplit, 0.0));
    vec4 cb = cel(q - vec2(uSplit, uSplit * 0.3));
    col = vec3(cr.r, col.g, cb.b);
    a = max(a, max(cr.a, cb.a));
  }

  // impact frame: flat silhouette
  col = mix(col, uSil.rgb * a, uSil.a);

  // afterimages: the other minds in her, a green and a red copy pulled apart
  if (uEcho != vec2(0.0)) {
    float e1 = solid(q - uEcho) * (1.0 - a);
    col += vec3(0.21, 1.0, 0.48) * e1;
    a += e1;
    float e2 = solid(q + uEcho) * (1.0 - a);
    col += vec3(1.0, 0.13, 0.32) * e2;
    a += e2;
  }

  // violet misregistration behind the figure
  float rim = solid(q - uMisreg) * (1.0 - a);
  col += uRim * rim;
  a += rim;

  gl_FragColor = vec4(col, a) * uAlpha;
}`;

export const RIM = [0.48, 0.24, 1.0];

export class RigFx {
  // -> null when there's no WebGL to be had
  static create(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    return gl ? new RigFx(gl) : null;
  }

  constructor(gl) {
    this.gl = gl;
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    this.u = Object.fromEntries(['uTex', 'uSize', 'uScale', 'uSeed', 'uBoil', 'uGrade', 'uGlitch', 'uGlitchSeed', 'uSplit', 'uDissolve', 'uSil', 'uEcho', 'uMisreg', 'uRim', 'uAlpha', 'uSparkle', 'uOrigin'].map((n) => [n, gl.getUniformLocation(program, n)]));
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform1i(this.u.uTex, 0);
    gl.uniform3f(this.u.uRim, RIM[0], RIM[1], RIM[2]);
    gl.clearColor(0, 0, 0, 0);
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  // source: the finished drawing. box: where it goes on the canvas, in device pixels, from the top left.
  // scale: device pixels per pixel of her standing body. misreg: in those body pixels.
  render(source, box, { scale = 1, seed = 0, boil = 0.9, grade = 1, misreg = [-2.6, 2.2], alpha = 1, glitch = 0, glitchSeed = 0, split = 0, dissolve = 0, sil = [0, 0, 0], silAmount = 0, echo = [0, 0], rim = RIM, sparkle = 1, origin = [0, 0] }) {
    const { gl, u } = this;
    gl.viewport(box.x, gl.drawingBufferHeight - box.y - box.h, box.w, box.h);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(u.uSize, box.w, box.h);
    gl.uniform1f(u.uScale, Math.max(0.05, scale));
    gl.uniform1f(u.uSeed, seed);
    gl.uniform1f(u.uBoil, boil);
    gl.uniform1f(u.uGrade, grade);
    gl.uniform2f(u.uMisreg, misreg[0], misreg[1]);
    gl.uniform1f(u.uGlitch, glitch);
    gl.uniform1f(u.uGlitchSeed, glitchSeed);
    gl.uniform1f(u.uSplit, split);
    gl.uniform1f(u.uDissolve, dissolve);
    gl.uniform4f(u.uSil, sil[0], sil[1], sil[2], silAmount);
    gl.uniform2f(u.uEcho, echo[0], echo[1]);
    gl.uniform3f(u.uRim, rim[0], rim[1], rim[2]);
    gl.uniform1f(u.uAlpha, alpha);
    gl.uniform1f(u.uSparkle, sparkle);
    gl.uniform2f(u.uOrigin, origin[0], origin[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
