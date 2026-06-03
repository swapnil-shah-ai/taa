// TAA content script. Plain-language badge: how much Claude usage you have left.
// All local. No network calls.

const CONTEXT_CHARS_PER_TOKEN = 4;
let liveMaxText = "";
let lastKey = null;
let limitData = null;   // { windows } - exact, from the completion stream

function contextAlive() { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } }
function isChatPage() { return location.pathname.indexOf("/chat/") !== -1; }
function estTokens(t) { const c = (t || "").replace(/\s+/g, " ").trim(); return Math.round(c.length / CONTEXT_CHARS_PER_TOKEN); }
function domText() {
  const m = document.querySelector("main");
  let t = m && m.innerText ? m.innerText : "";
  if (!t && document.body) t = document.body.innerText || "";
  return t;
}

// load last-known usage so the badge can show runway right away
try { chrome.storage.local.get(["taa_limit"], (r) => { if (r && r.taa_limit) limitData = r.taa_limit; }); } catch (e) {}

function fresh(win) { return win && win.resets_at && (win.resets_at * 1000 > Date.now()); }
function leftPct(win) { return Math.max(0, Math.round((1 - (win.utilization || 0)) * 100)); }

function ensureBadge() {
  let b = document.getElementById("taa-badge");
  if (!b) {
    b = document.createElement("div");
    b.id = "taa-badge";
    b.style.cssText = [
      "position:fixed", "bottom:16px", "right:16px", "z-index:2147483647",
      "font-family:ui-sans-serif,system-ui,sans-serif", "font-size:12px", "font-weight:600",
      "letter-spacing:.2px", "padding:6px 11px", "border-radius:999px", "color:#fff",
      "box-shadow:0 2px 10px rgba(0,0,0,.35)", "user-select:none", "transition:background .3s ease"
    ].join(";");
    document.body.appendChild(b);
  }
  return b;
}

function onHookMessage(e) {
  try {
    if (!contextAlive()) { window.removeEventListener("message", onHookMessage); return; }
    if (e.source !== window) return;
    const d = e.data;
    if (!d) return;
    if (d.__taa_limit === true && d.windows) {
      limitData = { windows: d.windows };
      try { chrome.storage.local.set({ taa_limit: limitData }); } catch (x) {}
      return;
    }
    if (d.__taa === true && typeof d.text === "string") {
      if (d.text.length > liveMaxText.length) liveMaxText = d.text;
    }
  } catch (err) {}
}
window.addEventListener("message", onHookMessage);

function update() {
  if (!contextAlive()) { clearInterval(timer); return; }
  const existing = document.getElementById("taa-badge");
  if (!isChatPage()) { if (existing) existing.style.display = "none"; return; }

  const key = location.pathname;
  if (key !== lastKey) { lastKey = key; liveMaxText = ""; }
  const size = Math.max(estTokens(liveMaxText), estTokens(domText()));

  try {
    chrome.storage.local.get(["taa_chats"], (res) => {
      const chats = res.taa_chats || {};
      const prev = chats[key] ? chats[key].size : 0;
      const chatSize = Math.max(prev || 0, size);

      const w5 = limitData && limitData.windows ? limitData.windows["5h"] : null;
      let text, color;
      if (w5 && fresh(w5)) {
        const left = leftPct(w5);
        text = "TAA \u00b7 " + left + "% usage left";
        color = left >= 30 ? "#2ea043" : left >= 10 ? "#bb8009" : "#cf2f2f";
      } else {
        text = "TAA \u00b7 send a message to see usage";
        color = "#6e6e6e";
      }

      const badge = ensureBadge();
      badge.style.display = "block";
      badge.style.background = color;
      badge.textContent = text;

      chats[key] = {
        size: chatSize,
        title: document.title.replace(/\s*[-|]\s*Claude.*$/i, "").trim() || key,
        url: location.href, updated: Date.now()
      };
      chrome.storage.local.set({ taa_chats: chats, taa_current: { size: chatSize } });
    });
  } catch (e) {}
}

const timer = setInterval(update, 3000);
update();
