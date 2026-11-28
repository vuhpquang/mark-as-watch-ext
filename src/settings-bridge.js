// Isolated world: the MAIN-world content script can't read extension storage,
// so copy the settings into <html data-maw-settings> and tell it with an event.
// Strings only: objects don't cross between worlds in Firefox.
(() => {
  function publish(settings) {
    document.documentElement.dataset.mawSettings = JSON.stringify(settings);
    document.dispatchEvent(new CustomEvent("maw-settings"));
  }

  async function snapshot() {
    const [settings, playlists] = await Promise.all([mawLoad(), mawLoadPlaylists()]);
    return { ...settings, autoplayOffPlaylists: playlists };
  }

  const publishFresh = () => snapshot().then(publish);

  publishFresh();
  mawApi.storage.onChanged.addListener((changes, area) => {
    if ((area === "sync" && changes.settings) || (area === "local" && changes.autoplayOffPlaylists)) publishFresh();
  });

  // The other way: content.js puts a JSON operation in <html data-maw-settings-patch>:
  // { settings?: {key: value}, addPlaylist?: {id, title}, removePlaylist?: id }.
  // It is applied to what is stored now. Reads that fail abort the write: never save
  // defaults over the user's settings.
  async function apply(op) {
    if (op.settings && typeof op.settings === "object") {
      const { settings } = await mawApi.storage.sync.get("settings");
      await mawSave({ ...(settings && typeof settings === "object" ? settings : {}), ...op.settings });
    }
    const id = op.addPlaylist?.id ?? op.removePlaylist;
    if (typeof id === "string" && id) {
      const { autoplayOffPlaylists: stored } = await mawApi.storage.local.get("autoplayOffPlaylists");
      const list = (Array.isArray(stored) ? stored : []).filter((p) => p?.id !== id);
      if (op.addPlaylist) list.unshift({ id, title: String(op.addPlaylist.title || "").slice(0, 80) });
      await mawSavePlaylists(list);
    }
  }

  let queue = Promise.resolve();
  document.addEventListener("maw-save-settings", () => {
    let op;
    try {
      op = JSON.parse(document.documentElement.dataset.mawSettingsPatch || "null");
    } catch {}
    if (!op || typeof op !== "object") return;
    // One at a time, so quick successive changes apply in order.
    queue = queue
      .then(() => apply(op))
      .then(
        () => "maw-saved",
        (err) => {
          console.warn("[mark-as-watched] could not save settings", err);
          return "maw-save-failed";
        },
      )
      .then(async (result) => {
        await publishFresh().catch(() => {});
        document.dispatchEvent(new CustomEvent(result));
      });
  });
})();
