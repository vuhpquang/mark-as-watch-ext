# Playlist autoplay control: design

Approved in conversation on 2026-11-28.

## Why

In a playlist (Watch later in particular) YouTube jumps to the next video as soon as one ends.
YouTube's own Autoplay toggle in the player does not affect playlists, so there is no way to
stop it. The extension takes this over.

## Goals / non-goals

- Goal: stop playlist auto-advance, with four modes: **On** (YouTube default), **Stop after this
  video** (one-shot, until you go to another video), **Off for this playlist** (remembered per
  playlist ID), **Always off** (every playlist, remembered).
- Non-goal: autoplay of suggested videos outside playlists. YouTube's own toggle already does
  that and remembers it.
- Anti-goal: breaking playback when YouTube changes its internals. If the hook is missing,
  fall back to pausing right before the end rather than doing nothing.

## Approaches (picked: C)

- A. Dropdown only: every change takes 2 clicks.
- B. Click cycles the 4 modes: 1–3 clicks, hard to tell which mode you are in.
- **C. Split button: the icon toggles On ↔ last used off mode (first time: Off for this
  playlist); a ▾ opens the menu with the 4 modes.** Picked: the common action is 1 click.

## Design

- **Mechanism.** `<yt-playlist-manager>` (inside `ytd-app`, instance at `el.inst`) advances on
  player state `0` (ended) only if `canAutoAdvance_` is true; YouTube sets it to true on every
  `yt-navigate-finish`. We set it to false while off (tick, after navigation, and on `timeupdate`
  near the end), and restore it when we turned it off and the mode goes back to On. Fallback when
  the instance can't be found: pause the video ~0.3 s before the end.
- **UI.** Split button in `ytd-playlist-panel-renderer #start-actions`, after the loop/shuffle
  menu. Grey `skip_next` icon = on; blue with a slash = off; tooltip names the mode. ▾ opens a
  menu (fixed position, in `body`) with a title and 4 radio items, each with a one-line hint.
- **When it stops:** toast "Stopped autoplay · Play next" (Play next = `movie_player.nextVideo()`).
- **Shortcut:** Shift+A = same as clicking the icon (behind the existing shortcuts setting).
- **Storage.** `settings.autoplayAlways` (bool) and `settings.autoplayLastOff`
  (`"video" | "playlist" | "always"`) in `storage.sync`; `autoplayOffPlaylists` (`[{id, title}]`,
  newest first, capped at 300) in `storage.local`, because sync's 8 KB per-item quota fills up
  after a few dozen playlists (found in review). "Stop after this video" lives only in the page.
  MAIN world writes go through the bridge as operations (`{settings?, addPlaylist?,
  removePlaylist?}`) applied to the stored state; the bridge answers `maw-saved` /
  `maw-save-failed` (toast + re-read).
- **Options page:** new section with the "Always off" switch and the list of playlists with
  autoplay off (each removable).
- **Testing:** build only; the user loads `manifest.json` in Firefox themselves (no `web-ext run`).
  No version bump or release until the user has tried it.

## Left to the builder

Exact icon paths, CSS, wording of hints.
