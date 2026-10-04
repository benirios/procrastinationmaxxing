#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config.json');
const STATE_DIR = path.join(os.tmpdir(), `procrastinationmaxxing-${process.getuid?.() ?? 'user'}`);

const ACTION_WORDS = [
  'add', 'audit', 'build', 'create', 'debug', 'design', 'develop', 'fix',
  'implement', 'investigate', 'migrate', 'optimize', 'refactor', 'research',
  'review', 'rewrite', 'test', 'update'
];

function readConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  config.scrollMode = config.scrollMode === 'fixed' ? 'fixed' : 'video-end';
  config.videoPollMilliseconds = Math.max(250, Number(config.videoPollMilliseconds) || 500);
  config.endThresholdSeconds = Math.max(0.1, Number(config.endThresholdSeconds) || 0.4);
  config.maxReelSeconds = Math.max(10, Number(config.maxReelSeconds) || 180);
  config.scrollIntervalSeconds = Math.max(3, Number(config.scrollIntervalSeconds) || 12);
  config.restoreTaskWindow = config.restoreTaskWindow !== false;
  config.longTaskScore = Math.max(1, Number(config.longTaskScore) || 4);
  return config;
}

function classifyPrompt(prompt, threshold = 4) {
  const text = String(prompt || '').trim();
  const lower = text.toLowerCase();

  if (!text || lower.includes('[no-reels]')) return { long: false, score: 0, reason: 'disabled' };
  if (lower.includes('[reels]')) return { long: true, score: Infinity, reason: 'forced' };
  if (text.startsWith('/')) return { long: false, score: 0, reason: 'command' };

  let score = 0;
  const reasons = [];
  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  if (text.length >= 220) add(1, 'long prompt');
  if (text.length >= 500) add(2, 'very long prompt');
  if (text.length >= 1200) add(2, 'large specification');

  const matchedActions = ACTION_WORDS.filter((word) => new RegExp(`\\b${word}(?:e?d|ing|s)?\\b`, 'i').test(text));
  if (matchedActions.length >= 1) add(1, 'implementation action');
  if (matchedActions.length >= 2) add(2, 'multiple actions');

  if (/\b(end[- ]to[- ]end|comprehensive|production[- ]ready|full|complete|entire|across|multiple|autonomous(?:ly)?|do not stop)\b/i.test(text)) {
    add(1, 'broad scope');
  }
  if (/\b(test|tests|testing|verify|verification|validate|lint|typecheck|build)\b/i.test(text)) {
    add(1, 'verification requested');
  }
  if (/\b(and then|then|after that|also|as well as)\b/i.test(text) || (text.match(/^\s*(?:[-*]|\d+[.)])\s+/gm) || []).length >= 2) {
    add(1, 'multi-step request');
  }

  return { long: score >= threshold, score, reason: reasons.join(', ') || 'short request' };
}

function safeSessionId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}

function statePath(sessionId) {
  return path.join(STATE_DIR, `${safeSessionId(sessionId)}.json`);
}

function runAppleScript(source, args = []) {
  return execFileSync('/usr/bin/osascript', ['-e', source, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000
  }).trim();
}

function openReels(config) {
  if (config.browser !== 'Google Chrome') {
    throw new Error(`Unsupported browser: ${config.browser}`);
  }

  const script = `
on run argv
  set targetUrl to item 1 of argv
  tell application "Google Chrome"
    activate
    set reelWindow to make new window
    set URL of active tab of reelWindow to targetUrl
    return (id of reelWindow) as string
  end tell
end run`;

  return runAppleScript(script, [config.url]);
}

function parseFocusTarget(output) {
  const [bundleId = '', ...nameParts] = String(output || '').split('\t');
  return { bundleId, processName: nameParts.join('\t') };
}

function getFrontmostApplication() {
  const script = `
tell application "System Events"
  set frontProcess to first application process whose frontmost is true
  set processName to name of frontProcess
  try
    set bundleId to bundle identifier of frontProcess
  on error
    set bundleId to ""
  end try
  return bundleId & tab & processName
end tell`;
  return parseFocusTarget(runAppleScript(script));
}

