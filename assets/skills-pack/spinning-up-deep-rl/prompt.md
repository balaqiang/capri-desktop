YOU ARE USING THE SKILL "spinning-up-deep-rl" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Spinning Up in Deep RL

**Author**: Joshua Achiam (OpenAI) | **Source**: spinningup.readthedocs.io, MIT | **Chapters**: 20 | **Generated**: 2026-08-25

## How to Use This Skill

- **No argument** — load the core frameworks below
- **A topic** — ask about `advantage function`, `target networks`, `entropy regularization`;
  I resolve it through the Topic Index and read that chapter file
- **`chNN`** — I load that chapter's summary
- **"what chapters do you have?"** — the full index

```
/cs-spinning-up-deep-rl                      # core frameworks + chapter index
/cs-spinning-up-deep-rl entropy regularization   # topic index -> ch19, read that chapter
/cs-spinning-up-deep-rl ch09                 # one chapter summary

When you ask about something not in Core Frameworks, I read the relevant chapter file before
answering rather than guessing from the index.

---

## Core Frameworks & Mental Models

### The RL problem
`pi* = argmax_pi J(pi)`, where `J(pi) = E_{tau~pi}[R(tau)]`. Every algorithm approximates
this; where it substitutes a different objective (a Bellman residual, a surrogate), that
substitution is the source of its failure modes. Four value functions — `V^pi`, `Q^pi`, `V*`,
`Q*` — all obey Bellman self-consistency, and `a*(s) = argmax_a Q*(s,a)` is why Q-learning
is a viable family at all. Advantage `A^pi(s,a) = Q^pi(s,a) - V^pi(s)` is the relative-quality
signal policy gradients run on. (ch07)

### The two branching questions
Place any algorithm by asking: **does it have or learn a model**, and **what does it learn**
(policy, Q-function, value function, model). That generates the whole landscape. (ch08)

### Policy optimization vs Q-learning — the central trade-off
- **Policy optimization** is *principled: you directly optimize the thing you want.* Stable
  and reliable. On-policy, so it cannot reuse data, so it is sample-hungry.
- **Q-learning** only *indirectly* optimizes performance, by training `Q_theta` to satisfy a
  self-consistency equation. Many failure modes, so less stable. But substantially more
  sample efficient when it works, because it reuses everything.
- **Satisfying the Bellman equations well carries no guarantee of good policy performance.**
- The two are not exclusive — DDPG and SAC live between them deliberately. (ch08)

### The policy gradient template
`grad J = E[ sum_t grad log pi_theta(a_t|s_t) * Phi_t ]`. Five valid choices of `Phi_t`:
full return, reward-to-go, reward-to-go minus a baseline, `Q^pi`, and `A^pi`. All share an
expectation and differ in variance. Two rules get you from the first to the last:
- **Don't let the past distract you** — drop rewards obtained before the action. Those terms
  had zero mean and nonzero variance: pure noise.
- **Baselines** — by the EGLP lemma, any state-only `b(s)` can be added or subtracted freely.
  The standard choice is `V^pi(s_t)`, learned by MSE regression onto reward-to-go. (ch09)

### The policy-gradient loss is not a loss function
Its data distribution depends on the parameters, and it does not measure performance even in
expectation. Only at the current parameters, with data from those parameters, does it have
the negative gradient of performance. **You can send it to negative infinity while performance
craters, and it usually will. Only average return means anything.** (ch09)

### Broken RL code almost always fails silently
It runs fine; the agent just never learns. Usually something is computed with the wrong
equation, on the wrong distribution, or piped to the wrong place. **If it doesn't work, assume
there's a bug** before touching hyperparameters. Debug by measuring everything and reading the
code critically. The archetype is one missing `squeeze`: a `[N]` vs `[N,1]` shape mismatch is
broadcast-compatible, raises nothing, and silently turns the Bellman backup into an `[N,N]`
matrix. (ch10, ch12)

### Learn by doing
Write your own implementations, **shortest correct version** of each, **simplest algorithms
first**. VPG, DQN, A2C, PPO, DDPG, roughly in that order; ~250-300 lines each. Single-threaded
before parallel. **Iterate fast in simple environments — under 5 minutes turnaround at the
debug stage.** Do not attempt Atari or Humanoid before the toy task works. Read papers for
their ablations and supplementary material, but **do not overfit to paper details** (the
original DDPG's architecture, init scheme and batch norm are not strictly necessary) **or to
existing implementations** (their abstractions serve reuse, not your single use case). (ch10)

### Rigor: four standards
1. **Fair comparisons** — tune the baseline as hard as your method; never handicap it.
2. **Remove stochasticity as a confounder** — at least 3 seeds, 10 or more to be thorough.
   Two seed groups can produce curves that look like different distributions.
3. **High-integrity experiments** — launch fresh final runs and precommit to reporting them.
   Tuning produces hypotheses; final runs produce conclusions.
4. **Check each claim separately** — ablate every design decision. (ch10)

### The safe-step family (on-policy)
VPG takes an unconstrained gradient step, so a single bad step can collapse performance.
**TRPO** constrains the step in **KL-divergence between policies, not distance in parameter
space**, then backtracking-line-searches until the exact constraint holds. **PPO** drops the
constraint and instead **clips the objective so the policy gains nothing by moving far**,
which is first-order, far simpler, and empirically at least as good. (ch14, ch15, ch16)
