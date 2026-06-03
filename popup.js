// TAA popup. Reads only from local storage. No network calls.
const COLORS = { green: "#2ea043", amber: "#bb8009", red: "#cf2f2f" };
function pctColor(p) { if (p < 50) return COLORS.green; if (p < 80) return COLORS.amber; return COLORS.red; }

function resetsIn(unixSec) {
  if (!unixSec) return "";
  const mins = Math.round((unixSec * 1000 - Date.now()) / 60000);
  if (mins <= 0) return "resets soon";
  if (mins < 60) return "resets in " + mins + "m";
  const h = Math.floor(mins / 60), m = mins % 60;
  return "resets in " + h + "h" + (m ? " " + m + "m" : "");
}

const LABELS = { "5h": "5-hour window", "7d": "7-day window" };

function renderLimits() {
  chrome.storage.local.get(["taa_limit"], (res) => {
    const box = document.getElementById("limits");
    const lim = res.taa_limit;
    if (!lim || !lim.windows) return;
    let html = "";
    ["5h", "7d"].forEach((k) => {
      const w = lim.windows[k];
      if (!w) return;
      const pct = Math.round((w.utilization || 0) * 100);
      const c = pctColor(pct);
      html += '<div class="row"><label>' + LABELS[k] + '</label><span class="val" style="color:' + c + '">' + pct + '% used</span></div>';
      html += '<div class="bar"><span style="width:' + pct + '%;background:' + c + '"></span></div>';
      html += '<div class="note" style="margin-top:4px">' + resetsIn(w.resets_at) + '</div>';
    });
    if (html) box.innerHTML = html;
  });
}

function renderCtx() {
  chrome.storage.local.get(["taa_chats"], (res) => {
    const chats = res.taa_chats || {};
    const cur = chats[location_path()] || mostRecent(chats);
    document.getElementById("ctx").textContent = cur ? "~" + (cur.est || 0).toLocaleString() + " tokens" : "\u2014";
  });
}
function location_path() { return null; } // popup can't read the tab path; fall back to most recent
function mostRecent(chats) {
  const arr = Object.values(chats).sort((a, b) => b.updated - a.updated);
  return arr[0];
}

function renderChats() {
  chrome.storage.local.get(["taa_chats"], (res) => {
    const chats = res.taa_chats || {};
    const arr = Object.values(chats).sort((a, b) => b.updated - a.updated);
    const box = document.getElementById("chats");
    if (!arr.length) { box.innerHTML = '<div class="empty">Open a chat to start tracking.</div>'; return; }
    box.innerHTML = arr.map((c) => {
      const name = (c.title || "chat").replace(/</g, "&lt;");
      return '<div class="chat"><span class="name">' + name + '</span><span class="v">~' + (c.est || 0).toLocaleString() + ' est</span></div>';
    }).join("");
  });
}

document.getElementById("reset").addEventListener("click", () => {
  chrome.storage.local.set({ taa_chats: {} }, () => { renderChats(); renderCtx(); });
});

function num(id) { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : v; }
function computeValue() {
  const sub = num("sub");
  const cost = num("inTok") * num("inRate") + num("outTok") * num("outRate");
  document.getElementById("apiCost").textContent = Math.round(cost).toLocaleString();
  const v = document.getElementById("verdict");
  if (cost > sub) { v.className = "save"; v.textContent = "Subscription is cheaper by " + Math.round(cost - sub).toLocaleString() + " vs per-token."; }
  else if (cost < sub) { v.className = "over"; v.textContent = "Per-token would be cheaper by " + Math.round(sub - cost).toLocaleString() + "."; }
  else { v.className = ""; v.textContent = "Break-even."; }
}
["sub", "inTok", "outTok", "inRate", "outRate"].forEach((id) => document.getElementById(id).addEventListener("input", computeValue));

renderLimits();
renderCtx();
renderChats();
computeValue();
