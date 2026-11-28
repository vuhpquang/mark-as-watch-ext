// Settings page, also the "access to YouTube" status page: background.js opens it
// on install/update when the host permission is missing, and on toolbar click.
// Every change is saved right away; open YouTube tabs pick it up live.
const YOUTUBE = { origins: ["https://www.youtube.com/*"] };

const VI = (navigator.language || "").toLowerCase().startsWith("vi");
const T = VI
  ? {
      ok: "✓ Đã có quyền truy cập YouTube",
      okDetail: "Tiện ích đã sẵn sàng. Các tab YouTube mở từ trước cần tải lại để dùng bản mới.",
      missing: "Tiện ích chưa được phép chạy trên YouTube",
      missingDetail:
        "Trình duyệt cho phép chặn quyền này, và khi đó tiện ích không làm gì cả. Bấm nút bên dưới rồi chọn Cho phép.",
      grant: "Cho phép truy cập YouTube",
      denied: "Bạn chưa cho phép. Bấm lại nút trên để thử lần nữa.",
      reload: "Tải lại các tab YouTube",
      reloaded: (n) => (n ? `Đã tải lại ${n} tab YouTube.` : "Không có tab YouTube nào đang mở."),
      watchedTitle: "Video đã xem",
      dimWatched: "Làm mờ hoặc ẩn video đã xem trong danh sách video",
      modeDim: "Làm mờ",
      modeHide: "Ẩn hẳn",
      opacity: "Độ đậm của video đã xem (opacity)",
      hoverHint: "Rê chuột vào video bị làm mờ để thấy rõ lại.",
      threshold: "Coi là đã xem khi đã xem được ít nhất",
      pagesTitle: "Áp dụng ở:",
      pageHome: "Trang chủ",
      pageSubscriptions: "Kênh đăng ký",
      pageSearch: "Tìm kiếm",
      pageWatch: "Đề xuất cạnh video",
      pageChannel: "Trang kênh",
      wlTitle: "Xem sau",
      wlBar: "Hiện thanh xanh trên thumbnail của video có trong Xem sau",
      apTitle: "Tự chuyển video trong playlist",
      apIntro:
        "Nút ⏭ cạnh nút lặp và trộn bài trong khung playlist: bấm để bật/tắt, bấm ▾ để chọn chế độ (dừng sau video này, tắt cho playlist này, luôn tắt).",
      apAlways: "Luôn tắt: không bao giờ tự chuyển sang video tiếp theo trong playlist",
      apListTitle: "Playlist đã tắt tự chuyển:",
      apEmpty: "Chưa có playlist nào.",
      apRemove: "Bỏ",
      shortcutsTitle: "Phím tắt",
      shortcuts: "Bật phím tắt",
      keyW: "Đánh dấu đã xem",
      keyL: "Lưu vào / xóa khỏi Xem sau",
      keyA: "Bật / tắt tự chuyển video trong playlist đang xem",
      keysHint:
        "Áp dụng cho video đang rê chuột vào. Nếu không rê vào video nào, trên trang xem video thì áp dụng cho video đang mở.",
      selectTitle: "Chọn nhiều video",
      multiSelect: "Giữ Shift rồi bấm vào video để chọn nhiều video",
      selectHint:
        "Một thanh công cụ hiện ở cuối màn hình: đánh dấu đã xem, lưu vào hoặc xóa khỏi Xem sau, và xóa khỏi playlist của bạn. Esc để bỏ chọn.",
      autosave: "Thay đổi được lưu tự động",
    }
  : {
      ok: "✓ Access to YouTube is allowed",
      okDetail: "The extension is ready. YouTube tabs that were already open need a reload to get the new version.",
      missing: "The extension is not allowed to run on YouTube",
      missingDetail:
        "Your browser lets you withhold this permission, and then the extension does nothing. Click the button below and choose Allow.",
      grant: "Allow access to YouTube",
      denied: "Access was not granted. Click the button above to try again.",
      reload: "Reload YouTube tabs",
      reloaded: (n) => (n ? `Reloaded ${n} YouTube tab${n > 1 ? "s" : ""}.` : "No YouTube tabs are open."),
      watchedTitle: "Watched videos",
      dimWatched: "Dim or hide watched videos in video lists",
      modeDim: "Dim",
      modeHide: "Hide",
      opacity: "Opacity of watched videos",
      hoverHint: "Hover a dimmed video to see it clearly.",
      threshold: "Count a video as watched from",
      pagesTitle: "Apply on:",
      pageHome: "Home",
      pageSubscriptions: "Subscriptions",
      pageSearch: "Search",
      pageWatch: "Recommendations next to a video",
      pageChannel: "Channel pages",
      wlTitle: "Watch later",
      wlBar: "Show a blue bar on thumbnails of videos in Watch later",
      apTitle: "Autoplay in playlists",
      apIntro:
        "The ⏭ button next to Loop and Shuffle in the playlist panel: click to turn autoplay on/off, click ▾ to pick a mode (stop after this video, off for this playlist, always off).",
      apAlways: "Always off: never go to the next video of a playlist by itself",
      apListTitle: "Playlists with autoplay off:",
      apEmpty: "None yet.",
      apRemove: "Remove",
      shortcutsTitle: "Keyboard shortcuts",
      shortcuts: "Enable keyboard shortcuts",
      keyW: "Mark as watched",
      keyL: "Save to / remove from Watch later",
      keyA: "Turn autoplay on / off in the playlist you are watching",
      keysHint: "They act on the video under the mouse, or else, on the watch page, on the video that is playing.",
      selectTitle: "Select several videos",
      multiSelect: "Shift+click videos to select several",
      selectHint:
        "A toolbar shows at the bottom: mark as watched, save to or remove from Watch later, and remove from your playlist. Esc clears the selection.",
      autosave: "Changes are saved automatically",
    };

