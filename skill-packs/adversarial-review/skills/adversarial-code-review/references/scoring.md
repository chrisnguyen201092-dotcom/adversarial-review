# Adversarial Review — Scoring System

## Why Scoring Works

Single-agent review fails because of sycophancy — the model says what it
thinks you want to hear. Scoring creates **artificial incentives** that
override sycophancy:

- **Finder** wants high scores → over-reports (superset of possible issues)
- **Adversary** wants high scores → carefully disproves (penalized for wrong calls)
- **Referee** wants accuracy → calibrates between them

The overlap between what Finder found AND Adversary couldn't disprove AND
Referee confirmed ≈ the actual issues.

---

## Default Scoring (Code Review)

### Finder
| Impact | Points |
|--------|--------|
| LOW | +1 |
| MEDIUM | +5 |
| CRITICAL | +10 |

### Adversary
| Action | Points |
|--------|--------|
| Correctly disprove issue | + issue's point value |
| Wrongly disprove issue | - 2x issue's point value |
| Confirm issue | 0 (no penalty) |

### Referee
| Action | Points |
|--------|--------|
| Correct ruling | +1 |
| Incorrect ruling | -1 |

---

## Tuning by Review Type

| Scenario | Finder Scores | Adversary Wrong-Disprove Penalty | When to Use |
|----------|--------------|----------------------------------|-------------|
| **Code review** (default) | +1 / +5 / +10 | 2x | Standard code going to production |
| **Security audit** | +2 / +10 / +20 | 3x | Security-sensitive code; miss nothing |
| **Content polish** | +1 / +3 / +5 | 1.5x | Documents, proposals; don't over-edit |
| **Plan review** | +1 / +5 / +10 | 2x | Pre-implementation plans; catch gaps |
| **Pre-launch** | +2 / +8 / +15 | 2.5x | Code about to ship; balanced thoroughness |

### How to Tune

- **Higher Finder scores** → Finder tries harder to find issues (more false positives
  but fewer missed bugs)
- **Higher Adversary penalty** → Adversary is more careful about disproving
  (keeps more borderline issues alive)
- **Lower Adversary penalty** → Adversary is more aggressive about disproving
  (filters out more noise, but may dismiss real issues)

---

## When NOT to Use Adversarial Review

- Simple typo fixes — just fix them
- Single-file changes with obvious correctness — regular review is fine
- Time-sensitive work — this takes 3+ sequential agent calls, ~5-10 minutes
- Work you're going to manually review anyway — the overhead isn't worth it

---

## Token Cost Estimates

| Codebase Size | Mode | Agents | Budget vs Normal |
|--------------|------|--------|-----------------|
| < 1500 LOC | Self | 3-4 sequential | ~3-4x |
| < 1500 LOC | Combined | 3-4 sequential + 1 parallel Codex | ~4-5x |
| >= 1500 LOC | Self | N parallel + 3 sequential | ~5-8x |
| >= 1500 LOC | Combined | N+1 parallel + 3 sequential | ~6-10x |