function restoreApplication(target) {
  if (!target || (!target.bundleId && !target.processName)) return;
  const script = `
on run argv
  set targetBundle to item 1 of argv
  set targetName to item 2 of argv
  tell application "System Events"
    if targetBundle is not "" then
      set targetProcesses to every application process whose bundle identifier is targetBundle
      if (count of targetProcesses) > 0 then
        set frontmost of item 1 of targetProcesses to true
        return "restored"
      end if
    end if
    if targetName is not "" and exists application process targetName then
      set frontmost of application process targetName to true
      return "restored"
    end if
  end tell
  return "missing"
end run`;

  try {
    runAppleScript(script, [target.bundleId || '', target.processName || '']);
  } catch {
    // The original app may have quit while the task was running.
  }
}

function closeWindow(windowId) {
  if (!windowId) return;
  const script = `
on run argv
  set targetId to item 1 of argv as integer
  tell application "Google Chrome"
    if not (exists window id targetId) then return "missing"
    close window id targetId
    return "closed"
  end tell
end run`;

  try {
    runAppleScript(script, [String(windowId)]);
  } catch {
    // Chrome may already be closed, or the user may have closed the Reels window.
  }
}

function stopSession(sessionId) {
  const file = statePath(sessionId);
  let state;
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }

  if (Number.isInteger(state.scrollerPid)) {
    try {
      process.kill(state.scrollerPid, 'SIGTERM');
    } catch {
      // The scroller may have exited when its window was manually closed.
    }
  }
  closeWindow(state.windowId);
  try {
    fs.unlinkSync(file);
  } catch {
    // Idempotent cleanup.
  }
  restoreApplication(state.returnFocus);
}

function startSession(input, config) {
  const result = classifyPrompt(input.prompt, config.longTaskScore);
  if (!config.enabled || !result.long) return;

  stopSession(input.session_id);
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  const returnFocus = config.restoreTaskWindow ? getFrontmostApplication() : null;
  const windowId = openReels(config);
  const file = statePath(input.session_id);
  const state = {
    sessionId: safeSessionId(input.session_id),
    windowId,
    returnFocus,
    scrollerPid: null,
    scrollMode: config.scrollMode,
    pollIntervalMs: config.videoPollMilliseconds,
    endThresholdSeconds: config.endThresholdSeconds,
    maxReelMs: config.maxReelSeconds * 1000,
    fallbackIntervalMs: config.scrollIntervalSeconds * 1000,
    startedAt: new Date().toISOString(),
    classification: { score: result.score, reason: result.reason }
  };
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });

  const scroller = spawn(process.execPath, [__filename, '--scroll', file], {
    detached: true,
    stdio: 'ignore'
  });
  state.scrollerPid = scroller.pid;
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  scroller.unref();
}

function scrollOnce(windowId) {
  const script = `
on run argv
  set targetId to item 1 of argv as integer
  tell application "Google Chrome"
    if not (exists window id targetId) then return "missing"
    set targetWindow to window id targetId
    set index of targetWindow to 1
    activate
    tell application "System Events" to key code 125
    return "ok"
  end tell
end run`;
  return runAppleScript(script, [String(windowId)]);
}

const ACTIVE_VIDEO_JAVASCRIPT = `(() => {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const candidates = Array.from(document.querySelectorAll('video'))
    .map((video) => {
      const rect = video.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const distance = Math.hypot(rect.left + rect.width / 2 - centerX, rect.top + rect.height / 2 - centerY);
      return { video, area: visibleWidth * visibleHeight, distance };
    })
    .filter(({ area }) => area > 1000)
    .sort((a, b) => b.area - a.area || a.distance - b.distance);

  if (!candidates.length) return JSON.stringify({ status: 'no-video' });
  const video = candidates[0].video;
  return JSON.stringify({
    status: 'video',
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : null,
    duration: Number.isFinite(video.duration) ? video.duration : null,
    ended: video.ended,
    paused: video.paused,
    readyState: video.readyState
  });
})()`;

function queryActiveVideo(windowId) {
  const script = `
on run argv
  set targetId to item 1 of argv as integer
  set javascriptSource to item 2 of argv
  tell application "Google Chrome"
    if not (exists window id targetId) then return "missing"
    set targetWindow to window id targetId
    return execute active tab of targetWindow javascript javascriptSource
  end tell
end run`;
  const result = runAppleScript(script, [String(windowId), ACTIVE_VIDEO_JAVASCRIPT]);
  if (result === 'missing') return { status: 'missing' };
  return JSON.parse(result);
}

