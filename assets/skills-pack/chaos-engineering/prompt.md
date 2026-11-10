YOU ARE USING THE SKILL "chaos-engineering" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Chaos Engineering

Design experiments that surface real weaknesses in production systems — without becoming outages. Most "chaos engineering" attempts skip steady-state measurement, define no abort criteria, and have no blast-radius bound. This skill enforces the discipline that makes chaos experiments safe and useful.

## When to use

- Planning a chaos experiment (what to break, where, when, how to abort)
- Calculating blast radius before running the experiment
- Reviewing an existing experiment plan for safety
- Choosing a chaos tool (Chaos Toolkit / Chaos Mesh / Litmus / Gremlin / AWS FIS)
- Writing a chaos experiment postmortem
- Running a Game Day exercise

## When NOT to use

- General incident response (use `incident-response`)
- Threat hunting / red-team (use `red-team`, `threat-detection`)
- Performance load testing (different goal — chaos is about failure modes, not capacity)
- Production debugging (chaos discovers weaknesses preemptively, not after-the-fact)

## Core principle: chaos without abort criteria is an outage

The 4 Principles of Chaos Engineering (Netflix, 2016):

1. **Build a hypothesis around steady-state behavior.** Not "what breaks?" but "X holds; will it still hold under fault Y?"
2. **Vary real-world events.** Inject realistic failures: kill nodes, slow networks, lose cache, throttle dependencies.
3. **Run experiments in production.** Staging never has the same failure modes. Start small.
4. **Automate experiments to run continuously.** One-off chaos is a press release; continuous chaos is engineering.

Add a fifth: **Define abort criteria up front.** A chaos experiment with no abort criteria is an outage by another name.

## The 3 Python tools

All stdlib-only. Run with `--help`.

### `experiment_designer.py`

Generates a structured experiment plan from inputs. Enforces the required sections (hypothesis, steady-state metric, blast radius, abort criteria, rollback).

Outputs a markdown plan with: hypothesis, steady-state, attack, magnitude, duration, blast radius, abort criteria, rollback procedure, monitoring dashboards, and learning question.

### `blast_radius_calculator.py`

Computes the blast radius of a planned experiment. Given traffic share + user population + duration, calculates expected affected users, expected error budget burn, and a risk score.

Outputs:
- Expected affected users
- Error budget consumed (in minutes of error budget)
- Risk score: GREEN / YELLOW / RED
- Recommendation: PROCEED / REDUCE / ABORT

GREEN = <1% error budget; YELLOW = 1-10%; RED = >10%.

### `experiment_postmortem.py`

Produces a structured postmortem from an experiment plan + results. Catches the common postmortem failure modes: no learning recorded, no follow-up actions, blame-laden language.

Outputs markdown with: summary, hypothesis (was it confirmed/refuted?), what we learned, what surprised us, follow-up actions with owners, and link to next experiment.

## The 7 attack types (taxonomy)

| Attack | What it tests | Tooling |
|---|---|---|
| **Latency** | Timeouts, retries, circuit breakers | tc, Chaos Mesh `NetworkChaos` |
| **Error** | Error handling, fallback paths | Chaos Mesh `HTTPChaos`, Toxiproxy |
| **Resource** (CPU, memory, disk) | Saturation handling, autoscaling | Chaos Mesh `StressChaos`, stress-ng |
| **Network partition** | Split-brain, consensus, failover | Chaos Mesh `NetworkChaos` partition |
| **Dependency failure** | Graceful degradation, fallback | Service mesh fault injection |
| **Time** | Clock skew, NTP issues | libfaketime, Chaos Mesh `TimeChaos` |
| **Infrastructure** (kill instance) | Auto-recovery, failover | AWS FIS, Chaos Monkey |

Pick the attack that matches the hypothesis. "What happens if X is slow?" → latency. "What happens if X loses network?" → partition.

## Tooling chooser

| Tool | Best for | Pricing | Stack |
|---|---|---|---|
| **Chaos Toolkit** | Lightweight, language-agnostic, JSON experiments | OSS | Any |
| **Chaos Mesh** | Kubernetes-native, rich CRDs, in-cluster | OSS | Kubernetes |
| **Litmus** | Kubernetes, Argo-integrated, large library | OSS + Enterprise | Kubernetes |
| **Gremlin** | Enterprise SaaS, multi-cloud, audit | Paid | Any |
| **AWS FIS** | AWS-native, IAM-integrated, EC2/ECS/EKS | Paid (AWS) | AWS |
| **Custom** | Niche needs, single-cloud, low budget | None | Any |

Decision rules:
- k8s-only stack + OSS → Chaos Mesh or Litmus (Litmus has bigger experiment library)
- Multi-cloud + OSS → Chaos Toolkit
- AWS-heavy + simple needs → AWS FIS
- Enterprise + audit/compliance → Gremlin

## Workflows

### Workflow 1: Design and run a single experiment

```
1. State a hypothesis: "When [fault], steady-state metric X stays within Y."
2. Identify the steady-state metric — must be measurable BEFORE the experiment.
3. Run blast_radius_calculator.py — confirm GREEN before proceeding.
4. Run experiment_designer.py to produce the plan.
5. Get a peer review of the plan; confirm abort criteria are concrete.
6. Notify the on-call team in #incidents (or whatever channel).
7. Run the experiment with monitoring open.
8. If abort criteria are hit, abort immediately; record what happened.
9. Run experiment_postmortem.py to capture learnings.
10. File follow-up actions; link to next experiment.

### Workflow 2: Game Day exercise
