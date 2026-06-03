// TAA page hook. Reads copies of responses: conversation text (estimate),
// the exact rate-limit usage (completion stream), and your chat list.
// Never blocks or alters requests.

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

  function shortPath(url) { try { return new URL(url, location.origin).pathname; } catch (e) { return String(url); } }

  // Find the biggest array of chat-summary objects (your conversation list).
  function detectChatList(obj, url, best) {
    best = best || { count: 0, items: null, path: "" };
    if (!obj || typeof obj !== "object") return best;
    if (Array.isArray(obj)) {
      const items = [];
      for (const it of obj) {
        if (it && typeof it === "object" && it.uuid && (it.name !== undefined || it.summary !== undefined) && (it.created_at || it.updated_at)) {
          items.push({ uuid: it.uuid, name: it.name || it.summary || "chat", created_at: it.created_at || "", updated_at: it.updated_at || "", model: it.model || "" });
        }
      }
      if (items.length > best.count) best = { count: items.length, items: items, path: shortPath(url) };
      for (const it of obj) best = detectChatList(it, url, best);
      return best;
    }
    for (const k in obj) best = detectChatList(obj[k], url, best);
    return best;
  }

  function postText() { window.postMessage({ __taa: true, text: latest.text, count: latest.count }, "*"); }
  function postLimit(l) { window.postMessage({ __taa_limit: true, windows: l.windows, claim: l.claim }, "*"); }

  function consider(data, url) {
    try {
      const r = findConversation(data);
      if (r.text && r.text.length > latest.text.length) { latest = { text: r.text, count: r.count }; postText(); }
      const cl = detectChatList(data, url || "");
      if (cl.count > 1 && cl.items) {
        const m = (cl.path || "").match(/organizations\/([^/]+)\//);
        const envelope = Array.isArray(data) ? ("array[" + data.length + "]") : Object.keys(data).join(",");
        window.postMessage({ __taa_list: true, org: m ? m[1] : "", chats: cl.items, url: url || "", envelope: envelope }, "*");
      }
    } catch (e) {}
  }

  function readLimitFromStream(res) {
    let reader; try { reader = res.clone().body.getReader(); } catch (e) { return; }
    const dec = new TextDecoder(); let buf = "", done = false;
    function check() { if (done) return; const l = parseLimitFromSSE(buf); if (l) { done = true; postLimit(l); } }
    function pump() {
      reader.read().then((r) => { if (r.done) { check(); return; } buf += dec.decode(r.value, { stream: true }); check(); pump(); })
        .catch(function () { check(); });
    }
    pump();
  }

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    return origFetch.apply(this, arguments).then((res) => {
      try {
        const ct = res.headers.get("content-type") || "";
        if (ct.indexOf("text/event-stream") !== -1) readLimitFromStream(res);
        else if (ct.indexOf("application/json") !== -1) res.clone().json().then((d) => consider(d, url)).catch(function () {});
      } catch (e) {}
      return res;
    });
  };

  const oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__u = url; return oOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const self = this;
    this.addEventListener("load", function () {
      try {
        const ct = this.getResponseHeader("content-type") || "";
        if (ct.indexOf("application/json") !== -1) consider(JSON.parse(this.responseText), self.__u || "");
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
