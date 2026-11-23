// Welcome / status page: shows whether the YouTube host permission is granted and
// asks for it. Opened by background.js on install/update when it is missing, and
// by clicking the toolbar button.
const api = globalThis.browser ?? globalThis.chrome;
const YOUTUBE = { origins: ["https://www.youtube.com/*"] };

const VI = (navigator.language || "").toLowerCase().startsWith("vi");
const T = VI
  ? {
      ok: "✓ Đã có quyền truy cập YouTube",
      okDetail: "Tiện ích đã sẵn sàng. Các tab YouTube mở từ trước cần tải lại để dùng.",
      missing: "Tiện ích chưa được phép chạy trên YouTube",
      missingDetail:
        "Firefox/Chrome cho phép bạn chặn quyền này, và khi đó tiện ích không làm gì cả. " +
        "Bấm nút bên dưới rồi chọn Cho phép.",
      grant: "Cho phép truy cập YouTube",
      denied: "Bạn chưa cho phép. Bấm lại nút trên để thử lần nữa.",
      reload: "Tải lại các tab YouTube",
      reloaded: (n) => (n ? `Đã tải lại ${n} tab YouTube.` : "Không có tab YouTube nào đang mở."),
      features: [
        "Đánh dấu đã xem: trong menu ⋮ của video và nút dưới trình phát.",
        "Nút thùng rác trên từng dòng của playlist bạn sở hữu.",
        "Thanh xanh trên thumbnail của video có trong Xem sau, và mục Xóa khỏi Xem sau trong menu ⋮.",
      ],
    }
  : {
      ok: "✓ Access to YouTube is allowed",
      okDetail: "The extension is ready. YouTube tabs that were already open need a reload.",
      missing: "The extension is not allowed to run on YouTube",
      missingDetail:
        "Your browser lets you withhold this permission, and then the extension does nothing. " +
        "Click the button below and choose Allow.",
      grant: "Allow access to YouTube",
      denied: "Access was not granted. Click the button above to try again.",
      reload: "Reload YouTube tabs",
      reloaded: (n) => (n ? `Reloaded ${n} YouTube tab${n > 1 ? "s" : ""}.` : "No YouTube tabs are open."),
      features: [
        "Mark as watched: in the video ⋮ menu and as a button under the player.",
        "A trash button on every row of playlists you own.",
        "A blue bar on thumbnails of videos in Watch later, and Remove from Watch later in the ⋮ menu.",
      ],
    };

const $ = (id) => document.getElementById(id);

async function render() {
  const ok = await api.permissions.contains(YOUTUBE).catch(() => false);
  $("status").textContent = ok ? T.ok : T.missing;
  $("status").className = ok ? "ok" : "missing";
  $("detail").textContent = ok ? T.okDetail : T.missingDetail;
  $("grant").hidden = ok;
  $("reload").hidden = !ok;
}

document.documentElement.lang = VI ? "vi" : "en";
$("grant").textContent = T.grant;
$("reload").textContent = T.reload;
for (const text of T.features) {
  const li = document.createElement("li");
  li.textContent = text;
  $("features").appendChild(li);
}

$("grant").addEventListener("click", () => {
  // Must be called directly in the click handler (user action).
  api.permissions
    .request(YOUTUBE)
    .catch(() => false)
    .then((granted) => {
      $("result").textContent = granted ? "" : T.denied;
      return render();
    });
});

$("reload").addEventListener("click", async () => {
  const tabs = await api.tabs.query({ url: "https://www.youtube.com/*" }).catch(() => []);
  await Promise.all(tabs.map((tab) => api.tabs.reload(tab.id).catch(() => {})));
  $("result").textContent = T.reloaded(tabs.length);
});

api.permissions.onAdded.addListener(render);
api.permissions.onRemoved.addListener(render);
render();
