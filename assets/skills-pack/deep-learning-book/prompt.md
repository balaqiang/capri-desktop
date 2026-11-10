YOU ARE USING THE SKILL "deep-learning-book" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Deep Learning — Study Companion

**Source book**: *Deep Learning*, Ian Goodfellow, Yoshua Bengio & Aaron Courville
(MIT Press, 2016) · 20 chapters, 3 parts · read free at
[deeplearningbook.org](https://www.deeplearningbook.org/) · companion compiled 2026-08-25.

**This is a companion, not a copy.** The book is copyrighted, and its site states that the
HTML-only format exists to discourage copying under the authors' MIT Press contract. Nothing
here reproduces its text. Every chapter file is original synthesis — what the chapter
establishes, how to use it, where it has aged — plus a link to the official chapter. Read the
book at the link; use this to navigate it, keep it current, and turn it into decisions.

## How to Use This Skill

- **No argument** — load the core frameworks below.
- **A topic** — ask about `regularization`, `saddle points`, `partition function`; resolved
  through the Topic Index, then that chapter file is read before answering.
- **`chNN`** — load that chapter's file.
- **"is this still true?"** — the 2016→2026 delta layer, in every chapter file and in

When asked about something outside these 20 chapters, say so and route to the delta reference
rather than improvising the book's position on material published after it.

---

## Core Frameworks & Mental Models

### The (T, P, E) frame — ch05

Name the **task**, the **performance measure**, and the **experience** in one sentence before any
model code. Most failed projects failed at P: an unstated metric, or a proxy whose relationship
to the real objective was never checked.

### Every loss is a negative log-likelihood — ch03, ch06

Choose the output distribution, then take its negative log. Gaussian → MSE, Bernoulli → binary
cross-entropy, categorical → cross-entropy, Laplace → MAE. "Which loss?" is always the question
"which distribution?" in disguise. Modern contrastive and preference objectives sit outside this
frame — a real limit of the book, not a gap in your understanding.

### KL asymmetry decides your failure mode — ch03, ch19, ch20

D(p‖q) ≠ D(q‖p). Forward KL is mode-covering (blurry averages); reverse KL is mode-seeking
(sharp but partial). This single fact predicts VAE blur, GAN mode collapse, and the
characteristic over-confidence of mean-field variational posteriors.

### Train-error-first triage — ch11, ch05

High training error → capacity or optimization is the bottleneck; **more data will not help**.
Low training error with a large validation gap → data or regularization. This is the highest-value

### Capacity, the gap, and the U-curve's caveat — ch05, ch07

Regularization trades variance for bias. But the classical U-shaped capacity curve is incomplete:
past the interpolation threshold, test error can fall again (double descent, 2019–2020,
post-dating the book). Practical consequence: when a large model overfits, try more data, more
regularization or longer training **before** shrinking it.

### Architecture is a prior, not a trick — ch09, ch10, ch15

Convolution asserts translation equivariance and locality. Recurrence asserts that the past
compresses into a state. A distributed representation asserts that factors combine
combinatorially. When the assertion is false, the architecture cannot be rescued by tuning — and
when it is true, it beats capacity. This is also why Vision Transformers need more data than
ConvNets: they discard the prior and buy it back with examples.

### Depth's real cost is gradient flow and activation memory — ch06, ch08, ch10

Backprop is the chain rule scheduled well: one forward-pass-equivalent of compute, and memory
proportional to stored activations. Depth fails through vanishing/exploding gradients and
ill-conditioning, which is why residual connections, normalization and clipping exist.

### The partition function organizes Part III — ch16, ch17, ch18, ch19

For undirected models, the likelihood gradient needs samples from the model itself. Four escape
routes: sample it (CD/PCD), sidestep it algebraically (pseudolikelihood, **score matching**),
learn around it (NCE), or estimate it for evaluation (AIS). Score matching's descendants are
today's diffusion models — which is why Part III repays reading even though its models did not
survive.

### Diagnose before you redesign — ch04, ch08, ch11

Gradient norm exploding → clip. Norm large but loss flat → ill-conditioning. Norm near zero with
high loss → saturation or dead units. NaN → numerics first. Change one thing per experiment.

---

## Chapter Index
