---
name: procrastinate
description: Configure and troubleshoot the automatic Instagram Reels companion for long Claude Code and Codex CLI tasks on macOS.
---

# Procrastinationmaxxing

Manage the automatic Reels companion installed by this project.

- Runtime settings live in `config.json` at the project root.
- `UserPromptSubmit` estimates whether the submitted task will take over a minute in Claude Code or Codex CLI.
- `[reels]` anywhere in a prompt forces Reels to open.
- `[no-reels]` anywhere in a prompt prevents it from opening.
- In `video-end` mode, the scroller checks the visible video's playback position and advances at the end; Instagram loop resets are detected too.
- `scrollIntervalSeconds` is the fallback when Chrome blocks video inspection. `maxReelSeconds` handles frozen or unrecognized videos.
- Completion, failure, interruption, and session-end hooks close the window associated with that agent session.
- With `restoreTaskWindow` enabled, the app that was active before Reels opened is brought back to the foreground after cleanup.

When changing configuration, preserve valid JSON and keep `scrollIntervalSeconds` at 3 or more. Run `npm test` from the project root after changing scripts or classification rules.

- Run `npm run install-hooks` to install or refresh both Claude Code and Codex CLI hooks.
- Run `npm run uninstall-hooks` to remove only this project's hooks and installed skill copies.
- Codex requires the user to review and trust changed non-managed hooks with `/hooks` before they run.

This integration is macOS-only. It uses Google Chrome and sends the Down Arrow through System Events, so Terminal (or the application hosting Claude Code) may require Accessibility permission in System Settings. End-aware mode also requires **View → Developer → Allow JavaScript from Apple Events** in Chrome; without it, scrolling falls back to the configured interval.
