# Adversarial Review

Cross-platform adversarial code review skill pack for AI coding tools.

Uses a **scored multi-agent pattern** where agents with opposing incentives
produce high-fidelity issue detection. Exploits the sycophancy limitation —
each agent WANTS to please, so you give them contradictory goals.

## How It Works

```
Finder (finds issues, rewarded per finding)
    ↓
Adversary (disproves issues, penalized 2x for wrong disproves)
    ↓
Referee (judges both sides, rewarded for accuracy)
    ↓
Synthesizer (generates fixes, catches missed issues — code reviews only)
```

The overlap between what the Finder found AND the Adversary couldn't disprove
AND the Referee confirmed ≈ the actual issues.

## Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| **auto** | default | Detects Codex CLI in PATH → combined; otherwise → self |
| **self** | `<target> self` | Single model, 3-4 phase adversarial |
| **combine** | `<target> combine` | Model + Codex Finder in parallel, then adversarial |

## Skills

| Skill | Description | Mode |
|-------|-------------|------|
| `/adversarial-code-review` | Code review with scoring | auto / self / combine |
| `/adversarial-plan-review` | Review plans before coding | auto / self / combine |
| `/adversarial-security-review` | Security audit (OWASP + CWE) | auto / self / combine |
| `/adversarial-content-review` | Document/deliverable review | self only |

Core skills (installed by default): code-review, plan-review
Full skills (with `-full`): + security-review, content-review

## Supported Platforms

| Platform | Install |
|----------|---------|
| **Claude Code** | `npx github:<owner>/adversarial-review` |
| **OpenCode** | `npx github:<owner>/adversarial-review --platform opencode` |
| **Codex CLI** | `npx github:<owner>/adversarial-review --platform codex` |
| **Kilo Code** | `npx github:<owner>/adversarial-review --platform kilo` |
| **Antigravity** | `npx github:<owner>/adversarial-review --platform antigravity --project-dir ./` |

Auto-detects platform if not specified.

## Install

```bash
# Core skills (code-review + plan-review)
npx github:<owner>/adversarial-review

# All 4 skills
npx github:<owner>/adversarial-review -full
```

## Usage

After install, run in your AI coding tool:

```
/adversarial-code-review src/auth/          ← auto mode
/adversarial-code-review . self             ← force self mode
/adversarial-plan-review docs/plan.md       ← review a plan
/adversarial-security-review src/ combine   ← force dual-model
/adversarial-content-review proposal.md     ← review a document
```

## Scoring System

The scoring creates opposing incentives:

| Role | Incentive | Effect |
|------|-----------|--------|
| **Finder** | +1/+5/+10 per LOW/MEDIUM/CRITICAL | Over-reports to maximize score |
| **Adversary** | Earns issue points for disproves, loses 2x for wrong disproves | Carefully challenges |
| **Referee** | +1 correct ruling, -1 incorrect | Calibrates precisely |

Tunable per review type (see `references/scoring.md`).

## Requirements

- Node.js >= 18 (for installer only)
- Any supported AI coding tool
- Optional: [Codex CLI](https://github.com/openai/codex) for combined mode

## License

MIT
