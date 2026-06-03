// TAA page hook. Runs in claude.ai's page context. Reads copies of responses to
// (a) estimate conversation text size and (b) read the EXACT rate-limit usage
// that Claude reports in the completion stream. Never blocks or alters requests.

(function () {
  if (window.__taaHookLoaded) return;
  window.__taaHookLoaded = true;

  let latest = { text: "", count: 0 };
  function resetForNav() { latest = { text: "", count: 0 }; }

  function extractText(item) {
    if (!item || typeof item !== "object") return "";
    if (Array.isArray(item.content)) {
      let out = "";
      for (const b of item.content) if (b && typeof b.text === "string") out += b.text + " ";
      if (out.trim()) return out.trim();
    }
    if (typeof item.content === "string") return item.content.trim();
    if (typeof item.text === "string") return item.text.trim();
    return "";
  }

  function findConversation(obj, best) {
    best = best || { len: 0, text: "", count: 0 };
    if (!obj || typeof obj !== "object") return best;
    if (Array.isArray(obj)) {
      let combined = "", hits = 0;
      for (const item of obj) { const t = extractText(item); if (t) { combined += t + "\n"; hits++; } }
      if (hits > 0 && combined.length > best.len) best = { len: combined.length, text: combined, count: hits };
      for (const item of obj) best = findConversation(item, best);
      return best;
    }
    for (const k in obj) best = findConversation(obj[k], best);
    return best;
  }

  // Exact rate-limit windows that Claude reports in the completion stream.
  function parseLimitFromSSE(text) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (t.indexOf("data:") !== 0) continue;
      const p = t.slice(5).trim();
      if (!p) continue;
      let o; try { o = JSON.parse(p); } catch (e) { continue; }
      const ml = o && o.message_limit ? o.message_limit : null;
      if (ml && ml.windows) return { windows: ml.windows, claim: ml.representativeClaim || "" };
    }
    return null;
  }

  function postText() { window.postMessage({ __taa: true, text: latest.text, count: latest.count }, "*"); }
  function postLimit(l) { window.postMessage({ __taa_limit: true, windows: l.windows, claim: l.claim }, "*"); }

  function consider(data) {
    try {
      const r = findConversation(data);
      if (r.text && r.text.length > latest.text.length) { latest = { text: r.text, count: r.count }; postText(); }
    } catch (e) {}
  }

  // Read the completion stream chunk by chunk and pull the limit windows out of it.
  function readLimitFromStream(res) {
    let reader; try { reader = res.clone().body.getReader(); } catch (e) { return; }
    const dec = new TextDecoder(); let buf = "", done = false;
    function check() { if (done) return; const l = parseLimitFromSSE(buf); if (l) { done = true; postLimit(l); } }
    function pump() {
      reader.read().then((r) => {
        if (r.done) { check(); return; }
        buf += dec.decode(r.value, { stream: true });
        check();
        pump();
      }).catch(function () { check(); });
    }
    pump();
  }

  const origFetch = window.fetch;
  window.fetch = function (input) {
    return origFetch.apply(this, arguments).then((res) => {
      try {
        const ct = res.headers.get("content-type") || "";
        if (ct.indexOf("text/event-stream") !== -1) readLimitFromStream(res);
        else if (ct.indexOf("application/json") !== -1) res.clone().json().then(consider).catch(function () {});
      } catch (e) {}
      return res;
    });
  };

  const oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__u = url; return oOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      try {
        const ct = this.getResponseHeader("content-type") || "";
        if (ct.indexOf("application/json") !== -1) consider(JSON.parse(this.responseText));
        else if (ct.indexOf("text/event-stream") !== -1) { const l = parseLimitFromSSE(this.responseText); if (l) postLimit(l); }
      } catch (e) {}
    });
    return oSend.apply(this, arguments);
  };

  const oPush = history.pushState; history.pushState = function () { resetForNav(); return oPush.apply(this, arguments); };
  const oRep = history.replaceState; history.replaceState = function () { resetForNav(); return oRep.apply(this, arguments); };
  window.addEventListener("popstate", resetForNav);

  setInterval(postText, 1500);
})();
