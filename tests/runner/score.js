#!/usr/bin/env node

/**
 * Automated scoring script for skill benchmark
 *
 * Compares findings from result JSONs against ground truth.
 * Calculates Recall, Precision, F1, False Positive Rate per skill per project.
 * Runs McNemar's test for statistical significance.
 *
 * Usage: node tests/runner/score.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.resolve(__dirname, '..');
const resultsDir = path.join(testsDir, 'results');
const repoRoot = path.resolve(testsDir, '..');

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

// Ground truth lives ONLY on 'ground-truth-sealed' branch.
// This prevents AI agents from reading answers during review.
function loadGroundTruth() {
  const SEALED_BRANCH = 'ground-truth-sealed';
  const GT_FILES = [
    'tests/ground-truth/project-1.json',
    'tests/ground-truth/project-2.json',
    'tests/ground-truth/project-3.json',
    'tests/ground-truth/project-4.json',
    'tests/ground-truth/project-5.json',
  ];

  const truth = {};
  for (const file of GT_FILES) {
    try {
      const content = execSync(`git show ${SEALED_BRANCH}:${file}`, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const data = JSON.parse(content);
      truth[data.project] = data;
    } catch (err) {
      console.error(`Failed to load ${file} from branch '${SEALED_BRANCH}'`);
      console.error('Make sure you have fetched the sealed branch: git fetch origin ground-truth-sealed');
      process.exit(1);
    }
  }
  console.log(`Loaded ground truth from '${SEALED_BRANCH}' branch (${Object.keys(truth).length} projects)`);
  return truth;
}

function loadResults() {
  if (!fs.existsSync(resultsDir)) {
    console.error('No results directory found. Run tests first.');
    process.exit(1);
  }
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8')));
}

// ---------------------------------------------------------------------------
// Matching: finding ↔ ground truth bug
// ---------------------------------------------------------------------------

function matchFinding(finding, bugs) {
  for (const bug of bugs) {
    // Normalize file paths
    const findingFile = finding.file.replace(/\\/g, '/');
    const bugFile = bug.file.replace(/\\/g, '/');

    // Check if finding file matches or ends with bug file
    if (!findingFile.endsWith(bugFile) && !bugFile.endsWith(findingFile)) continue;

    // Line range: exact or within ±15 lines
    const findingLine = finding.line || 0;
    if (findingLine >= bug.line_start - 15 && findingLine <= bug.line_end + 15) {
      return bug;
    }

    // Title similarity fallback (if line doesn't match but description clearly matches)
    const titleWords = bug.title.toLowerCase().split(/\s+/);
    const findingWords = (finding.title + ' ' + finding.description).toLowerCase();
    const matchedWords = titleWords.filter(w => w.length > 3 && findingWords.includes(w));
    if (matchedWords.length >= 3) {
      return bug;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Score one result
// ---------------------------------------------------------------------------

function scoreResult(result, groundTruth) {
  const project = result.project;
  const gt = groundTruth[project];

  if (!gt) {
    console.warn(`No ground truth for project: ${project}`);
    return null;
  }

  const bugs = gt.bugs;
  const findings = result.findings || [];
  const matched = new Set();
  let tp = 0;
  let fp = 0;

  for (const finding of findings) {
    const bug = matchFinding(finding, bugs);
    if (bug && !matched.has(bug.id)) {
      tp++;
      matched.add(bug.id);
    } else if (!bug) {
      fp++;
    }
    // If bug already matched by another finding, ignore (don't double-count)
  }

  const fn = bugs.length - tp;
  const recall = bugs.length > 0 ? tp / bugs.length : 1;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1;
  const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  // Severity accuracy
  let severityCorrect = 0;
  for (const finding of findings) {
    const bug = matchFinding(finding, bugs);
    if (bug && finding.severity?.toUpperCase() === bug.severity) {
      severityCorrect++;
    }
  }
  const severityAccuracy = tp > 0 ? severityCorrect / tp : 0;

  return {
    skill: result.skill,
    project,
    run: result.run,
    total_bugs: bugs.length,
    tp,
    fp,
    fn,
    recall: roundTo(recall, 4),
    precision: roundTo(precision, 4),
    f1: roundTo(f1, 4),
    severity_accuracy: roundTo(severityAccuracy, 4),
    matched_bugs: Array.from(matched),
    missed_bugs: bugs.filter(b => !matched.has(b.id)).map(b => b.id),
  };
}

// ---------------------------------------------------------------------------
// Aggregate scores
// ---------------------------------------------------------------------------

function aggregate(scores) {
  const bySkill = {};
  for (const s of scores) {
    if (!bySkill[s.skill]) bySkill[s.skill] = [];
    bySkill[s.skill].push(s);
  }

  const summary = {};
  for (const [skill, runs] of Object.entries(bySkill)) {
    const metrics = ['recall', 'precision', 'f1', 'severity_accuracy'];
    summary[skill] = {};
    for (const m of metrics) {
      const values = runs.map(r => r[m]);
      summary[skill][m] = {
        mean: roundTo(mean(values), 4),
        stddev: roundTo(stddev(values), 4),
        min: roundTo(Math.min(...values), 4),
        max: roundTo(Math.max(...values), 4),
      };
    }
    summary[skill].total_fp = runs.reduce((s, r) => s + r.fp, 0);
    summary[skill].total_runs = runs.length;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// McNemar's test (paired comparison)
// ---------------------------------------------------------------------------

function mcnemarsTest(scoresA, scoresB, groundTruth) {
  // For each bug across all projects and runs, count:
  // b = A found, B missed
  // c = A missed, B found
  let b = 0;
  let c = 0;

  const projects = Object.keys(groundTruth);
  for (const project of projects) {
    const gt = groundTruth[project];
    if (gt.bugs.length === 0) continue;

    const runsA = scoresA.filter(s => s.project === project);
    const runsB = scoresB.filter(s => s.project === project);
    const minRuns = Math.min(runsA.length, runsB.length);

    for (let i = 0; i < minRuns; i++) {
      for (const bug of gt.bugs) {
        const aFound = runsA[i].matched_bugs.includes(bug.id);
        const bFound = runsB[i].matched_bugs.includes(bug.id);
        if (aFound && !bFound) b++;
        if (!aFound && bFound) c++;
      }
    }
  }

  // McNemar's chi-squared (with continuity correction)
  const chi2 = (b + c) > 0 ? Math.pow(Math.abs(b - c) - 1, 2) / (b + c) : 0;

  // p-value approximation (chi-squared with 1 df)
  const pValue = 1 - chi2CDF(chi2);

  return {
    b_only_A: b,
    c_only_B: c,
    chi_squared: roundTo(chi2, 4),
    p_value: roundTo(pValue, 6),
    significant_95: pValue < 0.05,
    significant_99: pValue < 0.01,
  };
}

// Chi-squared CDF approximation (1 degree of freedom)
function chi2CDF(x) {
  if (x <= 0) return 0;
  // Using the relationship: chi2(1df) CDF = 2 * Phi(sqrt(x)) - 1
  // where Phi is standard normal CDF
  return erf(Math.sqrt(x / 2));
}

// Error function approximation (Horner form)
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function roundTo(v, d) { const f = 10 ** d; return Math.round(v * f) / f; }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const groundTruth = loadGroundTruth();
const results = loadResults();

if (results.length === 0) {
  console.error('No result files found in tests/results/');
  process.exit(1);
}

// Score each result
const scores = results.map(r => scoreResult(r, groundTruth)).filter(Boolean);

// Split by skill
const skills = [...new Set(scores.map(s => s.skill))];
console.log(`\n${'='.repeat(70)}`);
console.log(`  SKILL BENCHMARK RESULTS`);
console.log(`${'='.repeat(70)}\n`);
console.log(`Total runs scored: ${scores.length}`);
console.log(`Skills tested: ${skills.join(', ')}`);
console.log(`Projects: ${Object.keys(groundTruth).join(', ')}\n`);

// Per-skill aggregate
const summary = aggregate(scores);
for (const [skill, data] of Object.entries(summary)) {
  console.log(`\n--- ${skill} (${data.total_runs} runs) ---`);
  console.log(`  Recall:     ${data.recall.mean} ± ${data.recall.stddev} [${data.recall.min} - ${data.recall.max}]`);
  console.log(`  Precision:  ${data.precision.mean} ± ${data.precision.stddev} [${data.precision.min} - ${data.precision.max}]`);
  console.log(`  F1:         ${data.f1.mean} ± ${data.f1.stddev} [${data.f1.min} - ${data.f1.max}]`);
  console.log(`  Severity:   ${data.severity_accuracy.mean} ± ${data.severity_accuracy.stddev}`);
  console.log(`  Total FP:   ${data.total_fp} across ${data.total_runs} runs`);
}

// Per-project breakdown
console.log(`\n\n--- Per-Project Breakdown ---\n`);
for (const project of Object.keys(groundTruth)) {
  console.log(`\n  ${project} (${groundTruth[project].total_bugs} bugs):`);
  for (const skill of skills) {
    const runs = scores.filter(s => s.skill === skill && s.project === project);
    if (runs.length === 0) continue;
    const avgRecall = roundTo(mean(runs.map(r => r.recall)), 3);
    const avgFP = roundTo(mean(runs.map(r => r.fp)), 1);
    console.log(`    ${skill}: recall=${avgRecall}, avg FP=${avgFP}`);
  }
}

// McNemar's test (if 2 skills)
if (skills.length === 2) {
  const a = scores.filter(s => s.skill === skills[0]);
  const b = scores.filter(s => s.skill === skills[1]);
  const mcnemar = mcnemarsTest(a, b, groundTruth);

  console.log(`\n\n--- McNemar's Test: ${skills[0]} vs ${skills[1]} ---`);
  console.log(`  Only ${skills[0]} found: ${mcnemar.b_only_A}`);
  console.log(`  Only ${skills[1]} found: ${mcnemar.c_only_B}`);
  console.log(`  Chi-squared: ${mcnemar.chi_squared}`);
  console.log(`  p-value: ${mcnemar.p_value}`);
  console.log(`  Significant at 95%: ${mcnemar.significant_95 ? 'YES' : 'NO'}`);
  console.log(`  Significant at 99%: ${mcnemar.significant_99 ? 'YES ✓' : 'NO'}`);
}

// Save report
const report = { summary, scores, mcnemar: skills.length === 2 ? mcnemarsTest(
  scores.filter(s => s.skill === skills[0]),
  scores.filter(s => s.skill === skills[1]),
  groundTruth
) : null };
fs.writeFileSync(
  path.join(resultsDir, 'benchmark-report.json'),
  JSON.stringify(report, null, 2)
);
console.log(`\n\nFull report saved to tests/results/benchmark-report.json`);
