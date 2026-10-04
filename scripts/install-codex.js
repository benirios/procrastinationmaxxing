#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const hookScript = path.join(projectRoot, 'scripts', 'procrastinate-hook.js');
const hooksPath = process.env.PROCRASTINATE_CODEX_HOOKS_PATH || path.join(os.homedir(), '.codex', 'hooks.json');
const skillDir = process.env.PROCRASTINATE_CODEX_SKILL_DIR || path.join(os.homedir(), '.codex', 'skills', 'procrastinate');
const nodePath = fs.existsSync('/opt/homebrew/bin/node') ? '/opt/homebrew/bin/node' : process.execPath;
const command = `"${nodePath}" "${hookScript}"`;
const eventTimeouts = {
  UserPromptSubmit: 10,
  Stop: 10,
  Interrupt: 3,
  SessionEnd: 3
};

function isOurHook(group) {
  return Array.isArray(group?.hooks) && group.hooks.some((hook) => {
    const hookCommand = String(hook?.command || '');
    return hookCommand === command || hookCommand.includes('/scripts/procrastinate-hook.js');
  });
}

fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
const settings = fs.existsSync(hooksPath) ? JSON.parse(fs.readFileSync(hooksPath, 'utf8')) : {};
settings.hooks ||= {};

for (const [event, timeout] of Object.entries(eventTimeouts)) {
  const groups = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
  settings.hooks[event] = groups.filter((group) => !isOurHook(group));
  settings.hooks[event].push({ hooks: [{ type: 'command', command, timeout }] });
}

if (fs.existsSync(hooksPath)) {
  const backupPath = `${hooksPath}.procrastinate-backup`;
  if (!fs.existsSync(backupPath)) fs.copyFileSync(hooksPath, backupPath);
}
fs.writeFileSync(hooksPath, `${JSON.stringify(settings, null, 2)}\n`);

fs.mkdirSync(skillDir, { recursive: true });
fs.copyFileSync(path.join(projectRoot, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

process.stdout.write(`Installed Procrastinationmaxxing hooks in ${hooksPath}\nReview and trust them with /hooks in a new Codex CLI session.\n`);
