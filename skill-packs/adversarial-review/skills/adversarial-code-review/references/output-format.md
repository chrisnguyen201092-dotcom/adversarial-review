# Adversarial Review — Output Format

## Report Template (Markdown)

The final output presented to the user after all phases complete:

````markdown
# Adversarial Review: {target}

## Summary
- **Review type**: {code|plan|security|content}
- **Mode**: {self|combined}
- **Issues found by Finder**: {N}
- **Disproved by Adversary**: {M}
- **Confirmed by Referee**: {K}
- **New issues from Synthesizer**: {J} (if applicable)
- **Confidence**: {K}/{N} issues survived adversarial challenge

## Confirmed Issues

### CRITICAL
1. **{Title}** — `{file}:{line}` — {why it matters}

### MEDIUM
1. **{Title}** — `{file}:{line}` — {why it matters}

### LOW
1. **{Title}** — `{file}:{line}` — {why it matters}

## Fixes (if Synthesizer ran)
{Code diffs for each confirmed + new issue}

## Disproved (for reference)
- ~~{Issue the Finder flagged but Adversary + Referee agreed was not real}~~

## Agent Scores
| Agent | Score | Notes |
|-------|-------|-------|
| Finder | {score} | Found {N} issues |
| Adversary | {score} | Disproved {M}, confirmed {K} |
| Referee | — | {K} verdicts rendered |
````

---

## Canonical JSON Schema

When `--format json` is requested (for CI/CD integration):

```json
{
  "$schema": "adversarial-review-v1",
  "meta": {
    "version": "1.0.0",
    "target": "<path or description>",
    "review_type": "code|plan|security|content",
    "mode": "self|combined",
    "timestamp": "ISO-8601",
    "models": {
      "finder": "<model used>",
      "adversary": "<model used>",
      "referee": "<model used>",
      "synthesizer": "<model used or null>",
      "codex_finder": "<model used or null>"
    }
  },
  "stats": {
    "finder_issues": 0,
    "adversary_disproved": 0,
    "referee_confirmed": 0,
    "synthesizer_new": 0,
    "confidence_ratio": "0/0"
  },
  "findings": [
    {
      "id": "ISSUE-1",
      "severity": "CRITICAL|MEDIUM|LOW",
      "title": "<short title>",
      "found_by": "finder|codex_finder|synthesizer",
      "adversary_verdict": "CONFIRMED|DISPROVED",
      "referee_verdict": "REAL_ISSUE|FALSE_POSITIVE",
      "location": {
        "file": "<path>",
        "line_start": 0,
        "line_end": 0
      },
      "description": "<detailed description>",
      "impact": "<why this matters>",
      "evidence": "<code snippet or reference>",
      "fix": "<code diff or null>",
      "cwe": "<CWE-XXX or null>",
      "owasp": "<A01-A10 or null>"
    }
  ],
  "disproved": [
    {
      "id": "DISPROVED-1",
      "original_severity": "MEDIUM",
      "title": "<what was claimed>",
      "reason_disproved": "<why it's not an issue>"
    }
  ]
}
```

---

## SARIF Output (for CI/CD)

When `--format sarif` is requested, convert canonical JSON to SARIF 2.1.0:

### Mapping

| Adversarial Field | SARIF Field |
|-------------------|------------|
| `findings[].id` | `results[].ruleId` |
| `findings[].severity` CRITICAL | `results[].level` = "error" |
| `findings[].severity` MEDIUM | `results[].level` = "warning" |
| `findings[].severity` LOW | `results[].level` = "note" |
| `findings[].title` | `results[].message.text` |
| `findings[].location` | `results[].locations[].physicalLocation` |
| `findings[].description` | `rules[].fullDescription.text` |
| `findings[].fix` | `results[].fixes[].description.text` |
| `findings[].cwe` | `rules[].properties.tags[]` |

### SARIF Template

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "adversarial-review",
          "version": "1.0.0",
          "informationUri": "https://github.com/<owner>/adversarial-review",
          "rules": []
        }
      },
      "results": []
    }
  ]
}
```