const $ = (id) => document.getElementById(id);
let settings = mawMerge();
let playlists = []; // autoplay off, from storage.local

// ----------------------------------------------------------- access status

async function renderAccess() {
  const ok = await mawApi.permissions.contains(YOUTUBE).catch(() => false);
  $("status").textContent = ok ? T.ok : T.missing;
  $("status").className = ok ? "ok" : "missing";
  $("detail").textContent = ok ? T.okDetail : T.missingDetail;
  $("grant").hidden = ok;
  $("reload").hidden = !ok;
}

$("grant").addEventListener("click", () => {
  // Must be called directly in the click handler (user action), no await before it.
  mawApi.permissions
    .request(YOUTUBE)
    .catch(() => false)
    .then((granted) => {
      $("result").textContent = granted ? "" : T.denied;
      return renderAccess();
    });
});

$("reload").addEventListener("click", async () => {
  const tabs = await mawApi.tabs.query({ url: "https://www.youtube.com/*" }).catch(() => []);
  await Promise.all(tabs.map((tab) => mawApi.tabs.reload(tab.id).catch(() => {})));
  $("result").textContent = T.reloaded(tabs.length);
});

mawApi.permissions.onAdded.addListener(renderAccess);
mawApi.permissions.onRemoved.addListener(renderAccess);

// ---------------------------------------------------------------- settings

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), obj)[last] = value;
}

function renderSettings() {
  for (const input of document.querySelectorAll("[data-setting]")) {
    const value = getPath(settings, input.dataset.setting);
    if (input.type === "checkbox") input.checked = !!value;
    else if (input.type === "radio") input.checked = input.value === value;
    else input.value = value;
  }
  for (const el of document.querySelectorAll("[data-value]")) {
    el.textContent = getPath(settings, el.dataset.value) + (el.dataset.unit || "");
  }
  for (const el of document.querySelectorAll("[data-needs]")) {
    el.classList.toggle("disabled", !settings[el.dataset.needs]);
  }
  for (const el of document.querySelectorAll("[data-needs-mode]")) {
    el.hidden = settings.dimMode !== el.dataset.needsMode;
  }
  for (const el of document.querySelectorAll(".dimmed")) el.style.opacity = String(settings.dimOpacity / 100);
}

function renderPlaylists() {
  $("apEmpty").hidden = playlists.length > 0;
  $("apList").replaceChildren(
    ...playlists.map((playlist) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = playlist.title || playlist.id;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = T.apRemove;
      remove.addEventListener("click", async () => {
        const list = await mawLoadPlaylists();
        await mawSavePlaylists(list.filter((p) => p.id !== playlist.id));
      });
      li.append(link, remove);
      return li;
    }),
  );
}

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  // Ranges fire on every step while dragging; storage.sync has write quotas.
  saveTimer = setTimeout(() => mawSave(settings), 250);
}

document.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-setting]");
  if (!input) return;
  let value;
  if (input.type === "checkbox") value = input.checked;
  else if (input.type === "radio") value = input.value;
  else if (input.type === "range") value = Number(input.value);
  else value = input.value;
  setPath(settings, input.dataset.setting, value);
  renderSettings();
  save();
});

// Another settings tab (or sync) changed them.
mawApi.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.autoplayOffPlaylists) {
    playlists = Array.isArray(changes.autoplayOffPlaylists.newValue) ? changes.autoplayOffPlaylists.newValue : [];
    renderPlaylists();
  }
  if (area !== "sync" || !changes.settings) return;
  settings = mawMerge(changes.settings.newValue);
  renderSettings();
});

// -------------------------------------------------------------------- init

document.documentElement.lang = VI ? "vi" : "en";
for (const el of document.querySelectorAll("[data-t]")) el.textContent = T[el.dataset.t];
$("grant").textContent = T.grant;
$("reload").textContent = T.reload;
$("version").textContent = mawApi.runtime.getManifest().version;

renderAccess();
mawLoad().then((loaded) => {
  settings = loaded;
  renderSettings();
});
mawLoadPlaylists().then((loaded) => {
  playlists = loaded;
  renderPlaylists();
});
