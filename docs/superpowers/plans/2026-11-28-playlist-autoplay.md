# Playlist Autoplay Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user stop YouTube playlists from auto-advancing, with a split toggle button in the playlist panel and four modes.

**Architecture:** A new section 8 in `src/content.js` (MAIN world) flips `canAutoAdvance_` on the `<yt-playlist-manager>` instance and renders the split button + mode menu. Settings gain three keys; MAIN-world writes go through a new reverse channel in `src/settings-bridge.js`. The options page gets a section for "Always off" and the per-playlist list.

**Tech Stack:** Plain MV3 extension, no build step, no dependencies. No automated test suite in this repo: verification is `node --check`, `web-ext lint` (0/0) and a manual run in Firefox.

**Spec:** `docs/superpowers/specs/2026-11-28-playlist-autoplay-design.md`

## Global Constraints

- Trusted Types: no `innerHTML` in `content.js`; build DOM with `createElement(NS)`.
- Only strings cross worlds (Firefox): data goes through `<html data-*>` attributes + events without `detail`.
- `content.js` defaults and `src/settings.js` defaults stay identical.
- UI strings in both `T` tables (vi/en), in `content.js` and `options.js`.
- `npx web-ext lint --source-dir dist/firefox` stays at 0 errors / 0 warnings.
- No version bump, no tag, no publish: Firefox test run only.

## Review Focus

- Ads: an ad ending on the same `<video>` must not trigger the "stopped" toast or be paused by the fallback (skip when `#movie_player.ad-showing`).
- Miniplayer: the playlist keeps playing while browsing; mode must still apply (read playlist/video IDs from the manager and the player, not from `location`).
- Last video of a playlist: YouTube already stops there; don't show a misleading "stopped" toast if nothing would have played (acceptable to still show it; note in manual check).
- Clicks on the button must not collapse the playlist panel (its header has `on-tap="onToggleExpanded"`): stop `click`/`mousedown` propagation.
- Mode "On" after we disabled: restore `canAutoAdvance_ = true` only if we were the ones who set it false (YouTube's sleep timer "End of video" also sets it false).

---

### Task 1: Settings keys + MAIN → storage channel

**Files:**
- Modify: `src/settings.js` (defaults), `src/settings-bridge.js`, `src/content.js` (settings block ~L67-91)

**Interfaces:**
- Produces: settings keys `autoplayAlways: false`, `autoplayOffPlaylists: []` (`{id: string, title: string}[]`, newest first, max 100), `autoplayLastOff: "playlist"` (`"video" | "playlist" | "always"`).
- Produces: `saveSettings(patch: object): void` in `content.js`: applies `patch` to the local `settings`, writes `JSON.stringify(patch)` to `document.documentElement.dataset.mawSettingsPatch`, dispatches `maw-save-settings`.
- Bridge: on `maw-save-settings`, parse the patch, `mawLoad()`, shallow-merge, `mawSave()`.

- [ ] Step 1: add the keys to both default tables; implement `saveSettings` and the bridge listener.
- [ ] Step 2: `node --check src/content.js src/settings-bridge.js src/settings.js` → no output.

### Task 2: Autoplay engine (section 8 of `content.js`)

**Interfaces:**
- Produces: `autoplayContext(): {videoId, playlistId, playlistTitle} | null` (null when no playlist is active; IDs from `yt-playlist-manager` `.inst.playlistComponent.data` and `movie_player.getVideoData()`, fallback to URL).
- Produces: `autoplayMode(ctx): "on" | "video" | "playlist" | "always"` (priority always > playlist > video).
- Produces: `setAutoplayMode(mode)` (radio semantics: "on" clears stop-after, removes playlist, `autoplayAlways=false`; "video" sets `stopAfterVideoId`; "playlist" adds `{id,title}` to the front; "always" sets `autoplayAlways=true`; any off mode stores `autoplayLastOff`), `toggleAutoplay()` (off → "on", on → `autoplayLastOff`), `enforceAutoplay()`.
- `enforceAutoplay()`: find `document.querySelector("yt-playlist-manager, ytd-playlist-manager")`, instance = `el.inst ?? el.polymerController ?? el`; if off → set `canAutoAdvance_ = false`, remember `weDisabled`; if on and `weDisabled` → set `true`.
- Hooks: `tick()`, `yt-navigate-finish` (+ `setTimeout` 0 and 500 ms), capture `timeupdate` when < 2 s left. Capture `ended` on `#movie_player video`: if off and not an ad → toast `T.apStopped` with action `T.apPlayNext` → `movie_player.nextVideo()`. Fallback when no manager instance: on `timeupdate` pause at ≤ 0.3 s left.
- Stop-after resets when the current video ID differs from `stopAfterVideoId`.

- [ ] Step 1: implement; `node --check src/content.js`.

### Task 3: Split button, menu, Shift+A

**Files:** `src/content.js`, `src/styles.css`

- Button `.maw-ap` inserted into each `ytd-playlist-panel-renderer #start-actions` after `#playlist-action-menu` (from `tick()`): `.maw-ap-toggle` (icon `skipNext` / `skipNextOff`, `aria-pressed`, `title` = mode label) + `.maw-ap-more` (icon `arrowDown`). Off → class `maw-ap-off` (blue `#3ea6ff` dark / `#065fd4` light).
- Menu `.maw-ap-menu` in `body`, `position: fixed` under the button: title `T.apTitle`, 4 `role="menuitemradio"` items (`T.apOn`, `T.apVideo`, `T.apPlaylist`, `T.apAlways` with hints `T.apOnHint` …). Closes on outside mousedown, Escape, navigation, selection.
- Shift+A in the existing keydown handler (same `settings.shortcuts` gate): only when `autoplayContext()` is non-null; toggles and toasts `T.apNow(label)`.

- [ ] Step 1: implement; `node --check src/content.js`.

### Task 4: Options page + docs

**Files:** `src/options.html`, `src/options.js`, `README.md`, `CLAUDE.md`

- Section "Tự chuyển video trong playlist": checkbox `data-setting="autoplayAlways"`, list `#apList` rendered from `settings.autoplayOffPlaylists` (title + ✕ button removing the entry and saving), empty-state text. Shift+A line in the shortcuts list.
- Docs: new CLAUDE.md section on autoplay (mechanism, `yt-playlist-manager` `.inst`, bridge reverse channel); README feature line.

- [ ] Step 1: implement.
- [ ] Step 2: `./scripts/build.sh && npx web-ext lint --source-dir dist/firefox` → 0 errors, 0 warnings.

### Task 5: Firefox run

- [ ] Step 1: build only; the user loads `manifest.json` via `about:debugging` and checks: button shows in a playlist, toggle/menu work, video stops at the end with the toast, "Play next" works, options page lists the playlist.
- [ ] Step 2: Commit `feat: control playlist autoplay` only after the user confirms.
