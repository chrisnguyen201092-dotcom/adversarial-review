#!/usr/bin/env node

/**
 * codex-bridge.js — Codex CLI wrapper for combined mode
 *
 * Sends a review prompt to Codex CLI and captures the output.
 * Used by the adversarial-review skill when running in combined mode.
 *
 * Usage:
 *   node codex-bridge.js review <prompt-file> [--timeout <ms>]
 *   node codex-bridge.js check                  # Check if Codex CLI is available
 *   node codex-bridge.js version                # Print bridge version
 */

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '1.0.0';

function checkCodexAvailable() {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(cmd, ['codex'], { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function runCodexReview(promptFile, timeoutMs = 120000) {
  if (!fs.existsSync(promptFile)) {
    console.error(`Error: prompt file not found: ${promptFile}`);
    process.exit(1);
  }

  const prompt = fs.readFileSync(promptFile, 'utf8');

  // Send prompt to Codex CLI via stdin
  try {
    const result = execSync(
      `echo "${prompt.replace(/"/g, '\\"')}" | codex --quiet`,
      {
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      }
    );
    return result;
  } catch (err) {
    if (err.killed) {
      console.error(`Error: Codex CLI timed out after ${timeoutMs}ms`);
    } else {
      console.error(`Error running Codex CLI: ${err.message}`);
    }
    process.exit(1);
  }
}

// --- CLI ---

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'version':
    console.log(VERSION);
    break;

  case 'check':
    if (checkCodexAvailable()) {
      console.log('codex: available');
      process.exit(0);
    } else {
      console.log('codex: not found');
      process.exit(1);
    }

  case 'review': {
    const promptFile = args[1];
    if (!promptFile) {
      console.error('Usage: codex-bridge.js review <prompt-file> [--timeout <ms>]');
      process.exit(1);
    }
    const timeoutIdx = args.indexOf('--timeout');
    const timeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 120000;
    const output = runCodexReview(promptFile, timeout);
    console.log(output);
    break;
  }

  default:
    console.error('Usage: codex-bridge.js <review|check|version>');
    process.exit(1);
}
