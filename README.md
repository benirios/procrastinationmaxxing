
<img width="2172" height="724" alt="procrastinatemaxxing" src="https://github.com/user-attachments/assets/b6b8288e-7953-4af6-99db-837704694724" />

Automatic Instagram Reels for Claude Code and Codex CLI.

When you submit a task that looks long enough to leave you staring at a terminal, Procrastinationmaxxing opens Reels in a dedicated Chrome window, advances when each Reel ends, closes the window when the agent finishes, and returns focus to your task.

```bash
git clone https://github.com/benirios/procrastinationmaxxing.git
cd procrastinationmaxxing
npm run install-hooks
```

Works on macOS with Google Chrome and Node.js 18 or newer.

---

# Procrastinationmaxxing Install

“If the agent needs a minute, you get a minute.”

“Your AI works. You scroll. Everyone wins.”

---

# Why I Built This

Long-running coding-agent tasks create an awkward gap.

You submit a refactor, migration, audit, or test run. Then you either watch terminal output crawl by or switch windows manually, lose track of the task, and forget to come back.

So I built Procrastinationmaxxing.

The automation lives in lifecycle hooks:

- detect substantive or long tasks
- open Instagram Reels immediately
- monitor the visible video
- advance when playback ends or loops
- fall back to timed scrolling when inspection is unavailable
- close only the window created for that agent session
- restore the app that was focused before Reels opened

What you see: Reels while the agent works, then your task window when it is done.

---

# How It Works

## 1. Submit a Task

Use Claude Code or Codex normally:

```text
Refactor the authentication flow and run the complete test suite.
```

`UserPromptSubmit` scores the prompt. Substantive implementation, debugging, research, testing, and multi-step requests launch Reels automatically.

## 2. Watch Reels

Procrastinationmaxxing creates a dedicated Chrome window at:

```text
https://www.instagram.com/reels/
```

It watches the active video and presses Down Arrow when the Reel ends. If Chrome blocks video inspection, it switches to a configurable timed fallback.

## 3. Return to Work

When the agent stops, fails, is interrupted, or ends its session, the matching lifecycle hook:

- stops the scroller
- closes the dedicated Reels window
- restores focus to the original task application

Other Chrome windows and tabs are left alone.

---

# Getting Started

## Requirements

- macOS
- Google Chrome
- Node.js 18+
- Claude Code, Codex CLI, or both
- an Instagram session signed in through Chrome

## Install

```bash
git clone https://github.com/benirios/procrastinationmaxxing.git
cd procrastinationmaxxing
npm run install-hooks
```

Install only one runtime if preferred:

```bash
npm run install-claude
npm run install-codex
```

Restart the runtime after installation.

For Codex, run:

```text
/hooks
```

Review and trust the new user hooks. They appear under `UserPromptSubmit`, `Stop`, `Interrupt`, and `SessionEnd`.

---

# macOS Permissions

Procrastinationmaxxing controls Chrome through AppleScript.

## Accessibility

Allow your terminal or coding-agent host under:

```text
System Settings → Privacy & Security → Accessibility
```

This permission is required to send the Down Arrow key.

## Chrome JavaScript

For end-aware scrolling, enable:

```text
Chrome → View → Developer → Allow JavaScript from Apple Events
```

Without it, Procrastinationmaxxing still works using `scrollIntervalSeconds` as a fallback.

---

# Controls

Force Reels for any prompt:

```text
[reels] Explain this repository and run its tests.
```

Disable Reels for one prompt:

```text
[no-reels] Refactor this function.
```

Ordinary slash commands such as `/help` are ignored.

---

# Configuration

Settings live in `config.json`:

```json
{
  "enabled": true,
  "url": "https://www.instagram.com/reels/",
  "browser": "Google Chrome",
  "scrollMode": "video-end",
  "videoPollMilliseconds": 500,
  "endThresholdSeconds": 0.4,
  "maxReelSeconds": 180,
  "scrollIntervalSeconds": 12,
  "restoreTaskWindow": true,
  "longTaskScore": 1
}
```

| Setting | What it does |
|---|---|
| `enabled` | Turns automatic launching on or off |
| `url` | Page opened in the dedicated Chrome window |
| `scrollMode` | Uses `video-end` detection or `fixed` timing |
| `videoPollMilliseconds` | How often playback is inspected |
| `endThresholdSeconds` | How close to the end counts as finished |
| `maxReelSeconds` | Safety limit for frozen or unrecognized videos |
| `scrollIntervalSeconds` | Fixed-mode and inspection-failure fallback |
| `restoreTaskWindow` | Returns focus after cleanup |
| `longTaskScore` | Prompt score required to launch automatically |

---

# Lifecycle Hooks

| Runtime | Start event | Cleanup events |
|---|---|---|
| Claude Code | `UserPromptSubmit` | `Stop`, `StopFailure`, `SessionEnd` |
| Codex CLI | `UserPromptSubmit` | `Stop`, `Interrupt`, `SessionEnd` |

Each session stores its own temporary window and scroller state. Cleanup is idempotent, so repeated stop events are safe.

---

# Development

Run the test suite:

```bash
npm test
```

Refresh both installations after moving the repository or changing hook paths:

```bash
npm run install-hooks
```

Uninstall only this project’s hooks and installed skill copies:

```bash
npm run uninstall-hooks
```

Existing unrelated hooks are preserved during installation and removal.

---

# Troubleshooting

## Reels does not open

- Restart Claude Code or Codex after installation.
- In Codex, open `/hooks` and confirm the hooks are active and trusted.
- Test with `[reels]` to bypass automatic classification.
- Confirm Chrome can be controlled by Apple Events.

## Reels opens but does not advance

- Enable **Allow JavaScript from Apple Events** in Chrome.
- Grant Accessibility permission to the terminal or host app.
- Set `scrollMode` to `fixed` if end detection is unreliable.

## The window does not close

- Confirm the cleanup hooks are enabled.
- Re-run `npm run install-hooks` if the repository was moved.
- Use the latest Codex CLI if `/hooks` is unavailable.

---

# Philosophy

AI agents should handle the work without requiring you to performatively watch them work.

Procrastinationmaxxing turns waiting time into scrolling time—and knows when it is time to come back.

---

# License

MIT License. See `LICENSE` for details.
