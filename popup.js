// TAA popup. Plain language. Reads only local storage.

function color(left) { return left >= 30 ? "#2ea043" : left >= 10 ? "#bb8009" : "#cf2f2f"; }

function inWords(unixSec) {
  if (!unixSec) return "";
  let mins = Math.round((unixSec * 1000 - Date.now()) / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return mins + " min";
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return h + "h" + (m ? " " + m + "m" : "");
  const d = Math.floor(h / 24), rh = h % 24;
  return d + "d" + (rh ? " " + rh + "h" : "");
}

function statusLine(left) {
  if (left >= 30) return "Plenty left, keep going.";
  if (left >= 10) return "Running low, you may be paused soon.";
  if (left > 0) return "Almost out.";
  return "You're paused until it resets.";
}

function renderUsage() {
  chrome.storage.local.get(["taa_limit"], (res) => {
    const box = document.getElementById("usageBox");
    const lim = res.taa_limit;
    if (!lim || !lim.windows || !lim.windows["5h"]) return;

    const w5 = lim.windows["5h"];
    const fresh = w5.resets_at && (w5.resets_at * 1000 > Date.now());
    if (!fresh) {
      box.innerHTML = '<div class="empty">Send a message in Claude to refresh your usage.</div>';
      return;
    }

    const left = Math.max(0, Math.round((1 - (w5.utilization || 0)) * 100));
    const c = color(left);
    let html = '<div class="big" style="color:' + c + '">' + left + '% left</div>';
    html += '<div class="sub">refills fully in ' + inWords(w5.resets_at) + '</div>';
    html += '<div class="bar"><span style="width:' + left + '%;background:' + c + '"></span></div>';
    html += '<div class="status" style="color:' + c + '">' + statusLine(left) + '</div>';

    const w7 = lim.windows["7d"];
    if (w7) {
      const wl = Math.max(0, Math.round((1 - (w7.utilization || 0)) * 100));
      html += '<div class="week">This week: ' + wl + '% left, resets in ' + inWords(w7.resets_at) + '.</div>';
    }
    box.innerHTML = html;
  });
}

function renderChat() {
  chrome.storage.local.get(["taa_current"], (res) => {
    const box = document.getElementById("chatBox");
    const cur = res.taa_current;
    if (!cur) return;
    const k = Math.round((cur.size || 0) / 1000);
    box.innerHTML =
      '<div style="font-size:18px;font-weight:700">about ' + k + 'k long</div>' +
      '<div class="note">Rough size of this chat\u2019s text. Images and files aren\u2019t counted, so the real size is bigger. Long chats use more each message, start a fresh one if it slows down.</div>';
  });
}

renderUsage();
renderChat();
