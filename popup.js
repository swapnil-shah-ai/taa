function color(left) { return left >= 30 ? "#2ea043" : left >= 10 ? "#bb8009" : "#cf2f2f"; }
function inWords(u) { if (!u) return ""; let m = Math.round((u * 1000 - Date.now()) / 60000); if (m <= 0) return "now"; if (m < 60) return m + " min"; const h = Math.floor(m / 60), mm = m % 60; if (h < 24) return h + "h" + (mm ? " " + mm + "m" : ""); const d = Math.floor(h / 24), rh = h % 24; return d + "d" + (rh ? " " + rh + "h" : ""); }
function statusLine(l) { if (l >= 30) return "Plenty left, keep going."; if (l >= 10) return "Running low, you may be paused soon."; if (l > 0) return "Almost out."; return "You're paused until it resets."; }

function renderUsage() {
  chrome.storage.local.get(["taa_limit"], (res) => {
    const box = document.getElementById("usageBox"); const lim = res.taa_limit;
    if (!lim || !lim.windows || !lim.windows["5h"]) return;
    const w5 = lim.windows["5h"];
    if (!(w5.resets_at && w5.resets_at * 1000 > Date.now())) { box.innerHTML = '<div class="empty">Send a message in Claude to refresh your usage.</div>'; return; }
    const left = Math.max(0, Math.round((1 - (w5.utilization || 0)) * 100)); const c = color(left);
    let h = '<div class="big" style="color:' + c + '">' + left + '% left</div>';
    h += '<div class="sub">refills fully in ' + inWords(w5.resets_at) + '</div>';
    h += '<div class="bar"><span style="width:' + left + '%;background:' + c + '"></span></div>';
    h += '<div class="status" style="color:' + c + '">' + statusLine(left) + '</div>';
    const w7 = lim.windows["7d"]; if (w7) { const wl = Math.max(0, Math.round((1 - (w7.utilization || 0)) * 100)); h += '<div class="week">This week: ' + wl + '% left, resets in ' + inWords(w7.resets_at) + '.</div>'; }
    box.innerHTML = h;
  });
}

function renderHistory() {
  chrome.storage.local.get(["taa_history", "taa_scan", "taa_listmeta"], (res) => {
    const box = document.getElementById("historyBox");
    const h = res.taa_history || {}; const scan = res.taa_scan; const arr = Object.values(h);
    const meta = res.taa_listmeta; const complete = meta && meta.complete;
    if (scan && scan.blocked && !arr.length) { box.innerHTML = '<div class="note">Couldn\u2019t read your chats directly, the site blocked it. They\u2019ll be added as you open them.</div>'; return; }
    if (!arr.length) { box.innerHTML = scan && scan.scanning ? '<div class="empty">Scanning ' + scan.done + '/' + scan.total + '\u2026</div>' : '<div class="empty">Open claude.ai to scan your chats.</div>'; return; }
    const chats = arr.length;
    const msgs = arr.reduce((s, c) => s + (c.messages || 0), 0);
    const est = arr.reduce((s, c) => s + (c.est || 0), 0);
    let html = '<div class="mid">' + chats + (complete ? ' chats' : ' chats found so far') + '</div>';
    html += '<div class="sub">' + msgs.toLocaleString() + ' messages \u00b7 ~' + est.toLocaleString() + ' tokens (rough)</div>';
    if (scan && scan.scanning) html += '<div class="note">scanning ' + scan.done + '/' + scan.total + '\u2026</div>';
    else if (!complete) html += '<div class="note">Claude loads chats a page at a time. Scroll your chat list to load the rest.</div>';
    const models = {}; arr.forEach((c) => { if (c.model) { const k = c.model.replace("claude-", ""); models[k] = (models[k] || 0) + 1; } });
    const mt = Object.keys(models).map((k) => k + ": " + models[k]).join(" \u00b7 ");
    if (mt) html += '<div class="note">' + mt + '</div>';
    html += '<div class="note">Estimate of text only. Images and documents aren\u2019t counted. Work in progress.</div>';
    box.innerHTML = html;
  });
}

function renderChat() {
  chrome.storage.local.get(["taa_current"], (res) => {
    const box = document.getElementById("chatBox"); const cur = res.taa_current; if (!cur) return;
    const k = Math.round((cur.size || 0) / 1000);
    box.innerHTML = '<div class="mid">about ' + k + 'k long</div><div class="note">Rough size of this chat\u2019s text. The real size is bigger once images and files are counted.</div>';
  });
}

renderUsage();
renderHistory();
renderChat();
