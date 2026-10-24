// Runs in the page's MAIN world so it can read `ytcfg` and the player, and so
// requests go out from www.youtube.com with the signed-in user's cookies.
// YouTube enforces Trusted Types: never use innerHTML here, build DOM nodes.
(() => {
  "use strict";

  if (window.__markAsWatchedLoaded) return;
  window.__markAsWatchedLoaded = true;

  const VI = (document.documentElement.lang || navigator.language || "").toLowerCase().startsWith("vi");
  const T = VI
    ? {
        mark: "Đánh dấu đã xem",
        marking: "Đang đánh dấu…",
        marked: "Đã xem",
        done: "Đã đánh dấu đã xem 100%",
        notSignedIn: "Bạn cần đăng nhập YouTube để lưu vào lịch sử xem",
        failed: "Không đánh dấu được: ",
      }
    : {
        mark: "Mark as watched",
        marking: "Marking…",
        marked: "Watched",
        done: "Marked as 100% watched",
        notSignedIn: "Sign in to YouTube to save to your watch history",
        failed: "Could not mark as watched: ",
      };

  // ---------------------------------------------------------------- marking

  const CPN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function randomCpn() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => CPN_ALPHABET[b & 63]).join("");
  }

  function cfg(key) {
    return window.ytcfg?.get?.(key) ?? window.ytcfg?.data_?.[key];
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name.replace(/[-_]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function sha1Hex(text) {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function authHeaders() {
    const sapisid = getCookie("SAPISID") || getCookie("__Secure-3PAPISID");
    if (!sapisid) return null;
    const ts = Math.floor(Date.now() / 1000);
    const hash = await sha1Hex(`${ts} ${sapisid} ${location.origin}`);
    const headers = {
      Authorization: `SAPISIDHASH ${ts}_${hash}`,
      "X-Goog-AuthUser": String(cfg("SESSION_INDEX") ?? 0),
      "X-Origin": location.origin,
    };
    const pageId = cfg("DELEGATED_SESSION_ID");
    if (pageId) headers["X-Goog-PageId"] = pageId;
    return headers;
  }

  async function fetchPlayerResponse(videoId, auth) {
    // The watch page player already has a response for the current video.
    try {
      const live = document.getElementById("movie_player")?.getPlayerResponse?.();
      if (live?.videoDetails?.videoId === videoId && live.playbackTracking) return live;
    } catch {}

    // /youtubei/v1/player now often answers 400 "Precondition check failed"
    // (it wants a PoToken from the real player). The server-rendered watch page
    // still embeds the full player response, so read that first.
    try {
      return await playerResponseFromWatchPage(videoId);
    } catch (err) {
      console.warn("[mark-as-watched] watch page lookup failed, trying the player API:", err);
    }

    // The stats pings carry the user's cookies, so the player response itself
    // does not have to be signed in: fall back to an anonymous request too.
    const context = cfg("INNERTUBE_CONTEXT") || {};
    try {
      return await requestPlayer(videoId, context, auth, "include");
    } catch (err) {
      console.warn("[mark-as-watched] signed-in player request failed, retrying anonymously:", err);
      return requestPlayer(videoId, { client: context.client }, {}, "omit");
    }
  }

  // Parses the object literal that follows `marker`, honouring strings so that
  // braces inside titles/descriptions don't end it early.
  function extractJsonAfter(text, marker) {
    const at = text.indexOf(marker);
    if (at < 0) return null;
    const start = text.indexOf("{", at + marker.length);
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
    return null;
  }

  async function playerResponseFromWatchPage(videoId) {
    const res = await fetch(`/watch?v=${encodeURIComponent(videoId)}&bpctr=9999999999&has_verified=1`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`watch page HTTP ${res.status}`);
    const json = extractJsonAfter(await res.text(), "ytInitialPlayerResponse =");
    if (json?.videoDetails?.videoId !== videoId) throw new Error("player response not found in watch page");
    if (!json.playbackTracking) throw new Error(json.playabilityStatus?.reason || "no playback tracking");
    return json;
  }

  async function requestPlayer(videoId, context, headers, credentials) {
    const apiKey = cfg("INNERTUBE_API_KEY");
    const url = `/youtubei/v1/player?prettyPrint=false${apiKey ? `&key=${apiKey}` : ""}`;
    const res = await fetch(url, {
      method: "POST",
      credentials,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Youtube-Client-Name": String(cfg("INNERTUBE_CONTEXT_CLIENT_NAME") ?? 1),
        "X-Youtube-Client-Version": context.client?.clientVersion || cfg("INNERTUBE_CLIENT_VERSION") || "",
      },
      body: JSON.stringify({
        context,
        videoId,
        playbackContext: {
          contentPlaybackContext: { html5Preference: "HTML5_PREF_WANTS", signatureTimestamp: cfg("STS") },
        },
        racyCheckOk: true,
        contentCheckOk: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const reason = body.match(/"message":\s*"([^"]+)"/)?.[1];
      throw new Error(`player HTTP ${res.status}${reason ? ` (${reason})` : ""}`);
    }
    const json = await res.json();
    if (!json?.playbackTracking) {
      throw new Error(json?.playabilityStatus?.reason || "no playback tracking");
    }
    return json;
  }

  // Stats pings normally go to s.youtube.com; the same endpoints are served on
  // www.youtube.com, which keeps the request same-origin with cookies attached.
  function statsUrl(baseUrl, params) {
    const url = new URL(baseUrl, location.origin);
    url.protocol = location.protocol;
    url.host = location.host;
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    return url.toString();
  }

  async function ping(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`stats HTTP ${res.status}`);
  }

  async function markAsWatched(videoId) {
    const auth = await authHeaders();
    if (!auth) throw new Error(T.notSignedIn);

    const player = document.getElementById("movie_player");
    const isCurrent = player?.getVideoData?.()?.video_id === videoId;
    if (isCurrent) {
      // The player keeps sending its own watchtime pings with the real position,
      // which would overwrite ours. Pause first and let its pause ping go out.
      player.pauseVideo?.();
      await new Promise((r) => setTimeout(r, 500));
    }

    const response = await fetchPlayerResponse(videoId, auth);
    const tracking = response?.playbackTracking;
    const length = Number(response?.videoDetails?.lengthSeconds);
    if (!tracking?.videostatsPlaybackUrl?.baseUrl || !tracking?.videostatsWatchtimeUrl?.baseUrl) {
      throw new Error(response?.playabilityStatus?.reason || "no playback tracking");
    }
    if (!length) throw new Error("unknown video length (live stream?)");

    const client = cfg("INNERTUBE_CONTEXT")?.client || {};
    const len = length.toFixed(3);
    const common = {
      ver: 2,
      cpn: randomCpn(),
      c: client.clientName || "WEB",
      cver: client.clientVersion || "",
      len,
      volume: 100,
      muted: 0,
      fs: 0,
      lact: Math.floor(Math.random() * 5000) + 1000,
    };

    await ping(statsUrl(tracking.videostatsPlaybackUrl.baseUrl, { ...common, cmt: "0.000", rt: "0.500" }));
    await ping(
      statsUrl(tracking.videostatsWatchtimeUrl.baseUrl, {
        ...common,
        st: "0.000",
        et: len,
        cmt: len,
        rt: len,
        rtn: len,
        rti: Math.floor(length),
        state: "paused",
        final: 1,
      }),
    );
  }

  // -------------------------------------------------------------- UI helpers

  function icon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "maw-icon");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    // Material "task_alt" (circle with a check mark).
    path.setAttribute(
      "d",
      "M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM19.79 10.22C19.92 10.79 20 11.39 20 12" +
        "c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0 0 12 2" +
        "C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z",
    );
    svg.appendChild(path);
    return svg;
  }

  let toastTimer;
  function toast(message) {
    let el = document.querySelector(".maw-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "maw-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("maw-show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("maw-show"), 3500);
  }

  function showFullProgress(card) {
    const thumb = card?.querySelector(
      "a#thumbnail, ytd-thumbnail, yt-thumbnail-view-model, a[class*='content-image']",
    );
    if (!thumb || thumb.querySelector(".maw-progress")) return;
    if (getComputedStyle(thumb).position === "static") thumb.style.position = "relative";
    const bar = document.createElement("div");
    bar.className = "maw-progress";
    thumb.appendChild(bar);
  }

  async function runMark(videoId, card) {
    try {
      await markAsWatched(videoId);
      showFullProgress(card);
      toast(T.done);
      return true;
    } catch (err) {
      console.warn("[mark-as-watched]", err);
      toast(err?.message === T.notSignedIn ? T.notSignedIn : T.failed + (err?.message || err));
      return false;
    }
  }

  function videoIdFromHref(href) {
    if (!href) return null;
    try {
      const url = new URL(href, location.origin);
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const shorts = url.pathname.match(/^\/shorts\/([\w-]{11})/);
      return shorts ? shorts[1] : null;
    } catch {
      return null;
    }
  }

  function currentWatchVideoId() {
    return (
      document.querySelector("ytd-watch-flexy")?.getAttribute("video-id") ||
      new URLSearchParams(location.search).get("v")
    );
  }

  // ------------------------------------------------- 1. "⋮" menu on a video

  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-reel-item-renderer",
    "yt-lockup-view-model",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
  ].join(",");

  function targetFromClick(event) {
    const button = event.target.closest?.("button, yt-icon-button, [role='button']");
    if (!button) return null;
    if (button.closest("ytd-watch-metadata")) {
      const videoId = currentWatchVideoId();
      return videoId ? { videoId, card: null } : null;
    }
    const card = button.closest(CARD_SELECTOR);
    if (!card) return null;
    for (const a of card.querySelectorAll("a[href]")) {
      const videoId = videoIdFromHref(a.getAttribute("href"));
      if (videoId) return { videoId, card };
    }
    return null;
  }

  function findOpenMenuList() {
    const lists = document.querySelectorAll(
      "ytd-popup-container ytd-menu-popup-renderer tp-yt-paper-listbox, ytd-popup-container yt-list-view-model",
    );
    for (const list of lists) {
      if (list.children.length && list.getClientRects().length) return list;
    }
    return null;
  }

  function closeMenu(list) {
    const dropdown = list?.closest("tp-yt-iron-dropdown");
    if (dropdown?.close) dropdown.close();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
  }

  function createMenuItem(target) {
    const item = document.createElement("div");
    item.className = "maw-menu-item";
    item.setAttribute("role", "menuitem");
    item.tabIndex = 0;
    item.appendChild(icon());
    const label = document.createElement("span");
    label.textContent = T.mark;
    item.appendChild(label);

    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(item.parentElement);
      runMark(target.videoId, target.card);
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && activate(e));
    return item;
  }

  let menuWatcher = null;

  function removeMenuItems() {
    document.querySelectorAll(".maw-menu-item").forEach((el) => el.remove());
  }

  // The popup opens (and fills) asynchronously after the click, and YouTube
  // reuses one popup for every menu, so poll briefly and clean up on close.
  function watchMenu(target) {
    clearInterval(menuWatcher);
    removeMenuItems();
    const startedAt = Date.now();
    let item = null;

    menuWatcher = setInterval(() => {
      const list = findOpenMenuList();
      if (!list) {
        if (item) {
          item.remove();
          item = null;
        }
        if (Date.now() - startedAt > 3000) clearInterval(menuWatcher);
        return;
      }
      if (!item) item = createMenuItem(target);
      if (item.parentElement !== list) list.prepend(item);
    }, 50);
  }

  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest?.(".maw-menu-item, #maw-watch-btn")) return;
      const target = targetFromClick(event);
      if (target) watchMenu(target);
      else if (!event.target.closest?.("ytd-popup-container")) {
        clearInterval(menuWatcher);
        removeMenuItems();
      }
    },
    true,
  );

  // ------------------------------------- 2. Button in the row under the video

  function ensureWatchButton() {
    if (location.pathname !== "/watch") return;
    const menu = document.querySelector("ytd-watch-metadata #actions ytd-menu-renderer");
    if (!menu) return;
    const videoId = currentWatchVideoId();
    let btn = document.getElementById("maw-watch-btn");

    if (!btn) {
      btn = document.createElement("button");
      btn.id = "maw-watch-btn";
      btn.type = "button";
      btn.appendChild(icon());
      btn.appendChild(document.createElement("span"));
      btn.addEventListener("click", async () => {
        const id = btn.dataset.videoId;
        if (!id || btn.disabled) return;
        btn.disabled = true;
        btn.lastChild.textContent = T.marking;
        const ok = await runMark(id, null);
        if (btn.dataset.videoId !== id) return; // navigated away meanwhile
        btn.lastChild.textContent = ok ? T.marked : T.mark;
        btn.disabled = ok;
      });
    }

    // Sit right before the "⋯" overflow button.
    const anchor = menu.querySelector(":scope > yt-icon-button#button, :scope > yt-button-shape");
    if (btn.parentElement !== menu || btn.nextElementSibling !== anchor) menu.insertBefore(btn, anchor);

    if (btn.dataset.videoId !== videoId) {
      btn.dataset.videoId = videoId || "";
      btn.disabled = false;
      btn.lastChild.textContent = T.mark;
    }
  }

  document.addEventListener("yt-navigate-finish", ensureWatchButton);
  // The action row renders lazily and is re-rendered on resize; re-check cheaply.
  setInterval(ensureWatchButton, 1000);
  ensureWatchButton();
})();
