#!/usr/bin/env node

/**
 * Encrypt ground truth files using AES-256-GCM.
 * Run once to generate encrypted .enc files, then delete the originals.
 *
 * Usage: SCORE_KEY=<password> node tests/runner/encrypt-ground-truth.js
 *
 * This script is NOT shipped to agents. Run it locally only.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gtDir = path.resolve(__dirname, '..', 'ground-truth');

const password = process.env.SCORE_KEY;
if (!password) {
  console.error('Set SCORE_KEY env var: SCORE_KEY=your-secret node encrypt-ground-truth.js');
  process.exit(1);
}

function encrypt(text, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: salt(16) + iv(12) + tag(16) + ciphertext
  return Buffer.concat([salt, iv, tag, encrypted]);
}

const files = fs.readdirSync(gtDir).filter(f => f.endsWith('.json'));
for (const file of files) {
  const content = fs.readFileSync(path.join(gtDir, file), 'utf8');
  const encrypted = encrypt(content, password);
  const outPath = path.join(gtDir, file.replace('.json', '.enc'));
  fs.writeFileSync(outPath, encrypted);
  console.log(`Encrypted: ${file} → ${file.replace('.json', '.enc')}`);
}

console.log(`\nDone. Now delete the .json files and commit the .enc files.`);
