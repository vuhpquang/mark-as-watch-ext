// Watches the YouTube host permission. In MV3 the user can withhold or revoke it
// (Firefox treats it as optional), and then the content scripts silently never run.
// When it is missing: a "!" badge on the toolbar button, and the welcome page on
// install/update with a button that asks for it.
// Runs as a Firefox event page and as a Chrome service worker (see scripts/build.sh).
const api = globalThis.browser ?? globalThis.chrome;
const YOUTUBE = { origins: ["https://www.youtube.com/*"] };
const WELCOME = "src/welcome.html";

async function hasAccess() {
  try {
    return await api.permissions.contains(YOUTUBE);
  } catch {
    return false;
  }
}

async function updateBadge() {
  const ok = await hasAccess();
  await api.action.setBadgeText({ text: ok ? "" : "!" });
  if (!ok) await api.action.setBadgeBackgroundColor({ color: "#d93025" });
  await api.action.setTitle({
    title: ok ? "Mark as Watched for YouTube" : "Mark as Watched for YouTube: click to allow access to YouTube",
  });
  return ok;
}

function openWelcome() {
  return api.tabs.create({ url: api.runtime.getURL(WELCOME) });
}

api.runtime.onInstalled.addListener(async ({ reason }) => {
  const ok = await updateBadge();
  if (!ok && (reason === "install" || reason === "update")) await openWelcome();
});
api.runtime.onStartup.addListener(updateBadge);
api.permissions.onAdded.addListener(updateBadge);
api.permissions.onRemoved.addListener(updateBadge);

api.action.onClicked.addListener(() => {
  // Firefox only shows the prompt from inside a user action, so call request()
  // right away, before any await. It resolves at once when already granted.
  api.permissions
    .request(YOUTUBE)
    .catch(() => false)
    .then(async () => {
      await updateBadge();
      await openWelcome();
    });
});
