// TAA content script (isolated). Draws the badge, stores readings. All local.

const TAA = { CHARS_PER_TOKEN: 4, CONTEXT_LIMIT: 200000 };

let liveMaxText = "";
let lastKey = null;
let limitData = null;   // { windows, claim } - exact, from the completion stream

function contextAlive() { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } }
function isChatPage() { return location.pathname.indexOf("/chat/") !== -1; }
function estimateTokens(text) { const c = (text || "").replace(/\s+/g, " ").trim(); return Math.round(c.length / TAA.CHARS_PER_TOKEN); }
function domText() {
  const main = document.querySelector("main");
  let t = main && main.innerText ? main.innerText : "";
  if (!t && document.body) t = document.body.innerText || "";
  return t;
}
function colorByPct(p) { if (p < 50) return "#2ea043"; if (p < 80) return "#bb8009"; return "#cf2f2f"; }
function colorByTokens(t) { if (t < 100000) return "#2ea043"; if (t < 160000) return "#bb8009"; return "#cf2f2f"; }

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
      limitData = { windows: d.windows, claim: d.claim || "" };
      try { chrome.storage.local.set({ taa_limit: limitData, taa_limit_ts: Date.now() }); } catch (x) {}
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

  const est = Math.max(estimateTokens(liveMaxText), estimateTokens(domText()));

  try {
    chrome.storage.local.get(["taa_chats"], (res) => {
      const chats = res.taa_chats || {};
      const prevEst = chats[key] ? chats[key].est : 0;
      const estTokens = Math.max(prevEst || 0, est);

      let text, color;
      if (limitData && limitData.windows && limitData.windows["5h"]) {
        const p5 = Math.round((limitData.windows["5h"].utilization || 0) * 100);
        text = "TAA \u00b7 ~" + estTokens.toLocaleString() + " est \u00b7 5h limit " + p5 + "%";
        color = colorByPct(p5);
      } else {
        text = "TAA \u00b7 ~" + estTokens.toLocaleString() + " tokens (est)";
        color = colorByTokens(estTokens);
      }

      const badge = ensureBadge();
      badge.style.display = "block";
      badge.style.background = color;
      badge.textContent = text;

      chats[key] = {
        est: estTokens,
        title: document.title.replace(/\s*[-|]\s*Claude.*$/i, "").trim() || key,
        url: location.href, updated: Date.now()
      };
      chrome.storage.local.set({ taa_chats: chats });
    });
  } catch (e) {}
}

const timer = setInterval(update, 3000);
update();
