// TAA content script. Badge (usage left) + history scanner. All local.

const CHARS_PER_TOKEN = 4;
let liveMaxText = "", lastKey = null, limitData = null, scanRunning = false;

function alive() { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } }
function isChatPage() { return location.pathname.indexOf("/chat/") !== -1; }
function estTokens(t) { const c = (t || "").replace(/\s+/g, " ").trim(); return Math.round(c.length / CHARS_PER_TOKEN); }
function domText() { const m = document.querySelector("main"); let t = m && m.innerText ? m.innerText : ""; if (!t && document.body) t = document.body.innerText || ""; return t; }
function fresh(w) { return w && w.resets_at && (w.resets_at * 1000 > Date.now()); }
function leftPct(w) { return Math.max(0, Math.round((1 - (w.utilization || 0)) * 100)); }

function getStore(keys) { return new Promise((r) => { try { chrome.storage.local.get(keys, (v) => r(v || {})); } catch (e) { r({}); } }); }
function setStore(obj) { return new Promise((r) => { try { chrome.storage.local.set(obj, () => r()); } catch (e) { r(); } }); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

try { chrome.storage.local.get(["taa_limit"], (r) => { if (r && r.taa_limit) limitData = r.taa_limit; }); } catch (e) {}

function ensureBadge() {
  let b = document.getElementById("taa-badge");
  if (!b) {
    b = document.createElement("div");
    b.id = "taa-badge";
    b.style.cssText = ["position:fixed", "bottom:16px", "right:16px", "z-index:2147483647", "font-family:ui-sans-serif,system-ui,sans-serif", "font-size:12px", "font-weight:600", "letter-spacing:.2px", "padding:6px 11px", "border-radius:999px", "color:#fff", "box-shadow:0 2px 10px rgba(0,0,0,.35)", "user-select:none", "transition:background .3s ease"].join(";");
    document.body.appendChild(b);
  }
  return b;
}

// --- history scanner ---
function msgText(item) {
  if (!item || typeof item !== "object") return "";
  if (Array.isArray(item.content)) { let o = ""; for (const b of item.content) if (b && typeof b.text === "string") o += b.text + " "; if (o.trim()) return o.trim(); }
  if (typeof item.text === "string") return item.text;
  return "";
}
function collectMsgTexts(obj, best) {
  best = best || { n: 0, texts: [] };
  if (!obj || typeof obj !== "object") return best;
  if (Array.isArray(obj)) {
    const texts = [];
    for (const it of obj) { const t = msgText(it); if (t) texts.push(t); }
    if (texts.length > best.n) best = { n: texts.length, texts: texts };
    for (const it of obj) best = collectMsgTexts(it, best);
    return best;
  }
  for (const k in obj) best = collectMsgTexts(obj[k], best);
  return best;
}

async function fetchChat(org, c) {
  try {
    const res = await fetch("/api/organizations/" + org + "/chat_conversations/" + c.uuid, { credentials: "include" });
    if (!res.ok) return (res.status === 401 || res.status === 403) ? "blocked" : null;
    const data = await res.json();
    const texts = collectMsgTexts(data).texts;
    let chars = 0; for (const t of texts) chars += t.length;
    return { messages: texts.length, est: Math.round(chars / CHARS_PER_TOKEN), updated_at: c.updated_at, created_at: c.created_at, name: c.name, model: c.model };
  } catch (e) { return null; }
}

async function fetchAllChats(org) {
  let offset = 0, all = [], hasMore = true, guard = 0, complete = false;
  while (hasMore && guard < 200) {
    let res;
    try { res = await fetch("/api/organizations/" + org + "/chat_conversations_v2?limit=30&offset=" + offset + "&consistency=eventual", { credentials: "include" }); }
    catch (e) { break; }
    if (!res.ok) break;
    let j; try { j = await res.json(); } catch (e) { break; }
    const page = (j && j.data) ? j.data : (Array.isArray(j) ? j : []);
    for (const c of page) if (c && c.uuid) all.push({ uuid: c.uuid, name: c.name || c.summary || "chat", created_at: c.created_at || "", updated_at: c.updated_at || "", model: c.model || "" });
    hasMore = !!(j && j.has_more);
    if (!hasMore) complete = true;
    offset += 30;
    guard++;
    await sleep(120);
  }
  return { chats: all, complete: complete };
}

let fullScanDone = false;
async function ensureFullScan(org, fallback) {
  if (!org || fullScanDone) return;
  fullScanDone = true;
  const r = await fetchAllChats(org);
  let chats = r.chats, complete = r.complete;
  if (!chats.length && fallback && fallback.length) { chats = fallback; complete = false; }
  try { await setStore({ taa_listmeta: { complete: complete, total: chats.length } }); } catch (e) {}
  await scanChats(org, chats);
}

async function scanChats(org, chats) {
  if (scanRunning || !org || !chats || !chats.length) return;
  scanRunning = true;
  try {
    const store = await getStore(["taa_history"]);
    const history = store.taa_history || {};
    const todo = chats.filter((c) => !history[c.uuid] || history[c.uuid].updated_at !== c.updated_at);
    const total = chats.length;
    let done = total - todo.length, blocked = false;
    await setStore({ taa_scan: { done: done, total: total, scanning: todo.length > 0, blocked: false } });
    const BATCH = 4;
    for (let i = 0; i < todo.length && !blocked; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((c) => fetchChat(org, c)));
      for (let j = 0; j < batch.length; j++) {
        if (results[j] === "blocked") { blocked = true; break; }
        if (results[j]) history[batch[j].uuid] = results[j];
        done++;
      }
      await setStore({ taa_history: history, taa_scan: { done: done, total: total, scanning: !blocked, blocked: blocked } });
      await sleep(150);
    }
    await setStore({ taa_scan: { done: done, total: total, scanning: false, blocked: blocked } });
  } catch (e) {} finally { scanRunning = false; }
}

function onHookMessage(e) {
  try {
    if (!alive()) { window.removeEventListener("message", onHookMessage); return; }
    if (e.source !== window) return;
    const d = e.data; if (!d) return;
    if (d.__taa_list === true && d.org && Array.isArray(d.chats)) {
      ensureFullScan(d.org, d.chats);
      return;
    }
    if (d.__taa_limit === true && d.windows) { limitData = { windows: d.windows }; try { chrome.storage.local.set({ taa_limit: limitData }); } catch (x) {} return; }
    if (d.__taa === true && typeof d.text === "string") { if (d.text.length > liveMaxText.length) liveMaxText = d.text; }
  } catch (err) {}
}
window.addEventListener("message", onHookMessage);

function update() {
  if (!alive()) { clearInterval(timer); return; }
  const ex = document.getElementById("taa-badge");
  if (!isChatPage()) { if (ex) ex.style.display = "none"; return; }
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
      if (w5 && fresh(w5)) { const left = leftPct(w5); text = "TAA \u00b7 " + left + "% usage left"; color = left >= 30 ? "#2ea043" : left >= 10 ? "#bb8009" : "#cf2f2f"; }
      else { text = "TAA \u00b7 send a message to see usage"; color = "#6e6e6e"; }
      const b = ensureBadge(); b.style.display = "block"; b.style.background = color; b.textContent = text;
      chats[key] = { size: chatSize, title: document.title.replace(/\s*[-|]\s*Claude.*$/i, "").trim() || key, url: location.href, updated: Date.now() };
      chrome.storage.local.set({ taa_chats: chats, taa_current: { size: chatSize } });
    });
  } catch (e) {}
}
const timer = setInterval(update, 3000);
update();
