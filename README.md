# Mark as Watched for YouTube

Firefox add-on and Chrome extension that adds **Mark as watched** to YouTube:

1. In the **⋮ menu** of any video card (home, search, sidebar, subscriptions, playlists).
2. As a **button under the player**, next to Share / Save.

Clicking it records the video in your watch history as **100% watched** (full red bar on the thumbnail).

It also helps with playlists and Watch later:

3. A **trash button** on every row of a playlist you own (including Watch later) removes the
   video in one click.
4. Videos that are in your **Watch later** get a **blue bar** on the left edge of their thumbnail.
5. For those videos the **⋮ menu** gets **Remove from Watch later**, right under
   "Save to Watch later".

Removals show an **Undo** button in the toast; undoing puts a playlist video back where it was.

And a few shortcuts (each can be turned off in the settings):

6. **Dim or hide watched videos** on Home, Subscriptions, Search, the recommendations next to a
   video and channel pages, with an opacity slider and a "watched from X %" threshold.
7. **Keyboard:** <kbd>Shift</kbd>+<kbd>W</kbd> marks as watched, <kbd>Shift</kbd>+<kbd>L</kbd>
   saves to / removes from Watch later. They act on the video under the mouse, or else on the
   video playing on the watch page.
8. **Shift+click** video cards to select several, then mark them as watched, save to or remove
   from Watch later, or remove them from your playlist, from a toolbar at the bottom. Esc clears.
9. **Playlist autoplay control:** a ⏭ button next to Loop / Shuffle in the playlist panel stops
   the playlist from jumping to the next video (YouTube's own Autoplay switch doesn't cover
   playlists). Click it to turn autoplay on/off, or ▾ to pick a mode: **Stop after this video**,
   **Off for this playlist** (remembered) or **Always off**. <kbd>Shift</kbd>+<kbd>A</kbd> does
   the same as clicking it.

**Settings:** click the extension's toolbar button, or open its Preferences / Options in
`about:addons` (Firefox) or `chrome://extensions` (Chrome).

Latest release: [v1.3.0](https://github.com/vuhpquang/mark-as-watch-ext/releases/latest).
It needs Firefox 140+ or Chrome 111+ (or another Chromium browser: Edge, Brave, Arc, …).

The only permission is access to `www.youtube.com`. Your browser lets you withhold it, and then
the extension does nothing. If that happens, the toolbar button shows a red **!**: click it and
choose **Allow**, then reload your YouTube tabs.

## How it works

`src/content.js` runs in the page (MAIN world) on `www.youtube.com`:

- It gets the video's player response: from the open player if it is the current video, otherwise
  from the server-rendered `/watch?v=…` page (`ytInitialPlayerResponse`). The `/youtubei/v1/player`
  API is only a last resort, since it now often rejects requests without a PoToken
  (`400 Precondition check failed`).
- It sends the same stats pings the YouTube player sends: `api/stats/playback` (start) and
  `api/stats/watchtime` with `st=0`, `et=cmt=len`, `final=1`, i.e. "watched from 0 to the end".

No data goes anywhere except youtube.com, and nothing is collected. Only your settings are stored
in the browser's extension storage (synced), and the IDs and titles of playlists where you turned
autoplay off (this device only). You must be signed in to YouTube.

On the watch page the video is paused first. If it kept playing, the player's own pings would
report the real position and overwrite the "watched" state.

## Install

### Firefox (140+)

From a release: download `mark-as-watched-firefox-<version>.zip` from
[Releases](https://github.com/vuhpquang/mark-as-watch-ext/releases), or install from AMO once it is
listed there.

For development (the add-on is removed when Firefox restarts):

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `manifest.json` in this folder.

Or with web-ext, which auto-reloads on change:

```bash
npx web-ext run --source-dir . --url https://www.youtube.com
```

A permanent install needs a package signed by Mozilla (see [Publishing](#publishing)), or Firefox
Developer Edition / Nightly with `xpinstall.signatures.required = false`.

### Chrome (111+)

1. Run `./scripts/build.sh`, or unzip `mark-as-watched-chrome-<version>.zip` from
   [Releases](https://github.com/vuhpquang/mark-as-watch-ext/releases).
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and pick `dist/chrome/` (or the unzipped folder).

After changing the code, run the build again, press the reload icon on the extension card, then
reload the YouTube tab.

> After reloading or reinstalling the extension in either browser, **reload the open YouTube tabs**.

## Development

No dependencies and no bundler. Edit `src/content.js` / `src/styles.css` directly.

```
manifest.json          MV3 manifest (Firefox keys stripped for Chrome at build time)
src/content.js         all logic (MAIN world)
src/styles.css         menu item, button, toast, progress bar styles
icons/                 generated by: node scripts/make-icons.mjs
scripts/build.sh       → dist/firefox/, dist/chrome/, dist/*-<version>.zip
scripts/publish.sh     build + lint + upload to AMO / Chrome Web Store
docs/PUBLISHING.md     store upload guide (Vietnamese)
```

```bash
./scripts/build.sh
```

```bash
npx web-ext lint --source-dir dist/firefox
```

YouTube changes its DOM often. The menu selectors live in `CARD_SELECTOR` / `findOpenMenuList`,
and the button anchor in `ensureWatchButton` (`src/content.js`). The UI is in Vietnamese when
YouTube's language is Vietnamese, otherwise English.

## Publishing

The step-by-step upload guide for addons.mozilla.org and the Chrome Web Store, including the Chrome
privacy form and how to get the API keys, is in [docs/PUBLISHING.md](docs/PUBLISHING.md) (Vietnamese).

After the first upload through the web dashboards, new versions can be pushed from the command
line. Copy `.env.example` to `.env`, fill in the AMO and Chrome Web Store credentials, bump
`version` in `manifest.json`, then run:

```bash
./scripts/publish.sh all
```

You can also use `firefox` or `chrome` instead of `all`. `.env` is gitignored.

## Limitations

- Live streams (no fixed length) cannot be marked.
- If you keep watching a video after marking it, YouTube records the real position again.
