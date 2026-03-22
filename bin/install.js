#!/usr/bin/env node

/**
 * adversarial-review installer
 *
 * Detects the target platform and installs skill files to the correct location.
 *
 * Usage:
 *   npx github:<owner>/adversarial-review                          # auto-detect platform
 *   npx github:<owner>/adversarial-review --platform claude-code   # explicit
 *   npx github:<owner>/adversarial-review --platform opencode
 *   npx github:<owner>/adversarial-review --platform codex
 *   npx github:<owner>/adversarial-review --platform kilo
 *   npx github:<owner>/adversarial-review --platform antigravity --project-dir ./
 *   npx github:<owner>/adversarial-review -full                    # all 4 skills
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

const skillPackDir = path.join(packageRoot, 'skill-packs', 'adversarial-review');
const bridgePath = path.join(skillPackDir, 'scripts', 'codex-bridge.js');

const CORE_SKILLS = ['adversarial-code-review', 'adversarial-plan-review'];
const FULL_SKILLS = ['adversarial-security-review', 'adversarial-content-review'];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const fullMode = args.includes('-full');
const platformIdx = args.indexOf('--platform');
const projectDirIdx = args.indexOf('--project-dir');

const explicitPlatform = platformIdx !== -1 ? args[platformIdx + 1] : null;
const projectDir = projectDirIdx !== -1 ? path.resolve(args[projectDirIdx + 1]) : null;

const SKILLS = fullMode ? [...CORE_SKILLS, ...FULL_SKILLS] : CORE_SKILLS;

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const PLATFORMS = {
  'claude-code': {
    name: 'Claude Code',
    skillsRoot: () => path.join(os.homedir(), '.claude', 'skills'),
    templateFile: 'SKILL.md.template',
    outputFile: 'SKILL.md',
    needsProjectDir: false,
  },
  'opencode': {
    name: 'OpenCode',
    skillsRoot: () => path.join(os.homedir(), '.config', 'opencode', 'skills'),
    templateFile: 'SKILL.md.template',
    outputFile: 'SKILL.md',
    needsProjectDir: false,
  },
  'codex': {
    name: 'Codex CLI',
    skillsRoot: () => path.join(os.homedir(), '.codex', 'skills'),
    templateFile: 'SKILL.md.template',
    outputFile: 'SKILL.md',
    needsProjectDir: false,
  },
  'kilo': {
    name: 'Kilo Code',
    skillsRoot: () => path.join(os.homedir(), '.kilocode', 'skills'),
    templateFile: 'SKILL.md.template',
    outputFile: 'SKILL.md',
    needsProjectDir: false,
  },
  'antigravity': {
    name: 'Antigravity',
    skillsRoot: () => {
      if (!projectDir) {
        console.error('Error: --project-dir required for Antigravity platform');
        process.exit(1);
      }
      return path.join(projectDir, '.agents', 'workflows');
    },
    templateFile: 'WORKFLOW.md.template',
    outputFile: 'WORKFLOW.md',
    needsProjectDir: true,
  },
};

function detectPlatform() {
  if (explicitPlatform) {
    if (!PLATFORMS[explicitPlatform]) {
      console.error(`Error: unknown platform "${explicitPlatform}"`);
      console.error(`Valid platforms: ${Object.keys(PLATFORMS).join(', ')}`);
      process.exit(1);
    }
    return explicitPlatform;
  }

  // Auto-detect: check which tool directories exist
  const checks = [
    ['claude-code', path.join(os.homedir(), '.claude')],
    ['opencode', path.join(os.homedir(), '.config', 'opencode')],
    ['codex', path.join(os.homedir(), '.codex')],
    ['kilo', path.join(os.homedir(), '.kilocode')],
  ];

  for (const [platform, dir] of checks) {
    if (fs.existsSync(dir)) {
      console.log(`Auto-detected platform: ${PLATFORMS[platform].name}`);
      return platform;
    }
  }

  // Default to claude-code
  console.log('No platform detected, defaulting to Claude Code');
  return 'claude-code';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

const platform = detectPlatform();
const config = PLATFORMS[platform];
const skillsRoot = config.skillsRoot();

// Staging directory for atomic swap
const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const stagingDir = path.join(path.dirname(skillsRoot), `.adversarial-staging-${uid}`);

try {
  fs.mkdirSync(stagingDir, { recursive: true });

  // 1. Copy scripts (shared codex-bridge.js)
  const scriptsDestDir = path.join(stagingDir, 'adversarial-review', 'scripts');
  fs.mkdirSync(scriptsDestDir, { recursive: true });
  fs.copyFileSync(bridgePath, path.join(scriptsDestDir, 'codex-bridge.js'));
  if (process.platform !== 'win32') {
    fs.chmodSync(path.join(scriptsDestDir, 'codex-bridge.js'), 0o755);
  }

  // 2. Process each skill
  const bridgeAbsPath = path.join(skillsRoot, 'adversarial-review', 'scripts', 'codex-bridge.js');

  for (const skill of SKILLS) {
    const skillSrcDir = path.join(skillPackDir, 'skills', skill);
    const skillDestDir = path.join(stagingDir, skill);
    fs.mkdirSync(skillDestDir, { recursive: true });

    // Read template, inject paths
    const templatePath = path.join(skillSrcDir, config.templateFile);
    if (!fs.existsSync(templatePath)) {
      // Skill may not have a workflow template (e.g., plan/security/content)
      // Fall back to SKILL.md.template
      const fallback = path.join(skillSrcDir, 'SKILL.md.template');
      if (fs.existsSync(fallback)) {
        const template = fs.readFileSync(fallback, 'utf8');
        const injected = template.replaceAll('{{RUNNER_PATH}}', bridgeAbsPath);
        fs.writeFileSync(path.join(skillDestDir, config.outputFile), injected, 'utf8');
      }
    } else {
      const template = fs.readFileSync(templatePath, 'utf8');
      const injected = template.replaceAll('{{RUNNER_PATH}}', bridgeAbsPath);
      fs.writeFileSync(path.join(skillDestDir, config.outputFile), injected, 'utf8');
    }

    // Copy references/ if exists
    const refsSrc = path.join(skillSrcDir, 'references');
    if (fs.existsSync(refsSrc)) {
      copyDirSync(refsSrc, path.join(skillDestDir, 'references'));
    }
  }

  // 3. Verify codex-bridge.js
  console.log('Verifying codex-bridge.js ...');
  const bridgeTestPath = path.join(stagingDir, 'adversarial-review', 'scripts', 'codex-bridge.js');
  const versionOutput = execFileSync(process.execPath, [bridgeTestPath, 'version'], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
  console.log(`  codex-bridge.js version: ${versionOutput}`);

  // Check Codex CLI availability (warning only)
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(whichCmd, ['codex'], { encoding: 'utf8', timeout: 5000 });
    console.log('  ✓ Codex CLI detected — combined mode available');
  } catch {
    console.log('  ℹ Codex CLI not found — skills will run in self mode by default');
  }

  // 4. Atomic swap
  fs.mkdirSync(skillsRoot, { recursive: true });
  const allDirs = ['adversarial-review', ...SKILLS];
  const backups = [];
  const swapped = [];

  try {
    for (const dir of allDirs) {
      const target = path.join(skillsRoot, dir);
      const staged = path.join(stagingDir, dir);
      if (!fs.existsSync(staged)) continue; // Skip if not in staging

      if (fs.existsSync(target)) {
        const backup = path.join(skillsRoot, `.${dir}-backup-${uid}`);
        fs.renameSync(target, backup);
        backups.push({ dir, target, backup });
      }
      fs.renameSync(staged, target);
      swapped.push({ dir, target });
    }
  } catch (err) {
    // Rollback
    for (const { target } of swapped) {
      try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
    }
    for (const { target, backup } of backups) {
      try { fs.renameSync(backup, target); } catch {}
    }
    throw new Error(`Installation failed: ${err.message}`);
  }

  // Cleanup backups
  for (const { backup } of backups) {
    try { fs.rmSync(backup, { recursive: true, force: true }); } catch {}
  }
  try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}

  // 5. Also sync AGENTS.md if applicable (for Codex CLI)
  if (platform === 'codex' || platform === 'claude-code') {
    const agentsMdName = platform === 'codex' ? 'AGENTS.md' : 'CLAUDE.md';
    // Don't auto-inject guidance without --auto flag
  }

  // 6. Success
  console.log('');
  console.log(`adversarial-review skills installed for ${config.name}!${fullMode ? ' (full mode)' : ''}`);
  console.log(`  Location: ${skillsRoot}`);
  console.log(`  Skills:   ${SKILLS.join(', ')}`);
  console.log('');
  console.log('Available commands:');
  console.log('  /adversarial-code-review      — adversarial code review with scoring');
  console.log('  /adversarial-plan-review      — review plans/designs before coding');
  if (fullMode) {
    console.log('  /adversarial-security-review  — security audit (OWASP Top 10 + CWE)');
    console.log('  /adversarial-content-review   — review documents/deliverables');
  } else {
    console.log('');
    console.log('Additional skills with -full:');
    console.log('  /adversarial-security-review  — security audit (OWASP Top 10 + CWE)');
    console.log('  /adversarial-content-review   — review documents/deliverables');
    console.log('');
    console.log(`Run: npx github:<owner>/adversarial-review -full`);
  }
  console.log('');
  console.log('Mode: each command accepts optional mode argument:');
  console.log('  /adversarial-code-review <target>           ← auto (detect Codex)');
  console.log('  /adversarial-code-review <target> self      ← force single-model');
  console.log('  /adversarial-code-review <target> combine   ← force dual-model');

} catch (err) {
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  console.error(err.message || err);
  process.exit(1);
}
