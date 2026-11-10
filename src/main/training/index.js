'use strict';

// Making her local model better, one careful step at a time: the chats that went well become a dataset, you train on it where
// there's a GPU, the result comes back as a .gguf, and it only replaces the model you have if it passes her test better.
// For a model on this PC only: a cloud model can't be trained, and nothing here leaves your PC by itself.

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const dataset = require('./dataset');
const evaluate = require('./evaluate');

const ROOT = path.join(__dirname, '..', '..', '..', 'assets');
const MIN_FOR_TRAINING = 200;

// deps: { dir, reward, isLocal(), currentModel(), persona(), chat(model, messages, signal) -> text, setModel(name), openFolder(path) }
function createTrainer({ dir, reward, isLocal, currentModel, persona, chat, setModel, openFolder, assets = ROOT }) {
  const home = path.join(dir, 'training');
  const set = () => JSON.parse(fs.readFileSync(path.join(assets, 'eval', 'prompts.json'), 'utf8'));
  const canon = () => fs.readFileSync(path.join(assets, 'finetune', 'canon.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const curated = () => fs.readFileSync(path.join(assets, 'finetune', 'curated.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const reportFile = () => path.join(home, 'report.json');
  const job = { running: false, done: 0, all: 0, what: '', abort: null };

  const readReport = () => {
    try {
      return JSON.parse(fs.readFileSync(reportFile(), 'utf8'));
    } catch {
      return {};
    }
  };
  const keepReport = (patch) => {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(reportFile(), JSON.stringify({ ...readReport(), ...patch }, null, 2));
  };

  async function mark(model, { limit = 0 } = {}) {
    job.what = model;
    job.done = 0;
    const abort = job.abort;
    const result = await evaluate.run({
      set: set(),
      limit,
      persona: persona(),
      ask: (messages) => chat(model, messages, abort.signal),
      shouldStop: () => abort.signal.aborted,
      onProgress: (done, all) => { job.done = done; job.all = all; },
    });
    return { ...result, model, at: Date.now() };
  }

  const exclusive = async (fn) => {
    if (job.running) return { ok: false, error: 'busy' };
    if (!isLocal()) return { ok: false, error: 'localonly' };
    job.running = true;
    job.abort = new AbortController();
    try {
      return await fn();
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      job.running = false;
    }
  };

  return {
    status() {
      return { local: isLocal(), counts: reward.counts(), needed: MIN_FOR_TRAINING, report: readReport(), job: { running: job.running, done: job.done, all: job.all, what: job.what } };
    },

    // The dataset and what's needed to train on it, in one folder of yours.
    exportPack() {
      if (!isLocal()) return { ok: false, error: 'localonly' };
      const built = dataset.build({ persona: persona(), canon: canon(), curated: curated(), good: reward.good() });
      const { train, valid } = dataset.split(built.rows);
      const pack = path.join(home, 'pack');
      fs.mkdirSync(pack, { recursive: true });
      fs.writeFileSync(path.join(pack, 'capri-dataset.jsonl'), dataset.toJsonl(train));
      fs.writeFileSync(path.join(pack, 'capri-valid.jsonl'), dataset.toJsonl(valid));
      fs.writeFileSync(path.join(pack, 'dataset-card.json'), JSON.stringify({ made: new Date().toISOString(), train: train.length, valid: valid.length, dropped: built.dropped, counts: built.counts }, null, 2));
      for (const f of ['train.py', 'requirements.txt']) fs.copyFileSync(path.join(assets, 'finetune', f), path.join(pack, f));
      openFolder?.(pack);
      return { ok: true, used: built.used, dropped: built.dropped, enough: built.used >= MIN_FOR_TRAINING, folder: pack };
    },

    // Her test on the model she talks with now.
    testCurrent() {
      return exclusive(async () => {
        const result = await mark(currentModel());
        keepReport({ current: result });
        return { ok: true, result };
      });
    },

    // A trained .gguf made into an Ollama model, then both are tested. It's only offered if it did better.
    install(gguf, name = `capri-trained-${new Date().toISOString().slice(0, 10)}`) {
      return exclusive(async () => {
        fs.mkdirSync(home, { recursive: true });
        const file = path.join(home, 'Modelfile');
        fs.writeFileSync(file, dataset.modelfile({ gguf, persona: persona() }));
        await new Promise((resolve, reject) => {
          execFile('ollama', ['create', name, '-f', file], { windowsHide: true, timeout: 10 * 60000 }, (err, _out, stderr) => (err ? reject(new Error(String(stderr || err.message).slice(0, 300))) : resolve()));
        });
        const current = await mark(currentModel());
        const candidate = await mark(name);
        const verdict = evaluate.better(candidate, current);
        keepReport({ current, candidate, verdict });
        return { ok: true, candidate, current, verdict };
      });
    },

    // The trained one becomes hers, only if it passed.
    promote() {
      const { candidate, verdict } = readReport();
      if (!candidate || !verdict?.yes || !isLocal()) return { ok: false, error: 'nobetter' };
      setModel(candidate.model);
      return { ok: true, model: candidate.model };
    },

    stop() {
      job.abort?.abort();
    },
  };
}

module.exports = { createTrainer, MIN_FOR_TRAINING };
