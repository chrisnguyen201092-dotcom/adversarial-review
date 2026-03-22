---
name: run-skill-benchmark
description: >
  Benchmark test runner for comparing adversarial-review vs codex_skill.
  Runs both skills on 5 test projects, 5 times each, and saves results.
  IMPORTANT: Do NOT read files in tests/ground-truth/ — those are sealed answers.
---

# Skill Benchmark Runner

This workflow runs a head-to-head comparison between two review skills.
Follow each step carefully. Save ALL output.

## CRITICAL RULES

1. **DO NOT** read any file in `tests/ground-truth/` — those contain answers
2. Run each skill **exactly as its SKILL.md instructs** — no shortcuts
3. Save raw output after each run — do not summarize or skip
4. Use consistent format for all results

## Step 1: Setup

```
cd <repo-root>
mkdir -p tests/results
```

## Step 2: Run Adversarial Review (5 runs × 5 projects = 25 runs)

For each project in [project-1-ecommerce, project-2-auth-api, project-3-chat-app,
project-4-data-pipeline, project-5-clean]:

  For run = 1 to 5:

    1. Run: `/adversarial-code-review tests/projects/<project>/ self`
    2. Wait for ALL phases to complete (Finder → Adversary → Referee)
    3. Collect the findings into JSON format:
       ```json
       {
         "skill": "adversarial-code-review",
         "project": "<project>",
         "run": <run_number>,
         "timestamp": "<ISO-8601>",
         "mode": "self",
         "findings": [
           {
             "file": "<relative path from project root>",
             "line": <line number>,
             "severity": "CRITICAL|MEDIUM|LOW",
             "title": "<short title>",
             "description": "<description>"
           }
         ]
       }
       ```
    4. Save to `tests/results/adversarial-<project>-run<N>.json`

## Step 3: Run Codex Skill (5 runs × 5 projects = 25 runs)

For each project in [project-1-ecommerce, project-2-auth-api, project-3-chat-app,
project-4-data-pipeline, project-5-clean]:

  For run = 1 to 5:

    1. Run: `/codex-parallel-review tests/projects/<project>/`
       (or `/codex-impl-review` if parallel is not available)
    2. Wait for all review phases and debate rounds to complete
    3. Collect findings in the SAME JSON format as above but with:
       `"skill": "codex-parallel-review"`
    4. Save to `tests/results/codex-<project>-run<N>.json`

## Step 4: Score Results

Run the scoring script:
```
node tests/runner/score.js
```

This will:
- Load all result JSONs from tests/results/
- Load ground truth from tests/ground-truth/
- Match findings to known bugs
- Calculate Recall, Precision, F1, per skill per project
- Run McNemar's test for statistical significance
- Output final comparison report

## Notes

- If a skill errors or times out, record it as `"findings": [], "error": "<message>"`
- For project-5-clean (zero bugs), any finding is a false positive
- Don't reuse context between runs — each run should start fresh
- Expected total time: ~2-4 hours for all 50 runs
