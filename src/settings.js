// Settings shared by the options page and the isolated-world bridge.
// src/content.js (MAIN world) keeps its own copy of these defaults: keep them in sync.
const MAW_DEFAULTS = {
  dimWatched: false, // dim (or hide) watched videos in feeds
  dimMode: "dim", // "dim" | "hide"
  dimOpacity: 40, // % opacity of dimmed videos
  dimThreshold: 90, // % watched that counts as watched
  dimPages: { home: true, subscriptions: true, search: true, watch: true, channel: true },
  wlBar: true, // blue bar on videos in Watch later
  shortcuts: true, // Shift+W, Shift+L
  multiSelect: true, // Shift+click to select videos
  autoplayAlways: false, // never auto-advance in playlists
  autoplayLastOff: "playlist", // off mode the quick toggle uses: "video" | "playlist" | "always"
};

// Playlists with auto-advance off: [{ id, title }], newest first. Kept in storage.local,
// since storage.sync allows only 8 KB per item.
const MAW_PLAYLISTS_MAX = 300;

const mawApi = globalThis.browser ?? globalThis.chrome;

function mawMerge(stored) {
  const s = stored && typeof stored === "object" ? stored : {};
  return { ...MAW_DEFAULTS, ...s, dimPages: { ...MAW_DEFAULTS.dimPages, ...(s.dimPages || {}) } };
}

async function mawLoad() {
  try {
    const { settings } = await mawApi.storage.sync.get("settings");
    return mawMerge(settings);
  } catch {
    return mawMerge();
  }
}

function mawSave(settings) {
  return mawApi.storage.sync.set({ settings });
}

async function mawLoadPlaylists() {
  try {
    const { autoplayOffPlaylists } = await mawApi.storage.local.get("autoplayOffPlaylists");
    return Array.isArray(autoplayOffPlaylists) ? autoplayOffPlaylists : [];
  } catch {
    return [];
  }
}

function mawSavePlaylists(list) {
  return mawApi.storage.local.set({ autoplayOffPlaylists: list.slice(0, MAW_PLAYLISTS_MAX) });
}
