#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const hookScript = path.join(projectRoot, 'scripts', 'procrastinate-hook.js');
const settingsPath = process.env.PROCRASTINATE_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.json');
const skillDir = process.env.PROCRASTINATE_SKILL_DIR || path.join(os.homedir(), '.claude', 'skills', 'procrastinate');
const nodePath = fs.existsSync('/opt/homebrew/bin/node') ? '/opt/homebrew/bin/node' : process.execPath;
const command = `"${nodePath}" "${hookScript}"`;
const events = ['UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd'];

function isOurHook(group) {
  return Array.isArray(group?.hooks) && group.hooks.some((hook) => {
    const hookCommand = String(hook?.command || '');
    return hookCommand === command || hookCommand.includes('/scripts/procrastinate-hook.js');
  });
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
settings.hooks ||= {};

for (const event of events) {
  const groups = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
  settings.hooks[event] = groups.filter((group) => !isOurHook(group));
  settings.hooks[event].push({ hooks: [{ type: 'command', command, timeout: 10 }] });
}

if (fs.existsSync(settingsPath)) {
  const backupPath = `${settingsPath}.procrastinate-backup`;
  if (!fs.existsSync(backupPath)) fs.copyFileSync(settingsPath, backupPath);
}
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

fs.mkdirSync(skillDir, { recursive: true });
fs.copyFileSync(path.join(projectRoot, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

process.stdout.write(`Installed Procrastinationmaxxing hooks in ${settingsPath}\n`);
