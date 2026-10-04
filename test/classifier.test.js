'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyPrompt, safeSessionId, shouldAdvance, parseFocusTarget } = require('../scripts/procrastinate-hook');

test('does not launch for a short request', () => {
  assert.equal(classifyPrompt('Fix the typo in the heading.').long, false);
});

test('launches for a multi-step implementation request', () => {
  const result = classifyPrompt('Implement authentication, add the database migration, and then write tests to verify the complete flow.');
  assert.equal(result.long, true);
});

test('supports explicit overrides', () => {
  assert.equal(classifyPrompt('Say hello [reels]').long, true);
  assert.equal(classifyPrompt('Build and test the entire application [no-reels]').long, false);
});

test('ignores ordinary slash commands', () => {
  assert.equal(classifyPrompt('/help').long, false);
});

test('sanitizes session ids used as filenames', () => {
  assert.equal(safeSessionId('../../bad/session'), '.._.._bad_session');
});

test('parses the application to restore after Reels closes', () => {
  assert.deepEqual(parseFocusTarget('com.openai.codex\tCodex'), {
    bundleId: 'com.openai.codex',
    processName: 'Codex'
  });
});

const playbackSettings = { maxReelMs: 180000, endThresholdSeconds: 0.4 };

test('advances when playback reaches the end threshold', () => {
  const tracker = { reelStartedAt: 0, lastTime: 8, lastDuration: 10 };
  const status = { status: 'video', currentTime: 9.7, duration: 10, ended: false };
  assert.equal(shouldAdvance(status, tracker, 10000, playbackSettings), 'near-end');
});

test('detects a looping reel that skipped the end threshold', () => {
  const tracker = { reelStartedAt: 0, lastTime: 9.8, lastDuration: 10 };
  const status = { status: 'video', currentTime: 0.1, duration: 10, ended: false };
  assert.equal(shouldAdvance(status, tracker, 10000, playbackSettings), 'looped');
});

test('uses a maximum duration fallback for stalled playback', () => {
  const tracker = { reelStartedAt: 0, lastTime: 4, lastDuration: 10 };
  const status = { status: 'video', currentTime: 4, duration: 10, ended: false };
  assert.equal(shouldAdvance(status, tracker, 180001, playbackSettings), 'timeout');
});

test('keeps watching a reel that is still playing', () => {
  const tracker = { reelStartedAt: 0, lastTime: 4, lastDuration: 10 };
  const status = { status: 'video', currentTime: 5, duration: 10, ended: false };
  assert.equal(shouldAdvance(status, tracker, 10000, playbackSettings), null);
});
