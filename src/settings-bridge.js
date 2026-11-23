// Isolated world: the MAIN-world content script can't read extension storage,
// so copy the settings into <html data-maw-settings> and tell it with an event.
// Strings only: objects don't cross between worlds in Firefox.
(() => {
  function publish(settings) {
    document.documentElement.dataset.mawSettings = JSON.stringify(settings);
    document.dispatchEvent(new CustomEvent("maw-settings"));
  }

  mawLoad().then(publish);
  mawApi.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) publish(mawMerge(changes.settings.newValue));
  });
})();
