// ============================================================================
// noticeEmail.js: the ONE template for notice emails (0.38.0).
//
// This exact file exists twice and must stay byte-identical:
//   src/noticeEmail.js                                  (app: in-app rendering + "See the email" preview)
//   supabase/functions/send-announcement/noticeEmail.js (what is actually sent)
// Change both together and bump NOTICE_EMAIL_VERSION when you do.
//
// Formatting is a small, safe markup that committee members can type:
//   **bold**   - bullet (or * or •)   1. numbered   [link text](https://...)
//   bare https:// links and email addresses become links; a blank line starts a new paragraph.
// Everything is escaped first; only http(s) and mailto links are ever produced,
// so nothing a poster types can inject HTML into an email or the app.
// No dependencies: plain JS that runs in the browser and in Deno.
// ============================================================================
export const NOTICE_EMAIL_VERSION = "2";

const NAVY = "#0B1F3A";
const INK = "#1F2937";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const REPLY_BG = "#EAF4FB";
const REPLY_LINE = "#B5D4F4";
const REPLY_INK = "#0C447C";

export const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeHref = (u) => {
  const t = String(u || "").trim();
  if (/^https?:\/\/[^\s<>"]+$/i.test(t)) return t;
  if (/^mailto:[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/i.test(t)) return t;
  return null;
};

// ---- parse: text -> blocks of runs ----------------------------------------
// run: { t: "text" | "b" | "a", text, href? } ; bold runs may not contain links.
const INLINE = /\*\*([^*\n]+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()"]+[^\s<>()".,;:!?'])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
export function parseInline(line) {
  const runs = []; let last = 0; let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(line))) {
    if (m.index > last) runs.push({ t: "text", text: line.slice(last, m.index) });
    if (m[1] != null) runs.push({ t: "b", text: m[1] });
    else if (m[2] != null) { const h = safeHref(m[3]); runs.push(h ? { t: "a", text: m[2], href: h } : { t: "text", text: m[0] }); }
    else if (m[4] != null) runs.push({ t: "a", text: m[4], href: m[4] });
    else if (m[5] != null) runs.push({ t: "a", text: m[5], href: "mailto:" + m[5] });
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push({ t: "text", text: line.slice(last) });
  return runs;
}

export function parseNotice(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = []; let para = null; let list = null;
  const flush = () => { if (para) { blocks.push(para); para = null; } if (list) { blocks.push(list); list = null; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const bullet = /^\s*(?:[-*•])\s+(.*)$/.exec(line);
    const num = /^\s*\d{1,2}[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { flush(); continue; }
    if (bullet || num) {
      const type = bullet ? "ul" : "ol";
      if (para) { blocks.push(para); para = null; }
      if (!list || list.type !== type) { if (list) blocks.push(list); list = { type, items: [] }; }
      list.items.push(parseInline((bullet || num)[1]));
      continue;
    }
    if (list) { blocks.push(list); list = null; }
    if (!para) para = { type: "p", lines: [] };
    para.lines.push(parseInline(line));
  }
  flush();
  return blocks;
}

// ---- render: blocks -> HTML (email) and plain text ------------------------
const runsHtml = (runs, linkColor) => runs.map((r) =>
  r.t === "b" ? `<strong>${esc(r.text)}</strong>`
  : r.t === "a" ? `<a href="${esc(r.href)}" style="color:${linkColor};text-decoration:underline">${esc(r.text)}</a>`
  : esc(r.text)).join("");

export function blocksHtml(blocks, linkColor = REPLY_INK) {
  const P = `margin:0 0 14px;font-size:16px;line-height:1.55;color:${INK}`;
  return blocks.map((b) => {
    if (b.type === "p") return `<p style="${P}">${b.lines.map((l) => runsHtml(l, linkColor)).join("<br>")}</p>`;
    const tag = b.type;
    return `<${tag} style="margin:0 0 14px;padding-left:22px;font-size:16px;line-height:1.55;color:${INK}">` +
      b.items.map((it) => `<li style="margin:0 0 6px">${runsHtml(it, linkColor)}</li>`).join("") + `</${tag}>`;
  }).join("");
}

const runsText = (runs) => runs.map((r) => r.t === "a" && r.text !== r.href && ("mailto:" + r.text) !== r.href ? `${r.text} (${r.href})` : r.text).join("");
export function blocksText(blocks) {
  return blocks.map((b) => b.type === "p" ? b.lines.map(runsText).join("\n")
    : b.items.map((it, i) => (b.type === "ol" ? `${i + 1}. ` : "- ") + runsText(it)).join("\n")).join("\n\n");
}

// ---- the email ------------------------------------------------------------
// opts: { buildingName, buildingInitials, logoUrl, title, body, noticeType,
//         photoUrl, posterName, posterRole, replyAddress, audienceLabel,
//         dateLabel, nalohubMarkUrl, waveUrl }
// waveUrl: the NaloHub wave, a 1200x64 PNG (about 1 KB) pre-painted on navy, shown
// at 600x32 along the bottom of the header. If images are blocked the row stays navy.
export function noticeHtml(o) {
  const blocks = parseNotice(o.body);
  const first = blocksText(blocks).split("\n")[0] || "";
  const bn = esc(o.buildingName || "Your building");
  const reply = o.replyAddress ? esc(o.replyAddress) : "";
  const mailto = o.replyAddress ? `mailto:${esc(o.replyAddress)}?subject=${encodeURIComponent("Re: " + (o.title || ""))}` : "";
  const kicker = o.noticeType && o.noticeType !== "General" ? esc(o.noticeType) : "Notice from your building";
  const logo = o.logoUrl
    ? `<img src="${esc(o.logoUrl)}" width="48" height="48" alt="${bn}" style="display:block;width:48px;height:48px;border-radius:10px;border:0;background:#ffffff">`
    : `<div style="width:48px;height:48px;line-height:48px;border-radius:10px;background:#ffffff;color:${NAVY};font-weight:800;font-size:17px;text-align:center;font-family:Arial,sans-serif">${esc((o.buildingInitials || o.buildingName || "?").slice(0, 3).toUpperCase())}</div>`;
  const photo = o.photoUrl
    ? `<tr><td style="padding:0 28px 18px"><img src="${esc(o.photoUrl)}" width="544" alt="Photo with this notice" style="display:block;width:100%;max-width:544px;height:auto;border-radius:10px;border:0"></td></tr>` : "";
  const role = o.posterRole ? ` · ${esc(o.posterRole)}` : "";
  const replyBar = reply ? `
  <tr><td style="padding:0 28px 22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${REPLY_BG};border:1px solid ${REPLY_LINE};border-radius:10px">
      <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;color:${REPLY_INK}">
        <div style="font-size:13px;line-height:1.4;margin:0 0 4px">Your building's email address</div>
        <div style="font-size:18px;line-height:1.35;font-weight:700;margin:0 0 6px"><a href="${mailto}" style="color:${REPLY_INK};text-decoration:none">${reply}</a></div>
        <div style="font-size:13px;line-height:1.45">Reply to this email and it reaches your committee. Save this address to your contacts so building emails land in your inbox, not junk.</div>
      </td></tr>
    </table>
  </td></tr>` : "";
  const button = reply ? `
  <tr><td style="padding:0 28px 26px">
    <a href="${mailto}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:12px 20px;border-radius:8px">Reply to your committee</a>
  </td></tr>` : "";
  const powered = o.nalohubMarkUrl
    ? `Powered by <img src="${esc(o.nalohubMarkUrl)}" width="54" height="18" alt="NaloHub" style="display:inline-block;width:54px;height:18px;border:0;vertical-align:middle;opacity:0.55">`
    : "Powered by NaloHub";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(first).slice(0, 140)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="background:${NAVY};padding:18px 28px ${o.waveUrl ? "6px" : "18px"}">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">${logo}</td>
      <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif">
        <div style="color:#ffffff;font-size:20px;line-height:1.25;font-weight:700">${bn}</div>
        <div style="color:#C9D6E8;font-size:13px;line-height:1.4">${kicker}</div>
      </td></tr></table>
  </td></tr>
  ${o.waveUrl ? `<tr><td height="32" style="background:${NAVY};padding:0;line-height:0;font-size:0"><img src="${esc(o.waveUrl)}" width="600" height="32" alt="" style="display:block;width:100%;max-width:600px;height:32px;border:0"></td></tr>` : ""}
  ${reply ? `<tr><td style="background:${REPLY_BG};border-bottom:1px solid ${REPLY_LINE};padding:9px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:${REPLY_INK}">Replies go to <a href="${mailto}" style="color:${REPLY_INK};font-weight:700;text-decoration:none">${reply}</a>. Save it to your contacts.</td></tr>` : ""}
  <tr><td style="padding:26px 28px 6px"><h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${NAVY};font-family:Arial,Helvetica,sans-serif">${esc(o.title)}</h1></td></tr>
  <tr><td style="padding:0 28px 6px;font-family:Arial,Helvetica,sans-serif">${blocksHtml(blocks)}</td></tr>
  ${photo}
  <tr><td style="padding:4px 28px 22px;font-family:Arial,Helvetica,sans-serif">
    <div style="border-top:1px solid ${LINE};padding-top:14px">
      <div style="font-size:15px;line-height:1.4;color:${INK};font-weight:700">${esc(o.posterName || "Your committee")}</div>
      <div style="font-size:13px;line-height:1.45;color:${MUTED}">${bn}${role}${o.dateLabel ? ` · ${esc(o.dateLabel)}` : ""}</div>
    </div>
  </td></tr>
  ${replyBar}
  ${button}
  <tr><td style="background:#F9FAFB;border-top:1px solid ${LINE};padding:14px 28px;font-family:Arial,Helvetica,sans-serif">
    <div style="font-size:12px;line-height:1.5;color:${MUTED}">You're receiving this because you're on the register for ${bn}${o.audienceLabel ? ` and this notice was sent to ${esc(o.audienceLabel)}` : ""}.</div>
    <div style="font-size:11px;line-height:1.5;color:#9CA3AF;margin-top:8px">${powered}</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function noticeText(o) {
  const body = blocksText(parseNotice(o.body));
  const reply = o.replyAddress ? `\n\nYOUR BUILDING'S EMAIL ADDRESS: ${o.replyAddress}\nReply to this email and it reaches your committee. Save this address to your contacts so building emails land in your inbox, not junk.` : "";
  return `${o.buildingName || "Your building"}\n${o.noticeType && o.noticeType !== "General" ? o.noticeType : "Notice from your building"}\n\n${o.title || ""}\n\n${body}\n\n${o.posterName || "Your committee"}\n${o.buildingName || ""}${o.posterRole ? " · " + o.posterRole : ""}${reply}\n\nYou're receiving this because you're on the register for ${o.buildingName || "your building"}${o.audienceLabel ? ` and this notice was sent to ${o.audienceLabel}` : ""}.\nPowered by NaloHub`;
}