function shouldAdvance(status, tracker, now, settings) {
  if (now - tracker.reelStartedAt >= settings.maxReelMs) return 'timeout';
  if (status?.status !== 'video') return null;

  const currentTime = Number(status.currentTime);
  const duration = Number(status.duration);
  if (status.ended) return 'ended';
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return null;
  if (currentTime > 0.5 && duration - currentTime <= settings.endThresholdSeconds) return 'near-end';

  const loopWindow = Math.max(1.5, settings.endThresholdSeconds * 3);
  if (
    Number.isFinite(tracker.lastTime) &&
    Number.isFinite(tracker.lastDuration) &&
    tracker.lastTime >= tracker.lastDuration - loopWindow &&
    currentTime < 1
  ) {
    return 'looped';
  }
  return null;
}

function removeStateAndExit(file, timer) {
  try {
    fs.unlinkSync(file);
  } catch {
    // The stop hook may have removed it already.
  }
  clearInterval(timer);
  process.exit(0);
}

function runScroller(file) {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    process.exit(0);
  }

  const settings = {
    mode: state.scrollMode || 'fixed',
    pollIntervalMs: Math.max(250, Number(state.pollIntervalMs) || 500),
    endThresholdSeconds: Math.max(0.1, Number(state.endThresholdSeconds) || 0.4),
    maxReelMs: Math.max(10000, Number(state.maxReelMs) || 180000),
    fallbackIntervalMs: Math.max(3000, Number(state.fallbackIntervalMs || state.intervalMs) || 12000)
  };
  const tracker = {
    reelStartedAt: Date.now(),
    lastTime: null,
    lastDuration: null,
    cooldownUntil: 0,
    smartFailures: 0,
    smartAvailable: settings.mode === 'video-end'
  };

  const advance = (now, timer) => {
    if (scrollOnce(state.windowId) === 'missing') {
      removeStateAndExit(file, timer);
      return;
    }
    tracker.reelStartedAt = now;
    tracker.lastTime = null;
    tracker.lastDuration = null;
    tracker.cooldownUntil = now + 2000;
  };

  const interval = settings.mode === 'fixed' ? settings.fallbackIntervalMs : settings.pollIntervalMs;
  const timer = setInterval(() => {
    if (!fs.existsSync(file)) {
      clearInterval(timer);
      process.exit(0);
    }
    const now = Date.now();
    if (now < tracker.cooldownUntil) return;

    try {
      if (settings.mode === 'fixed') {
        advance(now, timer);
        return;
      }

      if (!tracker.smartAvailable) {
        if (now - tracker.reelStartedAt >= settings.fallbackIntervalMs) advance(now, timer);
        return;
      }

      const status = queryActiveVideo(state.windowId);
      tracker.smartFailures = 0;
      if (status.status === 'missing') {
        removeStateAndExit(file, timer);
        return;
      }

      const reason = shouldAdvance(status, tracker, now, settings);
      if (status.status === 'video') {
        tracker.lastTime = Number(status.currentTime);
        tracker.lastDuration = Number(status.duration);
      }
      if (reason) advance(now, timer);
    } catch {
      tracker.smartFailures += 1;
      if (tracker.smartFailures >= 3) {
        tracker.smartAvailable = false;
        tracker.reelStartedAt = now;
      }
    }
  }, interval);
}

async function readStdin() {
  let body = '';
  for await (const chunk of process.stdin) body += chunk;
  return body;
}

async function main() {
  if (process.argv[2] === '--scroll') {
    runScroller(process.argv[3]);
    return;
  }

  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return;
  }

  try {
    if (input.hook_event_name === 'UserPromptSubmit') {
      startSession(input, readConfig());
    } else if (['Stop', 'StopFailure', 'Interrupt', 'SessionEnd'].includes(input.hook_event_name)) {
      stopSession(input.session_id);
    }
  } catch (error) {
    process.stderr.write(`procrastinationmaxxing: ${error.message}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyPrompt,
  safeSessionId,
  shouldAdvance,
  queryActiveVideo,
  openReels,
  closeWindow,
  readConfig,
  parseFocusTarget,
  getFrontmostApplication,
  restoreApplication
};
