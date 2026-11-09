'use strict';

// Her own browser: the Edge or Chrome already on this PC, driven with Playwright, in a profile of its own. Never yours, so
// nothing you're logged in to is within reach. She can open a page, search, read it, click a link and fill a field. She
// never touches a password or card field, and never presses something that can't be taken back.

const path = require('node:path');

const MAX_READ = 8000;
const RISKY = /\b(?:delete|remove|erase|uninstall|buy|pay|purchase|order|checkout|check out|transfer|withdraw|confirm|subscribe|sign up|log ?in|sign ?in|hapus|bayar|beli|pesan sekarang|tarik|konfirmasi|langganan|masuk|daftar)\b/i;
const SECRET_FIELD = /password|passcode|sandi|credit|card|kartu|cvv|cvc|otp|one-time|\bcc[-_]|\bpin\b/i;

function safeUrl(address) {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(address) ? address : `https://${address}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

// deps: { dir, load() -> playwright's chromium, headless, onChange }
function createBrowser({ dir, load = () => require('playwright-core').chromium, headless = false, channels = ['msedge', 'chrome'] }) {
  let context = null;
  let page = null;

  async function ensure() {
    if (page && !page.isClosed()) return page;
    if (!context) {
      let lastError = null;
      for (const channel of channels) {
        try {
          context = await load().launchPersistentContext(path.join(dir, 'browser-profile'), { channel, headless, viewport: null, args: ['--no-first-run', '--no-default-browser-check'] });
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!context) throw Object.assign(new Error(lastError?.message || 'no browser'), { code: 'nobrowser' });
      context.on('close', () => { context = null; page = null; });
    }
    page = context.pages()[0] || await context.newPage();
    return page;
  }

  const fail = (err, fallback = "Hm, that didn't work.") => ({ ok: false, say: err.code === 'nobrowser' ? "I can't find Edge or Chrome on this PC." : fallback });

  const browser = {
    get open() { return Boolean(page && !page.isClosed()); },

    async goto(address) {
      const url = safeUrl(String(address).trim());
      if (!url) return { ok: false, say: `"${address}" isn't a web address.` };
      try {
        const p = await ensure();
        await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return { ok: true, say: '', title: await p.title() };
      } catch (err) {
        return fail(err, `I couldn't open ${url}.`);
      }
    },

    search(query) {
      return browser.goto(`https://www.bing.com/search?q=${encodeURIComponent(String(query).slice(0, 150))}`);
    },

    // What's on the page, as text.
    async read() {
      if (!browser.open) return { ok: false, say: 'My browser has nothing open.' };
      try {
        const text = await page.evaluate("(document.querySelector('main, article') || document.body).innerText");
        const clean = String(text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_READ);
        return clean ? { ok: true, text: `${await page.title()}\n${page.url()}\n\n${clean}`, say: '' } : { ok: false, say: "There's nothing to read on that page." };
      } catch (err) {
        return fail(err, "I couldn't read that page.");
      }
    },

    // A link or button by its words.
    async click(words) {
      if (RISKY.test(words)) return { ok: false, say: `"${words}" can't be taken back, so that one's yours to press.` };
      if (!browser.open) return { ok: false, say: 'My browser has nothing open.' };
      try {
        const name = String(words);
        const target = page.getByRole('link', { name }).or(page.getByRole('button', { name })).or(page.getByText(name, { exact: false })).first();
        await target.click({ timeout: 6000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        return { ok: true, say: '' };
      } catch (err) {
        return fail(err, `There's no "${words}" I can click there.`);
      }
    },

    // A field by its label or placeholder.
    async fill(field, text) {
      if (!browser.open) return { ok: false, say: 'My browser has nothing open.' };
      if (SECRET_FIELD.test(field)) return { ok: false, say: "That's a password or card field. I never fill those: that one's yours." };
      try {
        const box = page.getByLabel(field).or(page.getByPlaceholder(field)).first();
        await box.waitFor({ state: 'visible', timeout: 6000 });
        const about = await box.evaluate((el) => [el.type, el.name, el.id, el.autocomplete, el.placeholder].join(' '));
        if (SECRET_FIELD.test(about)) return { ok: false, say: "That's a password or card field. I never fill those: that one's yours." };
        await box.fill(String(text));
        return { ok: true, say: '' };
      } catch (err) {
        return fail(err, `There's no "${field}" field I can find there.`);
      }
    },

    async close() {
      const c = context;
      context = null;
      page = null;
      await c?.close().catch(() => {});
    },
  };
  return browser;
}

module.exports = { createBrowser, safeUrl, RISKY, SECRET_FIELD };
