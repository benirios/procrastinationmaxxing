#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const hookScript = path.join(projectRoot, 'scripts', 'procrastinate-hook.js');
const hooksPath = process.env.PROCRASTINATE_CODEX_HOOKS_PATH || path.join(os.homedir(), '.codex', 'hooks.json');
const skillDir = process.env.PROCRASTINATE_CODEX_SKILL_DIR || path.join(os.homedir(), '.codex', 'skills', 'procrastinate');
const events = ['UserPromptSubmit', 'Stop', 'Interrupt', 'SessionEnd'];

if (fs.existsSync(hooksPath)) {
  const settings = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
  for (const event of events) {
    if (!Array.isArray(settings.hooks?.[event])) continue;
    settings.hooks[event] = settings.hooks[event].filter((group) => {
      return !group?.hooks?.some((hook) => {
        const hookCommand = String(hook?.command || '');
        return hookCommand.includes(hookScript) || hookCommand.includes('/scripts/procrastinate-hook.js');
      });
    });
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  fs.writeFileSync(hooksPath, `${JSON.stringify(settings, null, 2)}\n`);
}

try {
  fs.unlinkSync(path.join(skillDir, 'SKILL.md'));
  fs.rmdirSync(skillDir);
} catch {
  // Already absent or contains user files; do not remove anything else.
}

process.stdout.write('Removed Procrastinationmaxxing Codex hooks and its installed skill copy.\n');
