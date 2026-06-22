import React, { useState, useContext, createContext, useMemo, useEffect } from "react";
import {
  Megaphone, Wrench, CalendarDays, CalendarCheck, Image as ImageIcon, ShoppingBag,
  MessageSquare, FileText, Users, ClipboardCheck, Plus, X, Check, ChevronRight, ChevronLeft,
  ArrowLeft, Menu, Building2, Settings, Car, ArrowUpDown, Flame, MapPin, Pin, UserPlus,
  AlertCircle, Clock as ClockIcon, Lock, LayoutDashboard, Mail, Eye, Home, Sparkles, Upload, Paperclip,
  Tag, Calendar, Phone, RefreshCw, Sofa, Dumbbell, FolderOpen, Trash2,
  Sun, Cloud, CloudRain, CloudSun, Gavel, Wind, MessageCircle, Download, Printer, BarChart3,
  Video, ExternalLink, ListChecks, Vote, KeyRound, ShieldAlert, Store, ThumbsUp, HelpCircle, Pencil,
} from "lucide-react";

/*
  Resident Portal — multi-building prototype (v3)
  Greg provisions buildings; a BCC committee governs access + protected content per building.
  PROTOTYPE: in-session state, simulated auth/email. Supabase swap point = the `seed` object
  + role gates -> tables + RLS scoped by building_id.
*/

const PLATFORM = { name: "Resident Portal", version: "0.9.5" };
// Personalise the shared demo here — set a prospect's building name to create instant recognition.
// ── PERSONALISE THE DEMO ──────────────────────────────────────────────────
// Edit the defaults below, OR pass them in the share link (no file editing):
//   https://your-site.netlify.app/?building=Sunset%20Towers&suburb=Hamilton&tower=East%20Tower
const DEMO = (() => {
  const d = { buildingName: "Salt on Kings", address: "12 Kings Way, South Brisbane QLD", tower: "North Tower", theme: "midnight" };
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("building")) d.buildingName = q.get("building");
    if (q.get("address")) d.address = q.get("address");
    if (q.get("suburb")) d.address = q.get("suburb");
    if (q.get("tower")) d.tower = q.get("tower");
    if (q.get("theme")) d.theme = q.get("theme");
  } catch (e) {}
  return d;
})();
const CHANGELOG = [
  ["0.9.5", "Sun glows from the corner · shallower back wave · ?phase= preview"],
  ["0.9.4", "Taller waves · defined sun by day, stars by night"],
  ["0.9.3", "Animated header waves return — deeper header to accentuate them"],
  ["0.9.2", "Mobile fix: tour & info dialogs keep their buttons on screen"],
  ["0.9.1", "Personalise the demo via the share link (URL parameters)"],
  ["0.9.0", "Demo lands in-building · Settings reordered · editable events · action docs & edits"],
  ["0.8.1", "Single-file demo package · transparency on what’s simulated"],
  ["0.8.0", "Guided BCC walkthrough · Midnight Harbour demo theme · per-prospect building recognition"],
  ["0.7.0", "Editable building details · strata management contacts · expanded roles & phone on add-person · Title Case headings"],
  ["0.6.0", "Strata manager role · proposed motions & decision records · exportable decisions · self-service contact details · bulk import"],
  ["0.5.0", "Per-building feature toggles · privacy & terms · visible version"],
  ["0.4.0", "Key/fob register · fire safety · business directory"],
  ["0.3.0", "Action register · meeting agendas & voting · 100-unit demo sandbox"],
  ["0.2.0", "Detail views · gallery lightbox · directory controls · BCC reports"],
  ["0.1.0", "Themes · animated header · dashboard · core modules"],
];
const OPTIONAL_MODULES = ["events", "gallery", "marketplace", "messaging", "directory", "business", "documents", "meetings", "keyfobs", "firesafety"];
const moduleOn = (building, key) => !OPTIONAL_MODULES.includes(key) || (building && building.modules ? building.modules[key] !== false : true);
const MODULE_LABELS = { events: "Events", gallery: "Gallery", marketplace: "Marketplace", messaging: "Messaging", directory: "Directory", business: "Business Directory", documents: "Documents", meetings: "Meetings", keyfobs: "Key & Fob Register", firesafety: "Fire Safety", whatsapp: "WhatsApp Group" };

// ---------- themes ----------------------------------------------------------
const THEMES = [
  { id: "pacific", name: "Pacific Dawn", mode: "light", appBg: "#e8eff5", appBg2: "#f5f9fc", surface: "#ffffff", surfaceAlt: "#eef4f9", text: "#0e1b2b", textMuted: "#56697e", border: "#dde7f0", sidebar: "#0a2030", sidebarText: "#d6e4f0", sidebarMuted: "#7990a4", sidebarActive: "#143247", accent: "#0d7fc6", accent2: "#06b6c7", accent3: "#5b8def", accentText: "#ffffff", glow: "rgba(13,127,198,0.30)", headerFrom: "#145ea6", headerVia: "#0a8fb0", headerTo: "#0bb6c2" },
  { id: "verdant", name: "Verdant Hour", mode: "light", appBg: "#eaf2eb", appBg2: "#f4f9f4", surface: "#ffffff", surfaceAlt: "#eef5ef", text: "#16241a", textMuted: "#54685a", border: "#dde9df", sidebar: "#122c1c", sidebarText: "#dbeae0", sidebarMuted: "#7d958a", sidebarActive: "#1d4530", accent: "#2e9159", accent2: "#5fc06a", accent3: "#2bb39a", accentText: "#ffffff", glow: "rgba(46,145,89,0.30)", headerFrom: "#1d7a4c", headerVia: "#2fa05f", headerTo: "#57c06a" },
  { id: "violet", name: "Violet Mirage", mode: "light", appBg: "#efebf6", appBg2: "#f7f4fb", surface: "#ffffff", surfaceAlt: "#f1edf8", text: "#211a2e", textMuted: "#62596f", border: "#e6e0ef", sidebar: "#241531", sidebarText: "#e3daee", sidebarMuted: "#92829d", sidebarActive: "#38234e", accent: "#7d4cd6", accent2: "#b65bd0", accent3: "#5b6df0", accentText: "#ffffff", glow: "rgba(125,76,214,0.30)", headerFrom: "#6536c2", headerVia: "#8f47cf", headerTo: "#b95cd2" },
  { id: "terracotta", name: "Terracotta Sun", mode: "light", appBg: "#f4efe8", appBg2: "#fbf7f1", surface: "#fffdfa", surfaceAlt: "#f6f1eb", text: "#2a2016", textMuted: "#6c6052", border: "#e8e0d4", sidebar: "#2b2013", sidebarText: "#ece2d4", sidebarMuted: "#9a8b78", sidebarActive: "#45341f", accent: "#c66229", accent2: "#e89a3c", accent3: "#d9536b", accentText: "#ffffff", glow: "rgba(198,98,41,0.30)", headerFrom: "#a8521f", headerVia: "#cf7d2e", headerTo: "#e29a3a" },
  { id: "midnight", name: "Midnight Harbour", mode: "dark", appBg: "#060d16", appBg2: "#0a1422", surface: "#101d2e", surfaceAlt: "#16273b", text: "#e8eff7", textMuted: "#93a6bd", border: "#233346", sidebar: "#04090f", sidebarText: "#cdddec", sidebarMuted: "#6d8298", sidebarActive: "#142a40", accent: "#34a9ec", accent2: "#18cfd6", accent3: "#d9b25e", accentText: "#04121f", glow: "rgba(52,169,236,0.42)", headerFrom: "#0b2f4e", headerVia: "#0e5570", headerTo: "#0b7d86" },
  { id: "forest", name: "Forest Noir", mode: "dark", appBg: "#05100b", appBg2: "#08180f", surface: "#0d1f15", surfaceAlt: "#122a1d", text: "#e4f1e8", textMuted: "#88a596", border: "#1c3528", sidebar: "#030b07", sidebarText: "#cee9d8", sidebarMuted: "#6c8a7a", sidebarActive: "#103024", accent: "#2fc97f", accent2: "#62e08c", accent3: "#d8c98a", accentText: "#04140c", glow: "rgba(47,201,127,0.40)", headerFrom: "#0c3d28", headerVia: "#14633f", headerTo: "#1c8a55" },
  { id: "amethyst", name: "Amethyst Dusk", mode: "dark", appBg: "#0e0816", appBg2: "#150d20", surface: "#1b1228", surfaceAlt: "#241834", text: "#efe6f6", textMuted: "#a596b4", border: "#2f2342", sidebar: "#0a0512", sidebarText: "#ddd0ea", sidebarMuted: "#897a96", sidebarActive: "#2a1a3c", accent: "#b06bf2", accent2: "#e070cf", accent3: "#ff8fb0", accentText: "#150a22", glow: "rgba(176,107,242,0.42)", headerFrom: "#3f2566", headerVia: "#6a3a9e", headerTo: "#9b4fc4" },
  { id: "obsidian", name: "Obsidian Ember", mode: "dark", appBg: "#07070a", appBg2: "#0d0d11", surface: "#141418", surfaceAlt: "#1c1c22", text: "#efeef0", textMuted: "#9b9aa3", border: "#28282f", sidebar: "#050507", sidebarText: "#d8d7db", sidebarMuted: "#7d7c85", sidebarActive: "#20202a", accent: "#e6a23c", accent2: "#f0c45a", accent3: "#c77b4a", accentText: "#1a1206", glow: "rgba(230,162,60,0.40)", headerFrom: "#2a2a30", headerVia: "#3a342c", headerTo: "#1d1a16" },
  { id: "aurora", name: "Aurora Noir", mode: "dark", appBg: "#050f0e", appBg2: "#081a17", surface: "#0d201d", surfaceAlt: "#122a26", text: "#e2f3ee", textMuted: "#84a89f", border: "#1c3631", sidebar: "#040d0c", sidebarText: "#cce8e0", sidebarMuted: "#6c8a82", sidebarActive: "#103029", accent: "#25d6c0", accent2: "#56e08a", accent3: "#8f7df0", accentText: "#04140f", glow: "rgba(37,214,192,0.42)", headerFrom: "#0d3a3a", headerVia: "#135e54", headerTo: "#1f7d8f" },
  { id: "velvet", name: "Velvet Rosé", mode: "dark", appBg: "#100a0d", appBg2: "#170f13", surface: "#1d141a", surfaceAlt: "#271a22", text: "#f4e8ee", textMuted: "#b297a2", border: "#34232e", sidebar: "#0b0609", sidebarText: "#f0dce4", sidebarMuted: "#a3848f", sidebarActive: "#2c1a25", accent: "#e85d7a", accent2: "#f59079", accent3: "#e0b15e", accentText: "#1c0a10", glow: "rgba(232,93,122,0.42)", headerFrom: "#4a1f2e", headerVia: "#7d2f43", headerTo: "#c24a63" },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

const SEMANTIC = { ok: "#1f9d57", warn: "#cf8a23", bad: "#d6455d" };
function hexToRgba(hex, a) { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; }

const HUE = {
  announcements: ["#f59e0b", "#f97316"], maintenance: ["#fb7185", "#f43f5e"], bookings: ["#34d399", "#10b981"],
  events: ["#60a5fa", "#3b82f6"], gallery: ["#e879f9", "#d946ef"], documents: ["#818cf8", "#6366f1"],
  approvals: ["#fbbf24", "#f59e0b"], marketplace: ["#2dd4bf", "#14b8a6"], messaging: ["#a78bfa", "#8b5cf6"],
  directory: ["#38bdf8", "#0ea5e9"], meetings: ["#94a3b8", "#64748b"], reports: ["#f472b6", "#db2777"], settings: ["#cbd5e1", "#94a3b8"],
};

const ROLE_LABEL = { admin: "Platform admin", bcc: "Committee (BCC)", manager: "Building manager", strata: "Strata manager", owner: "Owner", tenant: "Tenant" };
const isApprover = (r) => r === "bcc" || r === "manager" || r === "admin";
const isCommittee = (r) => r === "bcc" || r === "admin";
const canMaint = (u) => u.role === "manager" || u.role === "bcc" || u.role === "admin" || u.msc === true;
const isStrata = (r) => r === "strata";

const TRUISMS = [
  "A good neighbour is a found treasure.", "Small kindnesses build great communities.", "The best time to help is now.",
  "Every door you hold open comes back to you.", "Home is a feeling, not just an address.", "Shared spaces shine when shared with care.",
  "Kindness costs nothing and means everything.", "A friendly hello can make someone's whole day.", "Together we tend what none of us could alone.",
  "Good things grow where good people gather.", "The smallest gesture can be the biggest help.", "A tidy hallway is a quiet act of respect.",
  "Community is built one conversation at a time.", "Look out for each other and everyone rises.", "Patience turns neighbours into friends.",
  "Where there is welcome, there is belonging.", "A little gratitude goes a remarkably long way.", "The strongest buildings are held up by their people.",
  "Be the neighbour you'd love to have.", "Every great place was built by people who cared.", "Lend a hand today; you'll need one someday.",
  "Warmth is the best thing to share.", "Good manners never go out of style.", "A shared smile is the shortest distance between people.",
  "Tend your corner and the whole place flourishes.", "The quiet helpers make the biggest difference.", "Respect given freely returns multiplied.",
  "We're all just walking each other home.", "A welcome mat is an open heart.", "Generosity is contagious — start the spread.",
  "Listen first; you'll be heard in return.", "Today is a good day to be a good neighbour.", "Little by little, a little becomes a lot.",
  "Kind words are easy to give and hard to forget.", "A helping hand lifts two people at once.", "Make room at the table and the table grows.",
  "Care is the rent we pay for a happy home.", "Bloom where you're planted, and help others bloom too.", "The best view is people looking out for one another.",
  "Leave things better than you found them.",
];

const MAINT_CATEGORIES = ["Electrical", "Plumbing", "Lifts", "Common area", "Security", "Cleaning", "Grounds & gardens", "Building structure", "Other"];
const DOC_CATEGORIES = ["Governance", "Financials", "Insurance", "Meetings", "Maintenance", "Safety", "Facilities", "Correspondence", "Other"];
const GALLERY_CATEGORIES = ["Events", "Building", "Grounds", "Social", "Works", "Other"];
const MSG_CATEGORIES = ["Application", "Complaint", "Idea", "Query"];
const NOTICE_TYPES = ["Notice of Meeting", "Notice of Special Meeting", "Notice of AGM", "Meeting Minutes"];
const BUSINESS_CATEGORIES = ["Accountant","Air-con / HVAC","Antenna / TV","Appliance repair","Beauty","Builder","Carpenter","Carpet cleaning","Caterer","Childcare","Cleaner","Concreter","Conveyancer / Solicitor","Courier","Dentist","Doctor / GP","Dry cleaning","Electrician","Florist","Gardener / Landscaper","Glazier","Gym / Fitness","Hairdresser","Handyman","Insurance broker","IT support","Locksmith","Mortgage broker","Painter","Pest control","Pharmacy","Photographer","Physio","Plasterer","Plumber","Pool maintenance","Real estate agent","Removalist","Roofer","Security / CCTV","Solar","Storage","Strata lawyer","Tiler","Vet","Window cleaning","Other"];

const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
const openExternal = (url) => { if (url) window.open(url, "_blank", "noopener"); };
const downloadText = (filename, text) => { const blob = new Blob([text], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const fmtDate = (iso) => { if (!iso) return ""; const p = String(iso).slice(0, 10).split("-"); return (p.length === 3) ? `${p[2]}/${p[1]}/${p[0]}` : iso; };
const AU_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];
const suburbFromAddress = (addr) => { if (!addr) return "Local"; const last = addr.split(",").pop().trim(); const toks = last.split(/\s+/).filter((t) => !AU_STATES.includes(t.toUpperCase()) && !/^\d{3,4}$/.test(t)); return toks.join(" ") || last; };

// ---------- seed ------------------------------------------------------------
// ---------- demo data generator (full sandbox: 100 units + simulated history) ----------
const FIRST = ["Sarah","David","Priya","Tom","Mia","Jordan","Anika","Beck","Cy","Lena","Raf","Nat","Sol","Indie","Bo","Quinn","Theo","Hana","Liam","Noor","Owen","Faye","Sam","Tara","Vik","Ed","Gita","Cass","Dom","Eli","Mara","Pete","Rosa","Ken","Joy","Hugo","Ivy","Leo","Mae","Otto","Pia","Reed","Sia","Uma","Wes","Cleo","Drew","Esme","Fox","Gwen"];
const LAST = ["McMahon","Nair","Whitfield","Cohen","Iverson","Tanaka","Reilly","Rao","Olsson","Fontaine","Marsh","Delgado","Beaumont","Kepler","Hart","Castellan","Adler","Vance","Pho","Anand","Ng","Brooks","Saito","Mercer","Khan","Doyle","Frost","Lim","Pace","Ruiz","Bauer","Sato","Cole","Ford","Greer","Ives","Jung","Kerr","Lowe","Quill"];
const MAINT_TITLES = { Electrical: ["Foyer light flickering","Carpark light out","Power trip in Lift 1 lobby"], Plumbing: ["Leaking tap in common room","Blocked drain basement","Hot water intermittent L3"], Lifts: ["Lift 2 jerky between L4-L5","Lift door slow to close"], "Common area": ["Torn carpet near mailboxes","Scuffed paint stairwell"], Security: ["Carpark roller door slow","Intercom panel faulty","Gate latch loose"], Cleaning: ["Bins overflowing weekends","Glass doors smudged"], "Grounds & gardens": ["Sprinkler stuck on","Hedge overgrown at entry"], "Building structure": ["Cracked tile poolside","Render flaking north wall"] };
function makeDemo() {
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const ri = (n, m) => n + Math.floor(Math.random() * (m - n + 1));
  const chance = (p) => Math.random() < p;
  const dAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const dAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const isoAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  const nm = () => rnd(FIRST) + " " + rnd(LAST);
  const ph = () => "04" + ri(10, 99) + " " + ri(100, 999) + " " + ri(100, 999);
  const uid = (() => { let i = 100; return () => "u" + (i++); })();
  const units = []; for (let fl = 1; fl <= 10; fl++) for (let n = 1; n <= 10; n++) units.push(fl + String(n).padStart(2, "0"));
  const users = [];
  users.push({ id: "u1", buildingId: "b1", name: "Greg Ferguson", unit: "606", role: "admin", status: "active", email: "greg@example.com", phone: ph(), directoryOptIn: true, showPhone: true, showEmail: true, msc: false, lastSeenGallery: isoAgo(20) });
  users.push({ id: "bm", buildingId: "b1", name: "Marcus Hale", unit: "G-Office", role: "manager", status: "active", email: "manager@example.com", phone: ph(), directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(20) });
  users.push({ id: "sm", buildingId: "b1", name: "Patricia Hewson", unit: "Strata", role: "strata", status: "active", email: "strata@example.com", phone: ph(), directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(20) });
  units.forEach((u) => { const occ = chance(0.35) ? 2 : 1; for (let k = 0; k < occ; k++) { const id = uid(); users.push({ id, buildingId: "b1", name: nm(), unit: u, role: chance(0.7) ? "owner" : "tenant", status: "active", email: id + "@example.com", phone: ph(), directoryOptIn: chance(0.6), showPhone: chance(0.5), showEmail: chance(0.4), msc: false, lastSeenGallery: isoAgo(ri(1, 40)) }); } });
  const owners = users.filter((u) => u.role === "owner");
  for (let i = 0; i < 5 && i < owners.length; i++) owners[i].role = "bcc";
  for (let i = 5; i < 8 && i < owners.length; i++) owners[i].msc = true;
  users.push({ id: "pend1", buildingId: "b1", name: nm(), unit: rnd(units), role: "owner", status: "pending", email: "new@example.com", phone: "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(1) });
  const bccNames = users.filter((u) => u.role === "bcc" || u.role === "admin").map((u) => u.name);
  const mscNames = users.filter((u) => u.msc).map((u) => u.name);
  const active = users.filter((u) => u.status === "active");
  const someName = () => rnd(active).name;
  const chair = bccNames[0] || "Committee";
  const announcements = [];
  const annSrc = [["Lift 2 maintenance scheduled","Lift 2 will be offline for its annual service. Please allow extra time and use Lift 1.",true],["Pool reopens after resurfacing","The pool is back open this weekend - updated rules are in Documents.",false],["Quarterly window cleaning","External window cleaning across all floors next Tuesday and Wednesday.",false],["New visitor parking process","Visitor stays over one night now route through the portal for approval.",false],["Garden working bee - volunteers welcome","Join us Saturday morning to tidy the courtyard. Coffee provided!",false],["Fire alarm testing","Routine alarm testing Thursday 10am. A brief siren is expected.",false],["AGM date confirmed","Save the date - the AGM will be held next month. Papers to follow.",true],["Bike rack expansion","Six new bike spaces added in the basement.",false],["Lobby refurbishment complete","Thanks for your patience - the lobby refresh is done.",false],["Balcony plant safety","Please secure balcony pots ahead of the windy season.",false],["Hot water system upgrade","Brief hot water outages possible Monday during the upgrade.",false],["Welcome to the new portal","This portal is now your home for notices, bookings and more.",false]];
  annSrc.forEach((a, i) => announcements.push({ id: "a" + i, buildingId: "b1", title: a[0], body: a[1], postedBy: chair, date: dAgo(i * 4 + 2), expiry: chance(0.5) ? dAhead(ri(5, 40)) : "", pinned: a[2], image: "", doc: chance(0.3) ? a[0].slice(0, 14) + ".pdf" : "", noticeType: "General", audience: "all" }));
  announcements.push({ id: "a-agm", buildingId: "b1", title: "Notice of Annual General Meeting", body: "Notice is given that the Annual General Meeting will be held next month. Agenda papers and proxy forms are attached. All owners are encouraged to attend in person or online.", postedBy: "Definitive Strata Co. (Strata manager)", date: dAgo(6), expiry: dAhead(24), pinned: false, image: "", doc: "AGM notice & agenda.pdf", noticeType: "Notice of AGM", audience: "owners" });
  const maintenance = []; const cats = Object.keys(MAINT_TITLES); const statuses = ["new", "triaged", "in_progress", "resolved"];
  for (let i = 0; i < 24; i++) {
    const cat = rnd(cats); const status = rnd(statuses); const assignee = chance(0.6) ? rnd(mscNames.concat(["Marcus Hale"])) : "";
    const m = { id: "m" + i, buildingId: "b1", title: rnd(MAINT_TITLES[cat]), category: cat, location: rnd(["Foyer","Basement","Level 3","Rooftop","Stairwell B","Poolside","Carpark","Common room"]), description: "Reported by a resident; details on file.", raisedBy: someName(), status, triageOwner: status === "new" ? "" : assignee, date: dAgo(ri(1, 60)), image: "", resolutions: [], updates: [] };
    if (status !== "new" && chance(0.6)) m.updates.push({ id: "up" + i, text: rnd(["Inspected; parts on order.","Contractor booked for next week.","Temporary fix applied, monitoring.","Awaiting quote approval."]), by: assignee || "Marcus Hale", date: dAgo(ri(1, 10)) });
    if ((status === "in_progress" || status === "resolved") && chance(0.7)) m.resolutions.push({ id: "r" + i, supplier: rnd(["DoorTech","BrightSpark Electrical","FlowFix Plumbing","CityLift Services","GreenScape Gardens"]), note: "Scope approved by sub-committee.", cost: "$" + ri(2, 24) * 100, quoteDoc: "Quote.pdf", sowDoc: chance(0.6) ? "Statement of work.pdf" : "", by: rnd(bccNames), date: dAgo(ri(2, 30)) });
    maintenance.push(m);
  }
  const facs = ["bbq","visitor","lift","common"]; const bookings = [];
  for (let i = 0; i < 28; i++) { const fac = rnd(facs); const future = chance(0.6); const base = future ? dAhead(ri(1, 30)) : dAgo(ri(1, 40)); const st = fac === "visitor" && chance(0.4) ? rnd(["pending","confirmed","declined"]) : "confirmed"; bookings.push({ id: "k" + i, buildingId: "b1", facility: fac, fromDate: base, toDate: fac === "visitor" ? dAhead(ri(1, 33)) : base, timeFrom: fac === "visitor" ? "" : rnd(["09:00","13:00","17:00"]), timeTo: fac === "visitor" ? "" : rnd(["13:00","17:00","21:00"]), bookedBy: someName(), status: st, note: chance(0.4) ? rnd(["Birthday","Moving in","Small gathering","Visitor from interstate"]) : "", decidedBy: (st === "confirmed" || st === "declined") ? chair : "", decidedAt: (st === "confirmed" || st === "declined") ? dAgo(ri(1, 10)) : "", decisionNote: st === "declined" ? "Clashes with another booking." : "" }); }
  const events = []; const evSrc = [["Winter rooftop sundowner","Rooftop terrace, Level 9"],["Residents coffee morning","Common room"],["Kids movie night","Common room"],["Building trivia night","Common room"],["Garden working bee","Courtyard"],["End of year drinks","Rooftop terrace"],["Yoga in the courtyard","Courtyard"],["New residents welcome","Lobby"]];
  evSrc.forEach((e, i) => { const fut = i < 5; events.push({ id: "e" + i, buildingId: "b1", title: e[0], date: fut ? dAhead(ri(2, 28)) : dAgo(ri(5, 40)), timeFrom: rnd(["10:00","17:30","18:00"]), timeTo: rnd(["12:00","20:00","21:00"]), location: e[1], teamsLink: chance(0.3) ? "https://teams.microsoft.com/l/meetup-join/EXAMPLE" : "", organiser: rnd(["Social Committee", chair]), image: "", doc: "", going: active.slice(0, ri(3, 12)).map((u) => u.name), maybe: active.slice(12, 12 + ri(1, 5)).map((u) => u.name), cantGo: [] }); });
  const galColors = ["#1763a8","#2f8f5b","#7c4dd1","#e2556f","#0aa8b0","#c2622e","#8f7df0"]; const gallery = [];
  ["Rooftop at dusk","Garden working bee","Lobby refresh","Trivia night","Pool reopening","Courtyard in bloom","Moving day","Sunset from L9","Festive lights","Coffee morning","New bike racks","Foyer artwork","Stairwell mural","Pool party","BBQ afternoon","Winter markets","Volunteer crew","Building at night"].forEach((c, i) => gallery.push({ id: "g" + i, buildingId: "b1", caption: c, category: rnd(GALLERY_CATEGORIES), color: rnd(galColors), image: "", postedBy: someName(), createdAt: isoAgo(ri(1, 50)) }));
  const marketplace = []; [["Bar stools x2 (oak)","$60"],["IKEA bookshelf","$40"],["Mountain bike","$220"],["Indoor plants bundle","$25"],["Microwave (near new)","$50"],["Sofa - 3 seater","$180"],["Standing desk","$120"],["Kids scooter","$30"],["Dining table","$150"],["Air fryer","$45"]].forEach((m, i) => { const u = rnd(active); marketplace.push({ id: "p" + i, buildingId: "b1", title: m[0], price: m[1], seller: u.name, contact: u.phone, desc: "Good condition. Pick up from Unit " + u.unit + ".", image: "", status: rnd(["active","active","active","pending","sold"]), createdAt: isoAgo(ri(1, 28)) }); });
  const messages = []; const msgSrc = [["Query","Bike storage","Is there room for one more bike in the basement rack?"],["Complaint","Noise after midnight","Ongoing late-night noise from the courtyard on weekends."],["Idea","Community garden","Could we start a herb garden on the rooftop?"],["Application","Renovation request","Requesting approval for bathroom renovation - see attached."],["Query","Parking allocation","Which bay is allocated to Unit 412?"],["Complaint","Lift wait times","Lifts are very slow in the morning peak."],["Idea","EV charging","Any plans for EV chargers in the basement?"],["Query","Pet registration","How do I register my dog on the portal?"]];
  for (let i = 0; i < 18; i++) { const sg = rnd(msgSrc); messages.push({ id: "msg" + i, buildingId: "b1", to: chance(0.7) ? "Committee (BCC)" : "Building manager", category: sg[0], from: someName(), subject: sg[1], body: sg[2], doc: sg[0] === "Application" ? "Application.pdf" : "", date: dAgo(ri(1, 40)) }); }
  const documents = [["By-laws (current)","Governance","all",true,"PDF"],["Emergency & evacuation plan","Safety","all",true,"PDF"],["Pool rules 2026","Facilities","all",true,"PDF"],["AGM 2026 minutes","Meetings","owners",true,"DOCX"],["Committee meeting minutes - May","Meetings","owners",true,"DOCX"],["Annual financial statements","Financials","owners",true,"PDF"],["Building insurance certificate","Insurance","all",true,"PDF"],["Fire safety statement","Safety","all",true,"PDF"],["Window cleaning contract","Correspondence","committee",false,"PDF"],["Draft 10-year capital works plan","Financials","committee",false,"XLSX"],["Lift maintenance agreement","Maintenance","committee",false,"PDF"],["Garden maintenance schedule","Facilities","all",true,"PDF"],["Pet policy","Governance","all",true,"PDF"],["Renovation guidelines","Governance","all",true,"PDF"]].map((d, i) => ({ id: "d" + i, buildingId: "b1", title: d[0], category: d[1], visibility: d[2], released: d[3], uploadedBy: chair, date: dAgo(ri(5, 120)), fileType: d[4], fileData: "" }));
  const meetings = [
    { id: "mt1", buildingId: "b1", title: "Annual General Meeting", date: dAgo(28), timeFrom: "18:00", timeTo: "19:30", location: "Common room, Level 1", teamsLink: "https://teams.microsoft.com/l/meetup-join/EXAMPLE", note: "Annual general meeting - minutes filed.", minutes: "AGM 2026 minutes", agenda: ["Welcome & apologies","Confirm previous minutes","Treasurer's report","Election of committee","Capital works plan","General business"], motions: [{ id: "mo1", ref: "M-AGM-01", title: "Adopt the annual financial statements", mover: bccNames[0] || chair, seconder: bccNames[1] || chair, meetingDate: dAgo(28), status: "decided", forCount: 5, againstCount: 0, abstainCount: 1, outcome: "Carried", decidedDate: dAgo(28), decidedTime: "18:40" }, { id: "mo2", ref: "M-AGM-02", title: "Approve the proposed levy schedule", mover: bccNames[1] || chair, seconder: bccNames[2] || chair, meetingDate: dAgo(28), status: "decided", forCount: 4, againstCount: 2, abstainCount: 0, outcome: "Carried", decidedDate: dAgo(28), decidedTime: "19:05" }], going: active.slice(0, 14).map((u) => u.name), apologies: active.slice(14, 18).map((u) => u.name) },
    { id: "mt2", buildingId: "b1", title: "Committee meeting - May", date: dAgo(50), timeFrom: "18:30", timeTo: "19:30", location: "Common room, Level 1", teamsLink: "", note: "Routine committee meeting.", minutes: "Committee meeting minutes - May", agenda: ["Previous actions","Maintenance update","Budget review","Correspondence"], motions: [{ id: "mo3", ref: "M-2026-018", title: "Engage DoorTech for carpark door repair", mover: bccNames[0] || chair, seconder: bccNames[2] || chair, meetingDate: dAgo(50), status: "decided", forCount: 6, againstCount: 0, abstainCount: 0, outcome: "Carried", decidedDate: dAgo(50), decidedTime: "18:55" }], going: bccNames, apologies: [] },
    { id: "mt3", buildingId: "b1", title: "Committee meeting", date: dAhead(7), timeFrom: "18:30", timeTo: "19:30", location: "Common room, Level 1", teamsLink: "https://teams.microsoft.com/l/meetup-join/EXAMPLE2", note: "Agenda being finalised.", minutes: "", agenda: [], motions: [], going: [], apologies: [] },
  ];
  const actions = [
    { id: "ac1", buildingId: "b1", title: "Obtain second quote for lift servicing", detail: "Compare against CityLift renewal.", assignee: bccNames[0] || chair, due: dAhead(5), status: "open", priority: "high", note: "First quote received; chasing a second for comparison.", docs: ["CityLift quote.pdf"] },
    { id: "ac2", buildingId: "b1", title: "Circulate AGM minutes to owners", detail: "", assignee: chair, due: dAgo(2), status: "open", priority: "high" },
    { id: "ac3", buildingId: "b1", title: "Renew building insurance", detail: "Policy lapses next month.", assignee: bccNames[1] || chair, due: dAhead(20), status: "open", priority: "high", note: "Broker sourcing comparison quotes.", docs: ["Insurance renewal notice.pdf"] },
    { id: "ac4", buildingId: "b1", title: "Review window cleaning contract", detail: "", assignee: bccNames[2] || chair, due: dAhead(12), status: "open", priority: "med" },
    { id: "ac5", buildingId: "b1", title: "Update pool rules signage", detail: "", assignee: "Marcus Hale", due: dAgo(5), status: "done", priority: "low" },
    { id: "ac6", buildingId: "b1", title: "Investigate EV charging feasibility", detail: "Resident request via portal.", assignee: bccNames[0] || chair, due: dAhead(40), status: "open", priority: "low" },
    { id: "ac7", buildingId: "b1", title: "Fire safety statement lodgement", detail: "Annual compliance.", assignee: bccNames[1] || chair, due: dAhead(3), status: "open", priority: "high" },
    { id: "ac8", buildingId: "b1", title: "Approve garden maintenance schedule", detail: "", assignee: chair, due: dAgo(8), status: "done", priority: "med" },
  ];
  const keyfobs = []; const kfHolders = active.filter((u) => u.unit && u.unit.length <= 4);
  for (let i = 0; i < 12; i++) { const u = rnd(kfHolders); const st = rnd(["issued","issued","issued","returned","lost"]); keyfobs.push({ id: "kf" + i, buildingId: "b1", type: rnd(["Fob","Key","Remote","Swipe card"]), label: rnd(["Main entry","Carpark gate","Pool gate","Bin room","Gym","Lift override"]), serial: "SN-" + ri(1000, 9999), unit: u.unit, holder: u.name, issued: dAgo(ri(20, 400)), status: st, notes: st === "lost" ? "Reported lost - deactivate." : "" }); }
  const bizSrc = [["BrightSpark Electrical","Electrician"],["FlowFix Plumbing","Plumber"],["South Bank Locksmiths","Locksmith"],["GreenScape Gardens","Gardener / Landscaper"],["CoolBreeze Air","Air-con / HVAC"],["SparkleClean","Cleaner"],["PestGuard QLD","Pest control"],["River City Removals","Removalist"],["AquaPool Care","Pool maintenance"],["Kingsford Conveyancing","Conveyancer / Solicitor"],["Brisbane Strata Law","Strata lawyer"],["SunPower Solar","Solar"]];
  const businesses = bizSrc.map((b, i) => { const recN = ri(0, 5); const recs = []; for (let k = 0; k < recN; k++) recs.push({ by: someName(), note: chance(0.5) ? rnd(["Prompt and tidy.","Great with strata jobs.","Fair pricing.","Showed up on time.","Highly recommend."]) : "" }); return { id: "biz" + i, buildingId: "b1", name: b[0], category: b[1], phone: ph(), contact: b[0].toLowerCase().replace(/[^a-z]/g, "") + "@example.com", desc: rnd(["Used by several residents in the building.","Familiar with our building and access.","Reliable local operator."]), addedBy: someName(), recommendations: recs }; });
  const b2users = [{ id: "b2u1", buildingId: "b2", name: "Greg Ferguson", unit: "Admin", role: "admin", status: "active", email: "greg@example.com", phone: ph(), directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(5) }];
  for (let i = 0; i < 6; i++) b2users.push({ id: "b2u" + (i + 2), buildingId: "b2", name: nm(), unit: ri(1, 6) + "0" + ri(1, 9), role: chance(0.7) ? "owner" : "tenant", status: "active", email: "b2r" + i + "@example.com", phone: ph(), directoryOptIn: chance(0.5), showPhone: chance(0.5), showEmail: false, msc: false, lastSeenGallery: isoAgo(10) });
  return {
    buildings: [
      { id: "b1", name: DEMO.buildingName, type: "Residential apartments", address: DEMO.address, logoText: DEMO.buildingName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), logoImage: "", units: 100, floors: 10, towers: 1, strataManager: "Definitive Strata Co.", buildingManager: "Marcus Hale", towerDesc: DEMO.tower, bccEmail: "committee@saltonkings.org.au", strataContactName: "Janine Carter", strataContactPhone: "07 3000 4500", strataContactEmail: "janine@definitivestrata.example", facilities: { bbq: true, visitor: true, lift: true, common: true, gym: true }, modules: { events: true, gallery: true, marketplace: true, messaging: true, directory: true, business: true, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: true }, themeId: DEMO.theme, whatsappLink: "https://chat.whatsapp.com/EXAMPLE-GROUP", whatsappName: "Salt on Kings Residents", emergency: [{ label: "After-hours building emergency line", number: "1300 555 010" }], fireNotes: "" },
      { id: "b2", name: "Riverbend Apartments", type: "Mixed-use residential", address: "3 Ferry Rd, Bulimba QLD", logoText: "RB", logoImage: "", units: 56, floors: 6, towers: 2, strataManager: "Northshore Body Corp", buildingManager: "", towerDesc: "", bccEmail: "", strataContactName: "", strataContactPhone: "", strataContactEmail: "", facilities: { bbq: true, visitor: true, lift: true, common: false, gym: true }, modules: { events: true, gallery: true, marketplace: false, messaging: true, directory: true, business: false, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: false }, themeId: "midnight", whatsappLink: "", whatsappName: "", emergency: [], fireNotes: "" },
    ],
    users: users.concat(b2users),
    announcements, maintenance, bookings, events, gallery, marketplace, messages, documents, meetings, actions, keyfobs, businesses,
  };
}
const seed = makeDemo();

// ---------- context ---------------------------------------------------------
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
const readImage = (file, cb) => { const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file); };

// ---------- UI kit ----------------------------------------------------------
function Card({ children, style, hover, ...p }) {
  const { T } = useApp();
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, boxShadow: T.mode === "dark" ? `0 16px 40px -22px ${T.glow}, 0 1px 0 rgba(255,255,255,0.05) inset` : "0 12px 28px -18px rgba(16,24,40,0.20), 0 1px 2px rgba(16,24,40,0.05)", ...style }} className={`rounded-2xl ${hover ? "rp-hover" : ""}`} {...p}>{children}</div>;
}
function Btn({ children, kind = "primary", className = "", grad, ...p }) {
  const { T } = useApp();
  const styles = kind === "primary" ? { background: grad ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.accent, color: T.accentText, border: "1px solid transparent" }
    : kind === "ghost" ? { background: "transparent", color: T.text, border: `1px solid ${T.border}` }
    : { background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}` };
  return <button style={styles} className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${className}`} {...p}>{children}</button>;
}
function Field({ label, children }) { const { T } = useApp(); return <label className="block"><span style={{ color: T.textMuted }} className="text-xs font-semibold uppercase tracking-wider">{label}</span><div className="mt-1.5">{children}</div></label>; }
function Input(props) { const { T } = useApp(); return <input {...props} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none" />; }
function TextArea(props) { const { T } = useApp(); return <textarea {...props} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none resize-none" />; }
function Select({ children, ...props }) { const { T } = useApp(); return <select {...props} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none">{children}</select>; }
function Badge({ children, color }) { const { T } = useApp(); const c = color || T.textMuted; return <span style={{ background: hexToRgba(c, T.mode === "dark" ? 0.22 : 0.13), color: c }} className="text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">{children}</span>; }
function SectionTitle({ children, right }) { const { T } = useApp(); return <div className="flex items-center justify-between mb-3"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-[0.18em] font-bold">{children}</div>{right}</div>; }
function Empty({ icon: Icon, title, hint }) { const { T } = useApp(); return <Card style={{ padding: 40 }}><div className="text-center"><Icon size={26} style={{ color: T.textMuted }} className="mx-auto mb-3" /><div className="font-semibold">{title}</div>{hint && <div style={{ color: T.textMuted }} className="text-sm mt-1">{hint}</div>}</div></Card>; }
function ImagePick({ value, onChange, label = "Add image" }) {
  const { T } = useApp();
  return value ? (<div className="relative rounded-xl overflow-hidden"><img src={value} alt="" className="w-full h-40 object-cover" /><button onClick={() => onChange("")} className="absolute top-2 right-2 bg-black/55 text-white rounded-lg p-1.5"><X size={15} /></button></div>)
    : (<label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-5 text-sm cursor-pointer"><ImageIcon size={17} /> {label}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readImage(f, onChange); }} /></label>);
}
function FileChip({ name, data, color }) {
  const { T, flash } = useApp();
  const c = color || T.accent;
  const open = () => { if (data) { const a = document.createElement("a"); a.href = data; a.download = name; a.click(); } else flash(`Opening ${name}`); };
  return <button onClick={open} style={{ background: hexToRgba(c, T.mode === "dark" ? 0.2 : 0.12), color: c }} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"><Paperclip size={12} /> {name} <Download size={12} /></button>;
}
export function Toast() { const { toast } = useApp(); if (!toast) return null; return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4"><div className="bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"><Mail size={15} /> {toast}</div></div>; }

// ---------- live clock + day/night sky header -------------------------------
function Clock({ className }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const day = now.toLocaleDateString("en-AU", { weekday: "long" });
  const date = now.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  return <span className={className}>{day}, {date} · {time}</span>;
}
const skyPhase = (h) => (h >= 20 || h < 5) ? "night" : (h < 8) ? "dawn" : (h < 17) ? "day" : "dusk";
function AnimatedHeader({ children }) {
  const { T } = useApp();
  const phase = (() => { try { const p = new URLSearchParams(window.location.search).get("phase"); if (["day", "night", "dawn", "dusk"].includes(p)) return p; } catch (e) {} return skyPhase(new Date().getHours()); })();
  const stars = useMemo(() => Array.from({ length: 28 }, () => ({ l: Math.random() * 100, t: Math.random() * 78, d: (Math.random() * 3.5).toFixed(2), s: 1 + Math.random() * 2.6 })), []);
  const isNight = phase === "night";
  const showStars = isNight;
  const showSun = !isNight;
  const sunGlow = phase === "day" ? "rgba(255,241,194,0.6)" : "rgba(255,168,108,0.5)";
  const sunCore = phase === "day" ? "rgba(255,248,224,0.7)" : "rgba(255,190,130,0.6)";
  const showClouds = phase === "day" || phase === "dusk";
  const waves = [
    { h: 86, o: 0.17, dur: 19, dir: "normal", d: "M0,34 C240,104 480,-8 720,44 C960,100 1200,-4 1440,40 L1440,120 L0,120 Z" },
    { h: 104, o: 0.12, dur: 29, dir: "reverse", d: "M0,52 C300,6 600,112 900,48 C1180,4 1320,96 1440,42 L1440,120 L0,120 Z" },
    { h: 78, o: 0.07, dur: 41, dir: "normal", d: "M0,86 C220,66 540,108 760,84 C1020,60 1260,104 1440,82 L1440,120 L0,120 Z" },
  ];
  return (
    <div className="relative overflow-hidden" style={{ background: `linear-gradient(115deg, ${T.headerFrom}, ${T.headerVia}, ${T.headerTo})`, color: "#fff" }}>
      {showSun && <div className="rp-anim" style={{ position: "absolute", top: -130, right: -130, width: 340, height: 340, borderRadius: "50%", background: `radial-gradient(circle, ${sunGlow}, transparent 70%)`, animation: "rpsun 7s ease-in-out infinite" }} />}
      {showSun && <div className="rp-anim" style={{ position: "absolute", top: -70, right: -70, width: 190, height: 190, borderRadius: "50%", background: `radial-gradient(circle, ${sunCore}, transparent 68%)`, animation: "rpsun 7s ease-in-out infinite" }} />}
      {showStars && stars.map((s, i) => (<span key={i} className="rp-twinkle" style={{ position: "absolute", left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s, borderRadius: "50%", background: "#fff", opacity: 0.95, boxShadow: "0 0 7px 1px rgba(255,255,255,0.9)", animationDelay: `${s.d}s` }} />))}
      {showClouds && [{ t: 10, w: 130, o: 0.16, d: "0s", dur: "75s" }, { t: 34, w: 90, o: 0.12, d: "-30s", dur: "100s" }, { t: 20, w: 160, o: 0.09, d: "-55s", dur: "130s" }].map((c, i) => (
        <div key={i} className="rp-anim" style={{ position: "absolute", top: c.t, left: 0, width: c.w, height: c.w * 0.4, borderRadius: 9999, background: "#fff", opacity: c.o, filter: "blur(13px)", animation: `rpcloud ${c.dur} linear infinite`, animationDelay: c.d }} />
      ))}
      <div className="rp-anim" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130, overflow: "hidden", pointerEvents: "none" }}>
        {waves.map((w, i) => (
          <div key={i} className="rp-anim" style={{ position: "absolute", bottom: 0, left: 0, width: "200%", display: "flex", height: w.h, animation: `rpwave ${w.dur}s linear infinite ${w.dir}` }}>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}><path d={w.d} fill="#ffffff" fillOpacity={w.o} /></svg>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}><path d={w.d} fill="#ffffff" fillOpacity={w.o} /></svg>
          </div>
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ---------- root ------------------------------------------------------------
export default function App() {
  const demoB = seed.buildings[0];
  const demoUser = seed.users.find((u) => u.buildingId === demoB.id && u.role === "bcc" && u.status === "active") || seed.users.find((u) => u.buildingId === demoB.id && u.role === "admin") || seed.users.find((u) => u.buildingId === demoB.id && u.status === "active");
  const [store, setStore] = useState(seed);
  const [buildingId, setBuildingId] = useState(demoB.id);
  const [userId, setUserId] = useState(demoUser ? demoUser.id : null);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [showGuide, setShowGuide] = useState(true);
  const update = (fn) => setStore((s) => { const n = structuredClone(s); fn(n); return n; });
  const flash = (m) => { setToast(m); window.clearTimeout(window.__t); window.__t = window.setTimeout(() => setToast(null), 2600); };
  const building = store.buildings.find((b) => b.id === buildingId) || null;
  const user = store.users.find((u) => u.id === userId) || null;
  const T = themeById(building?.themeId);
  const openBuilding = (bid) => { setBuildingId(bid); const admin = store.users.find((u) => u.buildingId === bid && u.role === "admin" && u.status === "active"); const first = admin || store.users.find((u) => u.buildingId === bid && u.status === "active"); setUserId(first ? first.id : null); setView("dashboard"); setShowGuide(true); };
  const ctx = { store, update, T, building, buildingId, setBuildingId, user, userId, setUserId, view, setView, toast, flash, openBuilding, showGuide, setShowGuide };
  return (
    <AppCtx.Provider value={ctx}>
      <style>{`
        @keyframes rpsun { 0%,100% { opacity:.75; transform:scale(1) } 50% { opacity:1; transform:scale(1.06) } }
        @keyframes rpcloud { from { transform:translateX(-15%) } to { transform:translateX(115%) } }
        @keyframes rpwave { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        @keyframes rptwinkle { 0%,100% { opacity:.1; transform:scale(.6) } 50% { opacity:1; transform:scale(1.25) } }
        @keyframes rpfade { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .rp-twinkle { animation: rptwinkle 3s ease-in-out infinite; }
        .rp-fade { animation: rpfade .5s ease both; }
        .rp-hover { transition: transform .15s ease, box-shadow .15s ease; }
        .rp-hover:hover { transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) { .rp-anim, .rp-twinkle, .rp-fade { animation: none !important; } }
      `}</style>
      <div style={{ background: building ? `linear-gradient(165deg, ${T.appBg}, ${T.appBg2})` : "linear-gradient(165deg, #0a1019, #0c1320)", color: building ? T.text : "#e6edf5", minHeight: "100vh", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        {!building ? <PlatformHome /> : <BuildingApp />}
        <Toast />
      </div>
    </AppCtx.Provider>
  );
}

// ---------- footer ----------------------------------------------------------
// ---------- footer + legal --------------------------------------------------
function Footer({ onDark }) {
  const ctx = useApp(); const T = ctx && ctx.T;
  const [show, setShow] = useState(null);
  const muted = onDark ? "rgba(255,255,255,0.45)" : (T ? T.textMuted : "#94a3b8");
  const link = onDark ? "rgba(255,255,255,0.72)" : (T ? T.accent : "#64748b");
  return (<>
    <div className="text-center text-xs py-6 flex items-center justify-center flex-wrap gap-x-3 gap-y-1" style={{ color: muted }}>
      <span>{PLATFORM.name} · v{PLATFORM.version}</span>
      <button onClick={() => setShow("privacy")} style={{ color: link }} className="underline underline-offset-2">Privacy &amp; terms</button>
      <button onClick={() => setShow("about")} style={{ color: link }} className="underline underline-offset-2">About</button>
    </div>
    {show && <LegalModal initial={show} onClose={() => setShow(null)} />}
  </>);
}
function LegalModal({ initial, onClose }) {
  const [t, setT] = useState(initial);
  const H = ({ children }) => <div style={{ color: "#0f172a" }} className="font-bold text-[15px] mt-4 mb-1 first:mt-0">{children}</div>;
  const P = ({ children }) => <p style={{ color: "#475569" }} className="text-sm leading-relaxed mb-2">{children}</p>;
  return (<div className="fixed inset-0 z-[90] grid place-items-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/60" />
    <div className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: "#fff", color: "#1e293b", maxHeight: "88dvh" }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className="flex gap-1">{[["privacy", "Privacy & terms"], ["about", "About"]].map(([k, l]) => (<button key={k} onClick={() => setT(k)} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: t === k ? "#0f172a" : "transparent", color: t === k ? "#fff" : "#64748b" }}>{l}</button>))}</div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "#64748b" }}><X size={18} /></button>
      </div>
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        {t === "privacy" ? (<>
          <div className="rounded-lg px-3 py-2 mb-3 text-xs font-semibold" style={{ background: "#fef3c7", color: "#92400e" }}>Template for demonstration only — not legal advice. Have it reviewed by a lawyer before going live.</div>
          <H>About this portal</H><P>This portal is provided to the owners and residents of a building at the direction of that building's body corporate / committee, who decide which features are enabled and what information is shown.</P>
          <H>Information we handle</H><P>The portal handles information you and your committee enter — such as your name, unit, and any contact details you choose to display, along with posts, bookings, maintenance requests and similar records. This information is provided by residents and managed by the building's committee.</P>
          <H>Your choices</H><P>You decide whether you appear in the resident Directory and whether your phone and email are shown, using the controls on the Directory page. You can change these at any time.</P>
          <H>How information is used</H><P>Information is used only to operate the portal for your building. It is not sold. Some features link to third-party services (for example WhatsApp, Microsoft Teams, or businesses listed in the directory); those services have their own terms and privacy practices.</P>
          <H>Disclaimer & liability</H><P>The portal and its content are provided on an "as is" basis without warranties of any kind. Content such as fire-safety information and business listings is general in nature and is not professional advice. To the maximum extent permitted by law, the developer and the operator exclude liability for any loss or damage arising from use of, or reliance on, the portal or its content.</P>
          <H>Contact</H><P>Questions about your information should be directed to your building's committee.</P>
        </>) : (<>
          <H>{PLATFORM.name}</H><P>Version {PLATFORM.version} · prototype sandbox. A multi-building resident portal — announcements, maintenance, bookings, community features and committee governance tools.</P>
          <H>What's new</H>
          {CHANGELOG.map(([v, note]) => (<div key={v} className="flex gap-3 mb-1.5"><span className="text-xs font-bold shrink-0" style={{ color: "#0f172a", minWidth: 38 }}>v{v}</span><span className="text-sm" style={{ color: "#475569" }}>{note}</span></div>))}
        </>)}
      </div>
    </div>
  </div>);
}

// ---------- welcome / guided tour (BCC lens) --------------------------------
function WelcomeGuide() {
  const { T, building, setShowGuide, setView } = useApp();
  const steps = [
    { t: "Dashboard", d: "See what a resident lands on — live weather, what's on this month, and one-tap actions." },
    { t: "Announcements", d: "Open a notice. Then switch Viewing as → Strata manager and post a formal AGM notice to owners only." },
    { t: "Maintenance", d: "Open an issue, triage it, post a progress update, and record an approved supplier with quote & statement of work." },
    { t: "Meetings & decisions", d: "Open the AGM: review the agenda, draft one from open actions, and record a motion's vote and decision." },
    { t: "Reports", d: "The committee's snapshot. Export the Decisions register as a baseline for your minutes." },
    { t: "Make it yours", d: "In Settings, edit the building name and details — watch the header update — then toggle features on or off." },
  ];
  return (<div className="fixed inset-0 z-[95] grid place-items-center p-4" onClick={() => setShowGuide(false)}>
    <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.62)" }} />
    <div className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, maxHeight: "90dvh" }} onClick={(e) => e.stopPropagation()}>
      <div className="shrink-0"><AnimatedHeader><div className="px-5 py-5"><div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Welcome to the demo</div><h2 className="text-xl font-bold mt-1">Take the Committee's Seat</h2><p className="text-white/85 text-sm mt-1.5">You're exploring {building.name} — a fully working portal filled with realistic data. Nothing you do here affects anyone else; reload any time to reset.</p></div></AnimatedHeader></div>
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        <div className="rounded-xl p-3 mb-4" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="text-sm font-semibold flex items-center gap-2"><Eye size={15} style={{ color: T.accent }} /> The one control to know</div><p style={{ color: T.textMuted }} className="text-sm mt-1">Use <b>Viewing as</b> at the top of the menu to experience the portal through every set of eyes — committee, owner, tenant, building manager or strata manager.</p></div>
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold mb-2" style={{ color: T.textMuted }}>A six-step tour</div>
        <ol className="space-y-3">{steps.map((st, i) => (<li key={i} className="flex gap-3"><span className="h-6 w-6 rounded-full grid place-items-center text-[12px] font-bold shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}>{i + 1}</span><div><div className="text-sm font-semibold">{st.t}</div><div style={{ color: T.textMuted }} className="text-sm">{st.d}</div></div></li>))}</ol>
        <div className="rounded-xl p-3 mt-4 text-xs" style={{ background: hexToRgba(SEMANTIC.warn, T.mode === "dark" ? 0.14 : 0.1), color: T.textMuted, border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.3)}` }}><b style={{ color: T.text }}>This is a live demo to show capability and value.</b> A few things are illustrative — file uploads, document storage, emails and weather are simulated, and everything resets when you reload. The full version stores real files and data securely.</div>
      </div>
      <div className="px-5 py-3 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${T.border}` }}><Btn grad onClick={() => setShowGuide(false)} className="flex-1">Start exploring</Btn><Btn kind="ghost" onClick={() => { setView("settings"); setShowGuide(false); }}>Make it ours</Btn></div>
    </div>
  </div>);
}
function PlatformHome() {
  const { store, openBuilding } = useApp();
  const [wizard, setWizard] = useState(false);
  if (wizard) return <SetupWizard onClose={() => setWizard(false)} />;
  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="flex items-center gap-3 mb-1"><div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center"><Building2 size={22} /></div><div className="text-xs uppercase tracking-[0.2em] text-white/50">{PLATFORM.name} · platform</div></div>
      <h1 className="text-3xl font-bold">Your Buildings</h1>
      <p className="text-white/60 mt-1 text-sm">You provision a building, then hand governance to its committee. Each building's data stays separate.</p>
      <div className="grid sm:grid-cols-2 gap-4 mt-7">
        {store.buildings.map((b) => {
          const t = themeById(b.themeId);
          const count = store.users.filter((u) => u.buildingId === b.id && u.status === "active").length;
          const pending = store.users.filter((u) => u.buildingId === b.id && u.status === "pending").length;
          return (
            <button key={b.id} onClick={() => openBuilding(b.id)} className="text-left rounded-2xl p-5 rp-hover" style={{ background: "#141d2e", border: "1px solid #243049" }}>
              <div className="flex items-center gap-3">{b.logoImage ? <img src={b.logoImage} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl grid place-items-center font-black" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, color: t.accentText }}>{b.logoText}</div>}<div className="min-w-0"><div className="font-semibold truncate">{b.name}</div><div className="text-white/50 text-xs truncate">{b.type}</div></div></div>
              <div className="flex items-center gap-4 mt-4 text-xs text-white/55"><span>{b.units} units</span><span>{count} members</span>{pending > 0 && <span style={{ color: SEMANTIC.warn }}>{pending} awaiting access</span>}</div>
              <div className="mt-3 text-sm font-semibold inline-flex items-center gap-1" style={{ color: t.accent }}>Open portal <ChevronRight size={15} /></div>
            </button>
          );
        })}
        <button onClick={() => setWizard(true)} className="rounded-2xl p-5 border-2 border-dashed border-white/20 text-white/70 hover:text-white hover:border-white/40 transition grid place-items-center min-h-[150px]"><div className="text-center"><Plus className="mx-auto mb-1" /><div className="text-sm font-semibold">Add a Building</div></div></button>
      </div>
      <Footer onDark />
    </div>
  );
}

function SetupWizard({ onClose }) {
  const { update, openBuilding } = useApp();
  const [f, setF] = useState({ name: "", type: "Residential apartments", address: "", logoText: "", logoImage: "", units: 50, floors: 8, towers: 1, strataManager: "", buildingManager: "", towerDesc: "", bccEmail: "", strataContactName: "", strataContactPhone: "", strataContactEmail: "", whatsappName: "", whatsappLink: "", residentsCSV: "", keyfobsCSV: "", facilities: { bbq: true, visitor: true, lift: true, common: true, gym: false }, modules: { events: true, gallery: true, marketplace: true, messaging: true, directory: true, business: true, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: true }, themeId: "pacific" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleFac = (k) => setF((p) => ({ ...p, facilities: { ...p.facilities, [k]: !p.facilities[k] } }));
  const T = themeById(f.themeId);
  const FAC = [["bbq", "BBQ area", Flame], ["visitor", "Visitor parking", Car], ["lift", "Lift booking (moves)", ArrowUpDown], ["common", "Common room", Sofa], ["gym", "Gym", Dumbbell]];
  const create = () => {
    if (!f.name.trim()) return;
    const id = "b" + Math.random().toString(36).slice(2, 6);
    const logo = (f.logoText || f.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "BX";
    const { residentsCSV, keyfobsCSV, ...bf } = f;
    const rid = () => Math.random().toString(36).slice(2, 8);
    const newUsers = (residentsCSV || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [name, unit, role, email, phone] = l.split(",").map((x) => (x || "").trim()); const x = (role || "").toLowerCase(); const rl = x.startsWith("t") ? "tenant" : (x.startsWith("b") || x.includes("committee")) ? "bcc" : x.startsWith("m") ? "manager" : x.startsWith("s") ? "strata" : "owner"; return name ? { id: "u" + rid(), buildingId: id, name, unit: unit || "", role: rl, status: "active", email: email || "", phone: phone || "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: nowISO() } : null; }).filter(Boolean);
    const newFobs = (keyfobsCSV || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [type, label, serial, unit, holder] = l.split(",").map((x) => (x || "").trim()); return { id: "kf" + rid(), buildingId: id, type: type || "Fob", label: label || "", serial: serial || "", unit: unit || "", holder: holder || "", issued: today(), status: "issued", notes: "" }; });
    update((s) => { s.buildings.push({ id, ...bf, logoText: logo, units: Number(f.units) || 0, emergency: [], fireNotes: "" }); s.users.push({ id: "u" + rid(), buildingId: id, name: "Greg Ferguson", unit: "Admin", role: "admin", status: "active", email: "greg@example.com", phone: "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: nowISO() }); newUsers.forEach((u) => s.users.push(u)); newFobs.forEach((k) => s.keyfobs.push(k)); });
    setTimeout(() => openBuilding(id), 0);
  };
  return (
    <div className="min-h-screen" style={{ background: T.appBg, color: T.text }}>
      <AnimatedHeader><div className="max-w-2xl mx-auto px-5 py-8 flex items-center gap-3"><button onClick={onClose} className="p-1.5 rounded-lg bg-white/15"><ArrowLeft size={18} /></button><div><div className="text-[11px] uppercase tracking-[0.2em] text-white/70">New building</div><h1 className="text-2xl font-bold">Set Up a Building</h1></div></div></AnimatedHeader>
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <Card style={{ padding: 20 }}><SectionTitle>Identity</SectionTitle><div className="space-y-4">
          <Field label="Building name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Salt on Kings" /></Field>
          <Field label="Logo"><div className="flex items-center gap-3">{f.logoImage ? <img src={f.logoImage} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl grid place-items-center font-black" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}>{(f.logoText || f.name || "B").slice(0, 2).toUpperCase()}</div>}<label style={{ borderColor: T.border, color: T.text }} className="border rounded-xl px-3 py-2 text-sm cursor-pointer inline-flex items-center gap-2"><Upload size={15} /> Upload image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (d) => set("logoImage", d)); }} /></label>{f.logoImage && <button onClick={() => set("logoImage", "")} style={{ color: T.textMuted }} className="text-xs underline">Use initials</button>}</div></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Type"><Input value={f.type} onChange={(e) => set("type", e.target.value)} /></Field><Field label="Initials (fallback)"><Input value={f.logoText} onChange={(e) => set("logoText", e.target.value.toUpperCase().slice(0, 3))} placeholder="SK" /></Field></div>
          <Field label="Address"><Input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, suburb, state" /></Field>
          <div className="grid grid-cols-3 gap-3"><Field label="Units"><Input type="number" value={f.units} onChange={(e) => set("units", e.target.value)} /></Field><Field label="Floors"><Input type="number" value={f.floors} onChange={(e) => set("floors", e.target.value)} /></Field><Field label="Towers"><Input type="number" value={f.towers} onChange={(e) => set("towers", e.target.value)} /></Field></div>
        </div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>People &amp; links</SectionTitle><div className="grid sm:grid-cols-2 gap-3"><Field label="Strata manager (optional)"><Input value={f.strataManager} onChange={(e) => set("strataManager", e.target.value)} /></Field><Field label="Building manager (optional)"><Input value={f.buildingManager} onChange={(e) => set("buildingManager", e.target.value)} /></Field></div><div className="mt-3 grid sm:grid-cols-2 gap-3"><Field label="WhatsApp group name (optional)"><Input value={f.whatsappName} onChange={(e) => set("whatsappName", e.target.value)} placeholder="e.g. Salt on Kings Residents" /></Field><Field label="WhatsApp group invite link (optional)"><Input value={f.whatsappLink} onChange={(e) => set("whatsappLink", e.target.value)} placeholder="https://chat.whatsapp.com/…" /></Field></div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>Facilities residents can book</SectionTitle><div className="grid sm:grid-cols-2 gap-2.5">{FAC.map(([k, label, Icon]) => (<button key={k} onClick={() => toggleFac(k)} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left" style={{ border: `1px solid ${f.facilities[k] ? T.accent : T.border}`, background: f.facilities[k] ? hexToRgba(T.accent, T.mode === "dark" ? 0.18 : 0.1) : "transparent" }}><Icon size={18} style={{ color: f.facilities[k] ? T.accent : T.textMuted }} /><span className="text-sm font-medium flex-1">{label}</span>{f.facilities[k] && <Check size={16} style={{ color: T.accent }} />}</button>))}</div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>Features for this building</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Turn modules on or off. You can change these later in Settings.</p><div className="grid sm:grid-cols-2 gap-2.5">{OPTIONAL_MODULES.concat("whatsapp").map((k) => { const on = f.modules[k] !== false; return (<button key={k} onClick={() => setF((p) => ({ ...p, modules: { ...p.modules, [k]: !on } }))} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left" style={{ border: `1px solid ${on ? T.accent : T.border}`, background: on ? hexToRgba(T.accent, T.mode === "dark" ? 0.18 : 0.1) : "transparent" }}><span className="text-sm font-medium flex-1">{MODULE_LABELS[k]}</span>{on && <Check size={16} style={{ color: T.accent }} />}</button>); })}</div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>Bulk import (optional)</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Paste one record per line, comma-separated. You can also do this later in Settings.</p>
          <Field label="Owners & tenants — name, unit, role, email, phone"><TextArea rows={4} value={f.residentsCSV} onChange={(e) => set("residentsCSV", e.target.value)} placeholder={"Sandra Pho, 412, owner, sandra@example.com, 0400 555 666\nRavi Anand, 118, tenant, ravi@example.com, 0400 777 888"} /></Field>
          <div className="mt-3"><Field label="Key/fob register — type, label, serial, unit, holder"><TextArea rows={4} value={f.keyfobsCSV} onChange={(e) => set("keyfobsCSV", e.target.value)} placeholder={"Fob, Main entry, SN-1024, 412, Sandra Pho\nRemote, Carpark gate, SN-2087, 118, Ravi Anand"} /></Field></div>
        </Card>
        <Card style={{ padding: 20 }}><SectionTitle>Appearance</SectionTitle><ThemeGrid value={f.themeId} onChange={(id) => set("themeId", id)} /></Card>
        <div className="flex gap-3 pb-10"><Btn grad onClick={create} className="flex-1"><Plus size={16} /> Create building</Btn><Btn kind="ghost" onClick={onClose}>Cancel</Btn></div>
      </div>
    </div>
  );
}
function ThemeGrid({ value, onChange }) {
  const { T } = useApp();
  return (<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{THEMES.map((t) => (<button key={t.id} onClick={() => onChange(t.id)} className="rounded-xl p-2.5 text-left rp-hover" style={{ border: `2px solid ${value === t.id ? t.accent : T.border}`, background: T.surfaceAlt }}><div className="h-9 rounded-lg mb-2" style={{ background: `linear-gradient(110deg, ${t.headerFrom}, ${t.headerVia}, ${t.headerTo})` }} /><div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})` }} /><div className="text-xs font-semibold flex-1 truncate">{t.name}</div>{value === t.id && <Check size={13} style={{ color: t.accent }} />}</div></button>))}</div>);
}

// ---------- building app shell ----------------------------------------------
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main", show: () => true },
  { key: "announcements", label: "Announcements", icon: Megaphone, group: "main", show: () => true },
  { key: "maintenance", label: "Maintenance", icon: Wrench, group: "main", show: () => true },
  { key: "bookings", label: "Bookings", icon: CalendarCheck, group: "main", show: () => true },
  { key: "approvals", label: "Approvals", icon: ClipboardCheck, group: "main", show: (r) => isApprover(r) },
  { key: "reports", label: "Reports", icon: BarChart3, group: "main", show: (r) => isApprover(r) },
  { key: "actions", label: "Action Register", icon: ListChecks, group: "main", show: (r) => isApprover(r) },
  { key: "events", label: "Events", icon: CalendarDays, group: "community", show: () => true },
  { key: "gallery", label: "Gallery", icon: ImageIcon, group: "community", show: () => true },
  { key: "marketplace", label: "Marketplace", icon: ShoppingBag, group: "community", show: () => true },
  { key: "messaging", label: "Messaging", icon: MessageSquare, group: "community", show: () => true },
  { key: "directory", label: "Directory", icon: Users, group: "community", show: () => true },
  { key: "business", label: "Business Directory", icon: Store, group: "community", show: () => true },
  { key: "documents", label: "Documents", icon: FileText, group: "building", show: () => true },
  { key: "meetings", label: "Meetings", icon: Gavel, group: "building", show: (r) => r !== "tenant" },
  { key: "keyfobs", label: "Key & Fob Register", icon: KeyRound, group: "building", show: (r) => isCommittee(r) },
  { key: "firesafety", label: "Fire Safety", icon: ShieldAlert, group: "building", show: () => true },
  { key: "settings", label: "Settings", icon: Settings, group: "building", show: () => true },
];

export function BuildingApp() {
  const { T, building, user, view, setView, showGuide, setShowGuide, backend, signOut } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  if (!user) return null;
  if (user.status === "pending") return <PendingScreen />;
  const visible = NAV.filter((n) => n.show(user.role) && moduleOn(building, n.key) && (user.role !== "strata" || ["dashboard", "announcements"].includes(n.key)));
  const go = (v) => { setView(v); setNavOpen(false); };
  return (
    <div className="flex">
      {showGuide && <WelcomeGuide />}
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed z-40 top-0 left-0 h-full w-64 flex flex-col transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`} style={{ background: T.sidebar, color: T.sidebarText }}>
        <BuildingBrand go={go} />
        {!backend && <PreviewSwitcher />}
        <button onClick={() => setShowGuide(true)} className="mx-3 mt-1 mb-1 rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-2" style={{ color: T.sidebarText, background: hexToRgba(T.accent, 0.16), border: `1px solid ${hexToRgba(T.accent, 0.35)}` }}><HelpCircle size={15} style={{ color: T.accent }} /> Take the tour</button>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {["main", "community", "building"].map((grp) => (
            <div key={grp}>
              {grp !== "main" && <div style={{ color: T.sidebarMuted }} className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-[0.16em]">{grp === "community" ? "Community" : "Building"}</div>}
              {visible.filter((n) => n.group === grp).map((n) => { const active = view === n.key; return (
                <button key={n.key} onClick={() => go(n.key)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px]" style={{ background: active ? T.sidebarActive : "transparent", color: active ? "#fff" : T.sidebarText, fontWeight: active ? 600 : 400 }}><n.icon size={18} style={{ color: active ? T.accent : T.sidebarMuted }} /> {n.label}{n.key === "approvals" && <NavDot kind="approvals" />}{n.key === "gallery" && <NavDot kind="gallery" />}</button>
              ); })}
            </div>
          ))}
        </nav>
        {backend && <button onClick={signOut} className="m-3 rounded-xl px-3 py-2 text-sm font-medium text-left" style={{ color: T.sidebarText, border: `1px solid ${hexToRgba("#ffffff", 0.12)}` }}>Sign out</button>}
      </aside>
      <main className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen">
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: T.sidebar, color: T.sidebarText }}><button onClick={() => setNavOpen(true)} className="p-1"><Menu size={22} /></button><button onClick={() => go("dashboard")} className="font-semibold flex-1 text-left truncate">{building.name}</button><button onClick={() => setShowGuide(true)} className="p-1.5 rounded-lg" style={{ background: T.sidebarActive }}><HelpCircle size={18} /></button>{view !== "dashboard" && <button onClick={() => go("dashboard")} className="p-1.5 rounded-lg" style={{ background: T.sidebarActive }}><Home size={18} /></button>}</div>
        <div className="flex-1"><ViewRouter /></div>
        <Footer />
      </main>
    </div>
  );
}
function BuildingBrand({ go }) {
  const { T, building, setBuildingId, backend } = useApp();
  return (
    <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${hexToRgba("#ffffff", 0.08)}` }}>
      <button onClick={() => go("dashboard")} className="flex items-center gap-3 min-w-0 flex-1 text-left">{building.logoImage ? <img src={building.logoImage} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" /> : <div className="h-10 w-10 rounded-xl grid place-items-center font-black shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}>{building.logoText}</div>}<div className="min-w-0"><div className="font-semibold truncate">{building.name}</div><div style={{ color: T.sidebarMuted }} className="text-[11px]">Tap for dashboard</div></div></button>
      {!backend && <button onClick={() => setBuildingId(null)} title="Switch building" style={{ color: T.sidebarMuted }} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronLeft size={16} /></button>}
    </div>
  );
}
function NavDot({ kind }) {
  const { store, buildingId, user } = useApp();
  let n = 0;
  if (kind === "approvals") n = store.users.filter((u) => u.buildingId === buildingId && u.status === "pending").length + store.bookings.filter((b) => b.buildingId === buildingId && b.status === "pending").length;
  if (kind === "gallery") n = store.gallery.filter((g) => g.buildingId === buildingId && g.createdAt > (user.lastSeenGallery || "")).length;
  if (!n) return null;
  return <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full" style={{ background: SEMANTIC.warn, color: "#1a1206" }}>{n}</span>;
}
function PreviewSwitcher() {
  const { T, store, buildingId, user, setUserId } = useApp();
  const people = store.users.filter((u) => u.buildingId === buildingId && u.status === "active");
  return (
    <div className="mx-3 mt-3 mb-1 rounded-xl px-3 py-2.5" style={{ background: T.sidebarActive, border: `1px solid ${hexToRgba("#ffffff", 0.1)}` }}>
      <div style={{ color: T.sidebarMuted }} className="text-[10px] uppercase tracking-[0.16em] mb-1.5 flex items-center gap-1"><Eye size={11} /> Viewing as · demo</div>
      <select value={user.id} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={{ background: T.sidebar, color: "#fff", border: `1px solid ${hexToRgba("#ffffff", 0.14)}` }}>{people.map((u) => <option key={u.id} value={u.id} style={{ color: "#000" }}>{u.name} — {ROLE_LABEL[u.role]}</option>)}</select>
    </div>
  );
}

// ---------- page header -----------------------------------------------------
function Head({ title, sub, action, onBack, backLabel }) {
  const { setView, view } = useApp();
  return (
    <AnimatedHeader>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-5 pb-16">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {view !== "dashboard" && <button onClick={() => setView("dashboard")} className="inline-flex items-center gap-1.5 text-white/85 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"><Home size={15} /> Dashboard</button>}
            {onBack && <button onClick={onBack} className="inline-flex items-center gap-1.5 text-white/85 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"><ArrowLeft size={15} /> {backLabel || "Back"}</button>}
          </div>
          <Clock className="text-white/70 text-xs hidden sm:block" />
        </div>
        <div className="flex items-end justify-between gap-4"><div><h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>{sub && <p className="text-white/80 text-sm mt-1">{sub}</p>}</div>{action}</div>
      </div>
    </AnimatedHeader>
  );
}
const Wrap = ({ children }) => <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 space-y-4">{children}</div>;
function HeaderAction({ children, onClick }) { return <button onClick={onClick} className="bg-white/18 hover:bg-white/28 text-white text-sm font-semibold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5">{children}</button>; }

// ---------- view router -----------------------------------------------------
function ViewRouter() {
  const { view } = useApp();
  const map = { dashboard: Dashboard, announcements: Announcements, maintenance: Maintenance, bookings: Bookings, approvals: Approvals, reports: Reports, actions: ActionRegister, events: Events, gallery: Gallery, marketplace: Marketplace, messaging: Messaging, directory: Directory, documents: Documents, meetings: Meetings, keyfobs: KeyFobRegister, firesafety: FireSafety, business: BusinessDirectory, settings: SettingsView };
  const C = map[view] || Dashboard;
  return <C />;
}

// ---------- dashboard -------------------------------------------------------
function activeAnnouncements(store, buildingId, role) { return store.announcements.filter((a) => a.buildingId === buildingId && (isCommittee(role) || !a.expiry || a.expiry >= today()) && (a.audience !== "owners" || role !== "tenant")); }
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const WX = [{ k: "Sunny", Icon: Sun }, { k: "Partly cloudy", Icon: CloudSun }, { k: "Cloudy", Icon: Cloud }, { k: "Showers", Icon: CloudRain }, { k: "Breezy", Icon: Wind }];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Weather() {
  const { T, building } = useApp();
  const place = useMemo(() => suburbFromAddress(building.address), [building.address]);
  const fc = useMemo(() => { const base = 19 + Math.floor(Math.random() * 5); return Array.from({ length: 5 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); const w = WX[Math.floor(Math.random() * WX.length)]; const hi = base + Math.floor(Math.random() * 4); const lo = hi - (5 + Math.floor(Math.random() * 3)); return { label: i === 0 ? "Today" : DOW[d.getDay()], w, hi, lo }; }); }, []);
  const cur = fc[0];
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div className="flex flex-col sm:flex-row">
        <div className="flex items-center gap-4 p-5 sm:w-[38%]" style={{ background: `linear-gradient(135deg, ${hexToRgba(T.accent, 0.16)}, ${hexToRgba(T.accent2, 0.1)})` }}>
          <cur.w.Icon size={56} strokeWidth={1.4} style={{ color: T.accent }} />
          <div><div className="text-4xl font-bold leading-none">{cur.hi}°</div><div style={{ color: T.text }} className="text-sm mt-1 font-medium">{cur.w.k}</div><div style={{ color: T.textMuted }} className="text-xs">{place} · today</div></div>
        </div>
        <div className="flex-1 grid grid-cols-4">{fc.slice(1).map((d, i) => (<div key={i} className="p-4 text-center" style={{ borderLeft: `1px solid ${T.border}` }}><div style={{ color: T.textMuted }} className="text-xs font-semibold">{d.label}</div><d.w.Icon size={24} strokeWidth={1.6} className="mx-auto my-2" style={{ color: T.accent }} /><div className="text-sm font-bold">{d.hi}°<span style={{ color: T.textMuted }} className="font-normal"> {d.lo}°</span></div></div>))}</div>
      </div>
      <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-[10px] px-4 py-1.5">Sample forecast · live weather connects in production</div>
    </Card>
  );
}

function WhatsOn() {
  const { T, store, buildingId, user, setView } = useApp();
  const t0 = today(), t30 = addDays(t0, 31);
  const items = [
    ...store.events.filter((e) => e.buildingId === buildingId).map((e) => ({ id: e.id, type: "Event", date: e.date, title: e.title, sub: [e.timeFrom, e.location].filter(Boolean).join(" · "), hue: HUE.events, go: "events" })),
    ...(user.role !== "tenant" ? store.meetings.filter((m) => m.buildingId === buildingId).map((m) => ({ id: m.id, type: "Meeting", date: m.date, title: m.title, sub: [m.timeFrom, m.location].filter(Boolean).join(" · "), hue: HUE.meetings, go: "meetings" })) : []),
  ].filter((i) => i.date && i.date >= t0 && i.date <= t30).sort((a, b) => (a.date < b.date ? -1 : 1));
  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">next 30 days</span>}>What's on this month</SectionTitle>
      {items.length === 0 && <div style={{ color: T.textMuted }} className="text-sm py-2">Nothing scheduled in the next month — enjoy the quiet.</div>}
      <div className="space-y-2.5">{items.map((i) => { const dt = new Date(i.date + "T00:00:00"); return (
        <button key={i.type + i.id} onClick={() => setView(i.go)} className="w-full flex items-center gap-3.5 text-left rp-hover rounded-xl" style={{ padding: 4 }}>
          <div className="h-12 w-12 rounded-xl grid place-items-center text-white shrink-0 leading-none" style={{ background: `linear-gradient(135deg, ${i.hue[0]}, ${i.hue[1]})` }}><span className="text-base font-bold">{dt.getDate()}</span><span className="text-[9px] uppercase tracking-wide -mt-0.5">{dt.toLocaleString("en", { month: "short" })}</span></div>
          <div className="flex-1 min-w-0"><div className="font-semibold truncate flex items-center gap-2">{i.title}<Badge color={i.hue[1]}>{i.type}</Badge></div>{i.sub && <div style={{ color: T.textMuted }} className="text-xs truncate">{i.sub}</div>}</div>
          <ChevronRight size={16} style={{ color: T.textMuted }} />
        </button>
      ); })}</div>
    </Card>
  );
}

function Dashboard() {
  const { T, store, building, buildingId, user, setView, flash } = useApp();
  const truism = useMemo(() => TRUISMS[Math.floor(Math.random() * TRUISMS.length)], []);
  const pendingAcc = store.users.filter((u) => u.buildingId === buildingId && u.status === "pending").length;
  const pinned = activeAnnouncements(store, buildingId, user.role).find((a) => a.pinned);
  const annN = activeAnnouncements(store, buildingId, user.role).length;
  const galN = store.gallery.filter((g) => g.buildingId === buildingId && g.createdAt > (user.lastSeenGallery || "")).length;
  const openA = store.actions.filter((a) => a.buildingId === buildingId && a.status === "open");
  const overdueA = openA.filter((a) => actionFlags(a).overdue).length;
  const soonA = openA.filter((a) => actionFlags(a).soon).length;
  const strata = isStrata(user.role);
  const QA = strata ? [
    { label: "Post a Formal Notice", icon: FileText, go: "announcements", hue: HUE.documents },
  ] : [
    { label: "Report an Issue", icon: Wrench, go: "maintenance", hue: HUE.maintenance },
    { label: "Book a Space or Visitor Car Park", icon: CalendarCheck, go: "bookings", hue: HUE.bookings },
    { label: "Message Committee or Manager", icon: MessageSquare, go: "messaging", hue: HUE.messaging },
  ];
  const EX = strata ? [
    { label: "Announcements", icon: Megaphone, go: "announcements", hue: HUE.announcements, n: annN },
  ] : [
    { label: "Announcements", icon: Megaphone, go: "announcements", hue: HUE.announcements, n: annN },
    { label: "Events", icon: CalendarDays, go: "events", hue: HUE.events },
    { label: "Gallery", icon: ImageIcon, go: "gallery", hue: HUE.gallery, n: galN, nl: "new" },
    { label: "Marketplace", icon: ShoppingBag, go: "marketplace", hue: HUE.marketplace },
    { label: "Directory", icon: Users, go: "directory", hue: HUE.directory },
    { label: "Documents", icon: FileText, go: "documents", hue: HUE.documents },
  ];
  return (
    <div>
      <AnimatedHeader>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-6 pb-16">
          <Clock className="text-[11px] uppercase tracking-[0.18em] text-white/75" />
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/60 mt-1">{ROLE_LABEL[user.role]} · {building.name}</div>
          <h1 className="text-3xl sm:text-4xl font-bold mt-1.5">{greeting()}, {user.name.split(" ")[0]}</h1>
          <p className="text-white/85 text-sm mt-2.5 italic max-w-md flex items-start gap-2"><Sparkles size={15} className="mt-0.5 shrink-0" /> {truism}</p>
        </div>
      </AnimatedHeader>
      <Wrap>
        <Weather />
        {isApprover(user.role) && pendingAcc > 0 && (
          <button onClick={() => setView("approvals")} className="w-full text-left rounded-2xl px-5 py-4 flex items-center gap-3 rp-fade" style={{ background: hexToRgba(SEMANTIC.warn, T.mode === "dark" ? 0.18 : 0.12), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.4)}` }}><UserPlus style={{ color: SEMANTIC.warn }} /><div className="flex-1"><div className="font-semibold">{pendingAcc} resident{pendingAcc > 1 ? "s" : ""} waiting for access</div><div style={{ color: T.textMuted }} className="text-sm">Review and approve to let them in.</div></div><ChevronRight style={{ color: T.textMuted }} /></button>
        )}
        {isApprover(user.role) && (overdueA + soonA) > 0 && (
          <button onClick={() => setView("actions")} className="w-full text-left rounded-2xl px-5 py-4 flex items-center gap-3 rp-fade" style={{ background: hexToRgba(SEMANTIC.bad, T.mode === "dark" ? 0.16 : 0.1), border: `1px solid ${hexToRgba(SEMANTIC.bad, 0.35)}` }}><ListChecks style={{ color: SEMANTIC.bad }} /><div className="flex-1"><div className="font-semibold">{overdueA > 0 ? `${overdueA} action${overdueA > 1 ? "s" : ""} overdue` : `${soonA} action${soonA > 1 ? "s" : ""} due soon`}</div><div style={{ color: T.textMuted }} className="text-sm">Committee tasks need attention.</div></div><ChevronRight style={{ color: T.textMuted }} /></button>
        )}
        {pinned && (<Card style={{ padding: 18, borderLeft: `4px solid ${T.accent}` }} className="rp-fade"><div className="flex items-center gap-2 mb-1"><Pin size={14} style={{ color: T.accent }} /><span style={{ color: T.accent }} className="text-xs font-bold uppercase tracking-wider">Pinned notice</span></div><div className="font-semibold">{pinned.title}</div><p style={{ color: T.textMuted }} className="text-sm mt-1">{pinned.body}</p></Card>)}
        <WhatsOn />
        <div><SectionTitle>Do something</SectionTitle><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{QA.filter((q) => moduleOn(building, q.go)).map((q, i) => (<button key={q.label} onClick={() => setView(q.go)} className="text-left rp-fade" style={{ animationDelay: `${i * 60}ms` }}><Card hover style={{ padding: 16, height: "100%" }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-2xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${q.hue[0]}, ${q.hue[1]})`, boxShadow: `0 6px 16px ${hexToRgba(q.hue[1], 0.35)}` }}><q.icon size={20} /></div><div className="font-semibold text-[15px] flex-1 leading-snug">{q.label}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>))}</div></div>
        <div><SectionTitle>Explore</SectionTitle><div className="flex flex-wrap gap-2.5">
          {EX.filter((e) => moduleOn(building, e.go)).map((e) => (<button key={e.label} onClick={() => setView(e.go)} className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 rp-hover" style={{ background: T.surface, border: `1px solid ${T.border}` }}><span className="h-7 w-7 rounded-full grid place-items-center text-white" style={{ background: `linear-gradient(135deg, ${e.hue[0]}, ${e.hue[1]})` }}><e.icon size={14} /></span><span className="text-sm font-medium" style={{ color: T.text }}>{e.label}</span>{e.n > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: hexToRgba(e.hue[1], 0.16), color: e.hue[1] }}>{e.n}{e.nl ? ` ${e.nl}` : ""}</span>}</button>))}
          {(building.modules ? building.modules.whatsapp !== false : true) && <button onClick={() => building.whatsappLink ? openExternal(building.whatsappLink) : flash("WhatsApp Group not set up")} className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 rp-hover" style={{ background: T.surface, border: `1px solid ${T.border}` }}><span className="h-7 w-7 rounded-full grid place-items-center text-white" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}><MessageCircle size={14} /></span><span className="text-sm font-medium" style={{ color: T.text }}>{building.whatsappName || "WhatsApp Group"}</span><ExternalLink size={12} style={{ color: T.textMuted }} /></button>}
        </div></div>
      </Wrap>
    </div>
  );
}

// ---------- announcements ---------------------------------------------------
function Announcements() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState(null);
  const strata = isStrata(user.role);
  const [f, setF] = useState({ title: "", body: "", expiry: "", image: "", doc: "", noticeType: strata ? NOTICE_TYPES[0] : "General", audience: strata ? "owners" : "all" });
  const canPost = isCommittee(user.role) || strata;
  const list = activeAnnouncements(store, buildingId, user.role).sort((a, b) => (b.pinned - a.pinned) || (b.date < a.date ? -1 : 1));
  const post = () => { if (!f.title.trim()) return; const audience = strata ? "owners" : f.audience; const noticeType = strata ? f.noticeType : f.noticeType; update((s) => s.announcements.unshift({ id: "a" + Math.random().toString(36).slice(2, 6), buildingId, title: f.title.trim(), body: f.body.trim(), postedBy: user.name + (strata ? " (Strata manager)" : ""), date: today(), expiry: f.expiry, pinned: false, image: f.image, doc: f.doc, noticeType, audience })); setF({ title: "", body: "", expiry: "", image: "", doc: "", noticeType: strata ? NOTICE_TYPES[0] : "General", audience: strata ? "owners" : "all" }); setComposing(false); flash(audience === "owners" ? "Notice posted & emailed to owners" : "Announcement emailed to all residents"); };
  const isFormal = (a) => a.noticeType && a.noticeType !== "General";

  if (open) {
    const a = store.announcements.find((x) => x.id === open); if (!a) { setOpen(null); return null; }
    const expired = a.expiry && a.expiry < today();
    return (<div><Head title={isFormal(a) ? "Formal Notice" : "Announcement"} onBack={() => setOpen(null)} backLabel="All notices" /><Wrap>
      <Card style={{ padding: 0, overflow: "hidden" }}>{a.image && <img src={a.image} alt="" className="w-full h-52 object-cover" />}<div className="p-6">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{a.title}</h2><div className="flex gap-1.5 flex-wrap justify-end">{isFormal(a) && <Badge color={T.accent3}>{a.noticeType}</Badge>}{a.audience === "owners" && <Badge color={T.textMuted}>Owners</Badge>}{a.pinned && <Badge color={T.accent}><Pin size={11} /> Pinned</Badge>}{expired && <Badge color={SEMANTIC.bad}>Expired</Badge>}</div></div>
        <p className="text-[15px] mt-3 leading-relaxed">{a.body}</p>
        {a.doc && <div className="mt-4"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Attachment</div><FileChip name={a.doc} color={T.accent} /></div>}
        <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-xs mt-5 pt-3 flex flex-wrap gap-x-3"><span>Posted {fmtDate(a.date)} by {a.postedBy}</span>{a.expiry && <span>Expires {fmtDate(a.expiry)}</span>}</div>
      </div></Card>
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Announcements" sub={strata ? "Post formal notices to owners" : canPost ? "Posted by the committee" : "From your committee"} action={canPost && <HeaderAction onClick={() => setComposing(true)}><Plus size={16} /> {strata ? "New notice" : "New"}</HeaderAction>} />
      <Wrap>
        {strata && <Card style={{ padding: 14, background: T.surfaceAlt }}><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><FileText size={14} /> As strata manager you can post formal notices (meetings, AGM, minutes) to owners.</p></Card>}
        {!canPost && <Card style={{ padding: 14, background: T.surfaceAlt }}><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><Lock size={14} /> Only the committee and strata manager can post here.</p></Card>}
        {composing && (<Card style={{ padding: 18 }}><div className="space-y-3">
          {strata ? (<Field label="Notice type"><Select value={f.noticeType} onChange={(e) => setF({ ...f, noticeType: e.target.value })}>{NOTICE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>)
            : (<div className="grid sm:grid-cols-2 gap-3"><Field label="Type"><Select value={f.noticeType} onChange={(e) => setF({ ...f, noticeType: e.target.value })}><option value="General">General announcement</option>{NOTICE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field><Field label="Audience"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">All residents</option><option value="owners">Owners only</option></Select></Field></div>)}
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={strata ? "e.g. Notice of Annual General Meeting" : "What's happening?"} /></Field>
          <Field label="Details"><TextArea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Add the details residents need." /></Field>
          <Field label="Auto-expire on (optional)"><Input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></Field>
          {!strata && <Field label="Image (optional)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field>}
          <Field label="Attach document (optional)"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-3 px-3 text-sm cursor-pointer"><Paperclip size={15} /> {f.doc || "Attach a file"}<input type="file" className="hidden" onChange={(e) => setF({ ...f, doc: e.target.files?.[0]?.name || "" })} /></label></Field>
          <div className="flex gap-2"><Btn grad onClick={post}>{strata || f.audience === "owners" ? "Post & email owners" : "Post & email residents"}</Btn><Btn kind="ghost" onClick={() => setComposing(false)}>Cancel</Btn></div>
        </div></Card>)}
        {list.map((a) => (
          <button key={a.id} onClick={() => setOpen(a.id)} className="w-full text-left"><Card hover style={{ padding: 0, overflow: "hidden", borderLeft: isFormal(a) ? `4px solid ${T.accent3}` : a.pinned ? `4px solid ${T.accent}` : undefined }}>
            {a.image && <img src={a.image} alt="" className="w-full h-40 object-cover" />}
            <div className="p-[18px]"><div className="flex items-start justify-between gap-3"><div className="font-semibold text-[17px]">{a.title}</div><div className="flex gap-1.5 items-center">{a.pinned && <Pin size={14} style={{ color: T.accent }} />}{a.doc && <Paperclip size={14} style={{ color: T.textMuted }} />}<ChevronRight size={16} style={{ color: T.textMuted }} /></div></div><div className="flex gap-1.5 mt-1.5 flex-wrap">{isFormal(a) && <Badge color={T.accent3}>{a.noticeType}</Badge>}{a.audience === "owners" && <Badge color={T.textMuted}>Owners</Badge>}</div><p style={{ color: T.textMuted }} className="text-sm mt-1.5 line-clamp-2">{a.body}</p><div style={{ color: T.textMuted }} className="text-xs mt-3">Posted {fmtDate(a.date)} · {a.postedBy}</div></div>
          </Card></button>
        ))}
      </Wrap>
    </div>
  );
}

// ---------- maintenance -----------------------------------------------------
const M_STATUS = { new: { label: "New", c: "#8a93a3" }, triaged: { label: "Triaged", c: SEMANTIC.warn }, in_progress: { label: "In progress", c: "#2f86d6" }, resolved: { label: "Resolved", c: SEMANTIC.ok } };
const M_FLOW = ["new", "triaged", "in_progress", "resolved"];
function Maintenance() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const [raising, setRaising] = useState(false);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ title: "", category: MAINT_CATEGORIES[0], location: "", description: "", image: "" });
  const [res, setRes] = useState({ supplier: "", note: "", cost: "", quoteDoc: "", sowDoc: "" });
  const [upd, setUpd] = useState("");
  const list = store.maintenance.filter((m) => m.buildingId === buildingId);
  const canTriage = canMaint(user);
  const managers = store.users.filter((u) => u.buildingId === buildingId && (u.role === "manager" || u.role === "bcc" || u.msc));
  const raise = () => { if (!f.title.trim()) return; update((s) => s.maintenance.unshift({ id: "m" + Math.random().toString(36).slice(2, 6), buildingId, ...f, raisedBy: user.name, status: "new", triageOwner: "", date: today(), resolutions: [], updates: [] })); setF({ title: "", category: MAINT_CATEGORIES[0], location: "", description: "", image: "" }); setRaising(false); flash("Issue logged · committee notified"); };
  const addUpdate = (id) => { if (!upd.trim()) return; update((s) => s.maintenance.find((x) => x.id === id).updates.push({ id: "up" + Math.random().toString(36).slice(2, 6), text: upd.trim(), by: user.name, date: today() })); setUpd(""); flash("Update posted"); };
  const setStatus = (id, status) => update((s) => { s.maintenance.find((x) => x.id === id).status = status; });
  const setOwner = (id, owner) => update((s) => { const m = s.maintenance.find((x) => x.id === id); m.triageOwner = owner; if (m.status === "new" && owner) m.status = "triaged"; });
  const addRes = (id) => { if (!res.note.trim() && !res.supplier.trim()) return; update((s) => s.maintenance.find((x) => x.id === id).resolutions.push({ id: "r" + Math.random().toString(36).slice(2, 6), supplier: res.supplier.trim(), note: res.note.trim(), cost: res.cost.trim(), quoteDoc: res.quoteDoc, sowDoc: res.sowDoc, by: user.name, date: today() })); setRes({ supplier: "", note: "", cost: "", quoteDoc: "", sowDoc: "" }); flash("Added to approved works"); };

  if (open) {
    const m = store.maintenance.find((x) => x.id === open); if (!m) { setOpen(null); return null; }
    const st = M_STATUS[m.status];
    return (<div><Head title="Maintenance" sub="Common-property issue" onBack={() => setOpen(null)} backLabel="All issues" /><Wrap>
      <Card style={{ padding: 0, overflow: "hidden" }}>{m.image && <img src={m.image} alt="" className="w-full h-48 object-cover" />}<div className="p-[18px]">
        <div className="flex items-center justify-between gap-3"><div className="font-semibold text-[17px]">{m.title}</div><Badge color={st.c}>{st.label}</Badge></div>
        <div className="flex flex-wrap gap-2 mt-2"><Badge color={T.accent}><Tag size={11} /> {m.category}</Badge><Badge color={T.textMuted}><MapPin size={11} /> {m.location || "—"}</Badge></div>
        <p className="text-sm mt-3">{m.description}</p>
        <div style={{ color: T.textMuted }} className="text-xs mt-4">Reported by {m.raisedBy} on {fmtDate(m.date)}{m.triageOwner && ` · assigned to ${m.triageOwner}`}</div>
      </div></Card>
      <Card style={{ padding: 18 }}><SectionTitle right={m.status === "resolved" ? <Badge color={SEMANTIC.ok}>Resolved</Badge> : null}>Progress updates</SectionTitle>
        <p style={{ color: T.textMuted }} className="text-xs mb-2">The Maintenance Sub-Committee [MSC] or Building Manager [BM] updates status and assignment.</p>
        {m.updates.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No updates yet.</p>}
        <div className="space-y-2.5">{m.updates.map((u) => (<div key={u.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><p className="text-sm">{u.text}</p><div style={{ color: T.textMuted }} className="text-[11px] mt-1.5">{u.by} · {fmtDate(u.date)}</div></div>))}</div>
        {canTriage && m.status !== "resolved" && (<div className="mt-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><Field label="Add an update for residents"><TextArea rows={2} value={upd} onChange={(e) => setUpd(e.target.value)} placeholder="e.g. Parts ordered, expected next week." /></Field><div className="mt-2"><Btn grad onClick={() => addUpdate(m.id)}><Plus size={15} /> Post update</Btn></div></div>)}
      </Card>
      {canTriage ? (<>
        <Card style={{ padding: 18 }}><SectionTitle>Triage</SectionTitle>
          <Field label="Assigned to"><Select value={m.triageOwner} onChange={(e) => setOwner(m.id, e.target.value)}><option value="">Unassigned</option>{managers.map((u) => <option key={u.id} value={u.name}>{u.name} — {u.msc ? "Maintenance Sub-Committee" : ROLE_LABEL[u.role]}</option>)}</Select></Field>
          <div className="mt-4"><SectionTitle>Status</SectionTitle><div className="flex flex-wrap gap-2">{M_FLOW.map((s) => (<button key={s} onClick={() => setStatus(m.id, s)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: m.status === s ? M_STATUS[s].c : "transparent", color: m.status === s ? "#fff" : T.text, border: `1px solid ${m.status === s ? M_STATUS[s].c : T.border}` }}>{M_STATUS[s].label}</button>))}</div></div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">supplier · quote · scope</span>}>Approved works &amp; suppliers</SectionTitle>
          {m.resolutions.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-3">No approved works yet. Record the trade/supplier, their quote and the statement of work — these flow into the BCC report.</p>}
          <div className="space-y-2.5 mb-4">{m.resolutions.map((r) => (<div key={r.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="flex items-start justify-between gap-2"><div className="min-w-0">{r.supplier && <div className="text-sm font-semibold">{r.supplier}</div>}{r.note && <p style={{ color: r.supplier ? T.textMuted : T.text }} className="text-sm">{r.note}</p>}</div>{r.cost && <Badge color={SEMANTIC.ok}>{r.cost}</Badge>}</div><div className="flex flex-wrap gap-2 mt-2">{r.quoteDoc && <FileChip name={r.quoteDoc} color={T.accent} />}{r.sowDoc && <FileChip name={r.sowDoc} color={HUE.documents[1]} />}</div><div style={{ color: T.textMuted }} className="text-[11px] mt-2">Approved by {r.by} · {fmtDate(r.date)}</div></div>))}</div>
          <div className="space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <Field label="Trade / supplier"><Input value={res.supplier} onChange={(e) => setRes({ ...res, supplier: e.target.value })} placeholder="e.g. DoorTech Pty Ltd" /></Field>
            <Field label="Note / recommendation"><TextArea rows={2} value={res.note} onChange={(e) => setRes({ ...res, note: e.target.value })} placeholder="e.g. Recommend accepting quote; available next week." /></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Quote / cost"><Input value={res.cost} onChange={(e) => setRes({ ...res, cost: e.target.value })} placeholder="$" /></Field><Field label="Quote doc"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-2 text-xs cursor-pointer"><Paperclip size={13} /> {res.quoteDoc || "Attach"}<input type="file" className="hidden" onChange={(e) => setRes({ ...res, quoteDoc: e.target.files?.[0]?.name || "" })} /></label></Field><Field label="Statement of work"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-2 text-xs cursor-pointer"><Paperclip size={13} /> {res.sowDoc || "Attach"}<input type="file" className="hidden" onChange={(e) => setRes({ ...res, sowDoc: e.target.files?.[0]?.name || "" })} /></label></Field></div>
            <Btn grad onClick={() => addRes(m.id)}><Plus size={15} /> Record approved works</Btn>
          </div>
        </Card>
      </>) : <Card style={{ padding: 14, background: T.surfaceAlt }}><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><Lock size={14} /> The Maintenance Sub-Committee [MSC] or Building Manager [BM] updates status and assignment.</p></Card>}
    </Wrap></div>);
  }
  const byCat = MAINT_CATEGORIES.map((c) => ({ c, n: list.filter((m) => m.category === c).length })).filter((x) => x.n > 0);
  return (
    <div>
      <Head title="Maintenance" sub="Report common-property issues" action={<HeaderAction onClick={() => setRaising(true)}><Plus size={16} /> Report</HeaderAction>} />
      <Wrap>
        {raising && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="What's the issue?"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Foyer light flickering" /></Field>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Where?"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Ground floor foyer" /></Field></div>
          <Field label="Details (optional)"><TextArea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Anything that helps us find it." /></Field>
          <Field label="Photo (a picture beats a paragraph)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} label="Add a photo" /></Field>
          <div className="flex gap-2"><Btn grad onClick={raise}>Submit report</Btn><Btn kind="ghost" onClick={() => setRaising(false)}>Cancel</Btn></div>
        </div></Card>)}
        {canTriage && byCat.length > 0 && (<Card style={{ padding: 16 }}><SectionTitle>By category — spot the recurring ones</SectionTitle><div className="flex flex-wrap gap-2">{byCat.map((x) => <Badge key={x.c} color={T.accent}>{x.c}: {x.n}</Badge>)}</div></Card>)}
        {list.length === 0 && <Empty icon={Wrench} title="No issues reported" hint="Spotted something in a shared area? Report it." />}
        {list.map((m) => { const st = M_STATUS[m.status]; return (
          <button key={m.id} onClick={() => setOpen(m.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3">{m.image ? <img src={m.image} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" /> : <div className="h-12 w-12 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><Wrench size={18} /></div>}<div className="flex-1 min-w-0"><div className="font-semibold truncate">{m.title}</div><div style={{ color: T.textMuted }} className="text-xs mt-0.5">{m.category} · {fmtDate(m.date)}{m.resolutions.length > 0 ? ` · ${m.resolutions.length} note(s)` : ""}</div></div><Badge color={st.c}>{st.label}</Badge><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>
        ); })}
      </Wrap>
    </div>
  );
}

// ---------- bookings --------------------------------------------------------
const FAC_META = { bbq: { label: "BBQ area", icon: Flame, timed: true }, visitor: { label: "Visitor parking", icon: Car, timed: false }, lift: { label: "Lift (move)", icon: ArrowUpDown, timed: true }, common: { label: "Common room", icon: Sofa, timed: true }, gym: { label: "Gym session", icon: Dumbbell, timed: true } };
function Bookings() {
  const { T, store, update, building, buildingId, user, flash } = useApp();
  const facs = Object.keys(building.facilities).filter((k) => building.facilities[k]);
  const [fac, setFac] = useState(facs[0] || "bbq");
  const [f, setF] = useState({ fromDate: "", toDate: "", timeFrom: "", timeTo: "", note: "" });
  const meta = FAC_META[fac];
  const mine = store.bookings.filter((b) => b.buildingId === buildingId && (isApprover(user.role) || b.bookedBy === user.name));
  const book = () => { if (!f.fromDate) return; const nights = fac === "visitor" ? daysBetween(f.fromDate, f.toDate || f.fromDate) : 0; const needsApproval = fac === "visitor" && nights > 1; update((s) => s.bookings.unshift({ id: "k" + Math.random().toString(36).slice(2, 6), buildingId, facility: fac, fromDate: f.fromDate, toDate: f.toDate || f.fromDate, timeFrom: f.timeFrom, timeTo: f.timeTo, bookedBy: user.name, status: needsApproval ? "pending" : "confirmed", note: f.note.trim(), decidedBy: "", decidedAt: "", decisionNote: "" })); setF({ fromDate: "", toDate: "", timeFrom: "", timeTo: "", note: "" }); flash(needsApproval ? "Request sent to the committee for approval" : "Booking confirmed · email sent"); };
  const nights = fac === "visitor" && f.fromDate ? daysBetween(f.fromDate, f.toDate || f.fromDate) : 0;
  return (
    <div>
      <Head title="Bookings" sub="Reserve shared spaces & visitor parking" />
      <Wrap>
        <div className="flex gap-2 flex-wrap">{facs.map((k) => { const M = FAC_META[k]; const on = fac === k; return (<button key={k} onClick={() => { setFac(k); setF({ fromDate: "", toDate: "", timeFrom: "", timeTo: "", note: "" }); }} className="px-3.5 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2" style={{ background: on ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.surface, color: on ? T.accentText : T.text, border: `1px solid ${on ? "transparent" : T.border}` }}><M.icon size={16} /> {M.label}</button>); })}</div>
        <Card style={{ padding: 18 }}><SectionTitle>New booking · {meta.label}</SectionTitle><div className="space-y-3">
          {meta.timed ? (<><Field label="Date"><Input type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value, toDate: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="From"><Input type="time" value={f.timeFrom} onChange={(e) => setF({ ...f, timeFrom: e.target.value })} /></Field><Field label="To"><Input type="time" value={f.timeTo} onChange={(e) => setF({ ...f, timeTo: e.target.value })} /></Field></div></>)
            : (<><div className="grid grid-cols-2 gap-3"><Field label="From date"><Input type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></Field><Field label="To date"><Input type="date" value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></Field></div>{nights > 0 && <p style={{ color: nights > 1 ? SEMANTIC.warn : T.textMuted }} className="text-xs flex items-center gap-1.5">{nights > 1 && <AlertCircle size={13} />}{nights} night{nights > 1 ? "s" : ""}{nights > 1 ? " · needs committee approval" : ""}</p>}</>)}
          <Field label="Note (optional)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. moving furniture in" /></Field>
          <Btn grad onClick={book}>{fac === "visitor" && nights > 1 ? "Request booking" : "Confirm booking"}</Btn>
        </div></Card>
        <SectionTitle>{isApprover(user.role) ? "All bookings" : "Your bookings"}</SectionTitle>
        {mine.length === 0 && <Empty icon={CalendarCheck} title="Nothing booked yet" />}
        {mine.map((b) => { const M = FAC_META[b.facility]; const stc = b.status === "pending" ? SEMANTIC.warn : b.status === "declined" ? SEMANTIC.bad : SEMANTIC.ok; return (
          <Card key={b.id} style={{ padding: 16 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${HUE.bookings[0]}, ${HUE.bookings[1]})` }}><M.icon size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold">{M.label}</div><div style={{ color: T.textMuted }} className="text-xs">{b.facility === "visitor" ? `${fmtDate(b.fromDate)} → ${fmtDate(b.toDate)}` : `${fmtDate(b.fromDate)}${b.timeFrom ? ` · ${b.timeFrom}–${b.timeTo}` : ""}`} · {b.bookedBy}</div></div><Badge color={stc}>{b.status === "pending" ? "Pending" : b.status === "declined" ? "Declined" : "Confirmed"}</Badge></div>{b.decidedBy && <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-xs mt-3 pt-2.5">{b.status === "confirmed" ? "Approved" : "Declined"} by {b.decidedBy} · {fmtDate(b.decidedAt)}{b.decisionNote && ` — “${b.decisionNote}”`}</div>}</Card>
        ); })}
      </Wrap>
    </div>
  );
}

// ---------- approvals -------------------------------------------------------
function Approvals() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const pendingUsers = store.users.filter((u) => u.buildingId === buildingId && u.status === "pending");
  const pendingBookings = store.bookings.filter((b) => b.buildingId === buildingId && b.status === "pending");
  const [notes, setNotes] = useState({});
  const decideUser = (id, ok) => { update((s) => { if (ok) s.users.find((x) => x.id === id).status = "active"; else s.users = s.users.filter((x) => x.id !== id); }); flash(ok ? "Access approved · welcome email sent" : "Request declined"); };
  const decideBooking = (id, ok) => { update((s) => { const b = s.bookings.find((x) => x.id === id); b.status = ok ? "confirmed" : "declined"; b.decidedBy = user.name; b.decidedAt = today(); b.decisionNote = notes[id] || ""; }); flash(ok ? "Approved · requester emailed" : "Declined · requester emailed"); };
  return (
    <div><Head title="Approvals" sub="Access requests and bookings that need a decision" /><Wrap>
      <SectionTitle>Access requests</SectionTitle>
      {pendingUsers.length === 0 && <Empty icon={UserPlus} title="No one waiting" hint="New residents appear here for approval." />}
      {pendingUsers.map((u) => (<Card key={u.id} style={{ padding: 16 }}><div className="flex-1 min-w-0"><div className="font-semibold">{u.name} <span style={{ color: T.textMuted }} className="font-normal text-sm">· Unit {u.unit}</span></div><div style={{ color: T.textMuted }} className="text-xs mt-0.5">Requesting {ROLE_LABEL[u.role]} access · {u.email}</div></div><div className="flex gap-2 mt-3"><Btn grad onClick={() => decideUser(u.id, true)}><Check size={15} /> Approve</Btn><Btn kind="ghost" onClick={() => decideUser(u.id, false)}><X size={15} /> Decline</Btn></div></Card>))}
      <SectionTitle>Booking requests</SectionTitle>
      {pendingBookings.length === 0 && <Empty icon={CalendarCheck} title="No bookings to review" />}
      {pendingBookings.map((b) => { const M = FAC_META[b.facility]; return (<Card key={b.id} style={{ padding: 16 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${HUE.bookings[0]}, ${HUE.bookings[1]})` }}><M.icon size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold">{M.label} · {b.bookedBy}</div><div style={{ color: T.textMuted }} className="text-xs">{fmtDate(b.fromDate)} → {fmtDate(b.toDate)}{b.note && ` · ${b.note}`}</div></div></div><div className="mt-3"><Input placeholder="Note to requester (optional)" value={notes[b.id] || ""} onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })} /></div><div className="flex gap-2 mt-2.5"><Btn grad onClick={() => decideBooking(b.id, true)}><Check size={15} /> Approve</Btn><Btn kind="ghost" onClick={() => decideBooking(b.id, false)}><X size={15} /> Decline</Btn></div></Card>); })}
    </Wrap></div>
  );
}

// ---------- action register (BCC) -------------------------------------------
function actionFlags(a) { const t = today(); const overdue = a.status === "open" && a.due && a.due < t; const soon = a.status === "open" && a.due && a.due >= t && a.due <= addDays(t, 7); return { overdue, soon }; }
function ActionRegister() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.actions.filter((a) => a.buildingId === buildingId).sort((a, b) => (a.status === b.status ? (a.due < b.due ? -1 : 1) : a.status === "open" ? -1 : 1));
  const bcc = store.users.filter((u) => u.buildingId === buildingId && (u.role === "bcc" || u.role === "admin" || u.msc));
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", detail: "", assignee: bcc[0]?.name || "", due: "", priority: "med" });
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState({ assignee: "", due: "", priority: "med", note: "" });
  const add = () => { if (!f.title.trim()) return; update((s) => s.actions.unshift({ id: "ac" + Math.random().toString(36).slice(2, 6), buildingId, ...f, status: "open", note: "", docs: [] })); setF({ title: "", detail: "", assignee: bcc[0]?.name || "", due: "", priority: "med" }); setAdding(false); flash("Action added"); };
  const toggle = (id) => update((s) => { const a = s.actions.find((x) => x.id === id); a.status = a.status === "open" ? "done" : "open"; });
  const startEdit = (a) => { setEditId(a.id); setEf({ assignee: a.assignee || "", due: a.due || "", priority: a.priority || "med", note: a.note || "" }); };
  const saveEdit = (id) => { update((s) => { const a = s.actions.find((x) => x.id === id); a.assignee = ef.assignee; a.due = ef.due; a.priority = ef.priority; a.note = ef.note; }); setEditId(null); flash("Action updated"); };
  const addDoc = (id, name) => { if (!name) return; update((s) => { const a = s.actions.find((x) => x.id === id); a.docs = a.docs || []; a.docs.push(name); }); flash("Document attached"); };
  const PRI = { high: SEMANTIC.bad, med: SEMANTIC.warn, low: T.textMuted };
  return (<div><Head title="Action Register" sub="Committee tasks, owners and deadlines" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} /><Wrap>
    {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
      <Field label="Action"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Renew building insurance" /></Field>
      <Field label="Detail (optional)"><Input value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3"><Field label="Owner"><Select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field><Field label="Due"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field><Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></Select></Field></div>
      <div className="flex gap-2"><Btn grad onClick={add}>Add action</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
    </div></Card>)}
    {list.length === 0 && <Empty icon={ListChecks} title="No actions yet" hint="Track committee tasks and deadlines here." />}
    {list.map((a) => { const { overdue, soon } = actionFlags(a); const done = a.status === "done"; const editing = editId === a.id; const docs = a.docs || []; return (
      <Card key={a.id} style={{ padding: 16, opacity: done ? 0.6 : 1 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => toggle(a.id)} className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ border: `2px solid ${done ? SEMANTIC.ok : T.border}`, background: done ? SEMANTIC.ok : "transparent" }}>{done && <Check size={14} className="text-white" />}</button>
          <div className="flex-1 min-w-0"><div className={`font-semibold ${done ? "line-through" : ""}`}>{a.title}</div><div style={{ color: T.textMuted }} className="text-xs">{a.assignee}{a.due ? ` · due ${fmtDate(a.due)}` : ""}{a.detail ? ` · ${a.detail}` : ""}</div></div>
          {!done && overdue && <Badge color={SEMANTIC.bad}>Overdue</Badge>}
          {!done && !overdue && soon && <Badge color={SEMANTIC.warn}>Due soon</Badge>}
          <Badge color={PRI[a.priority]}>{a.priority}</Badge>
          <button onClick={() => editing ? setEditId(null) : startEdit(a)} style={{ color: T.textMuted }}><Pencil size={14} /></button>
        </div>
        {a.note && !editing && <div style={{ color: T.textMuted }} className="text-xs mt-2 flex items-start gap-1.5"><MessageSquare size={12} className="mt-0.5 shrink-0" /> {a.note}</div>}
        {docs.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{docs.map((d, i) => <FileChip key={i} name={d} color={T.accent} />)}</div>}
        {editing && (<div className="mt-3 space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <div className="grid sm:grid-cols-3 gap-3"><Field label="Owner"><Select value={ef.assignee} onChange={(e) => setEf({ ...ef, assignee: e.target.value })}>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field><Field label="Expected due date"><Input type="date" value={ef.due} onChange={(e) => setEf({ ...ef, due: e.target.value })} /></Field><Field label="Priority"><Select value={ef.priority} onChange={(e) => setEf({ ...ef, priority: e.target.value })}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></Select></Field></div>
          <Field label="Status / progress note"><TextArea rows={2} value={ef.note} onChange={(e) => setEf({ ...ef, note: e.target.value })} placeholder="e.g. Quotes received, awaiting committee approval." /></Field>
          <Field label="Attach a document"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-3 text-sm cursor-pointer"><Paperclip size={14} /> Choose a file<input type="file" className="hidden" onChange={(e) => addDoc(a.id, e.target.files?.[0]?.name || "")} /></label></Field>
          <div className="flex gap-2"><Btn grad onClick={() => saveEdit(a.id)}>Save changes</Btn><Btn kind="ghost" onClick={() => setEditId(null)}>Cancel</Btn></div>
        </div>)}
      </Card>
    ); })}
  </Wrap></div>);
}

// ---------- reports (BCC) ---------------------------------------------------
function Reports() {
  const { T, store, building, buildingId } = useApp();
  const maint = store.maintenance.filter((m) => m.buildingId === buildingId);
  const books = store.bookings.filter((b) => b.buildingId === buildingId);
  const msgs = store.messages.filter((m) => m.buildingId === buildingId);
  const acts = store.actions.filter((a) => a.buildingId === buildingId);
  const motions = store.meetings.filter((m) => m.buildingId === buildingId).flatMap((m) => (m.motions || []).map((mo) => ({ ...mo, meeting: m.title, date: m.date }))).filter((mo) => mo.status === "decided" || mo.outcome);
  const exportDecisions = () => { const lines = ["DECISIONS REGISTER — " + building.name, "Generated " + fmtDate(today()), ""]; motions.forEach((mo) => { lines.push((mo.ref ? "[" + mo.ref + "] " : "") + mo.title); lines.push("  Meeting: " + mo.meeting + " (" + fmtDate(mo.meetingDate || mo.date) + ")"); lines.push("  Decided: " + fmtDate(mo.decidedDate || mo.date) + (mo.decidedTime ? " " + mo.decidedTime : "")); lines.push("  Moved: " + (mo.mover || "—") + (mo.seconder ? ", seconded " + mo.seconder : "")); lines.push("  Vote: for " + mo.forCount + " / against " + mo.againstCount + " / abstain " + mo.abstainCount + " — " + mo.outcome); lines.push(""); }); downloadText("decisions-" + building.name.replace(/\s+/g, "-").toLowerCase() + ".txt", lines.join("\n")); };
  const byCount = (arr, key) => arr.reduce((a, x) => { a[x[key]] = (a[x[key]] || 0) + 1; return a; }, {});
  const mStat = byCount(maint, "status"), mCat = byCount(maint, "category");
  const bStat = byCount(books, "status");
  const mgCat = byCount(msgs, "category");
  const Bar = ({ label, n, total, color }) => (<div className="mb-2"><div className="flex justify-between text-xs mb-1"><span>{label}</span><span style={{ color: T.textMuted }}>{n}</span></div><div className="h-2 rounded-full" style={{ background: T.surfaceAlt }}><div className="h-full rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%`, background: color }} /></div></div>);
  return (
    <div>
      <Head title="Reports" sub="A snapshot for the committee" action={<HeaderAction onClick={() => window.print()}><Printer size={16} /> Print</HeaderAction>} />
      <Wrap>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{maint.length} total</span>}>Maintenance</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-x-6"><div><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">By status</div>{M_FLOW.map((s) => <Bar key={s} label={M_STATUS[s].label} n={mStat[s] || 0} total={maint.length} color={M_STATUS[s].c} />)}</div><div><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">By type</div>{Object.keys(mCat).map((c) => <Bar key={c} label={c} n={mCat[c]} total={maint.length} color={T.accent} />)}</div></div>
          <div className="mt-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Approved works recorded</div>{maint.filter((m) => m.resolutions.length).length === 0 ? <p style={{ color: T.textMuted }} className="text-sm">No approved works recorded yet.</p> : maint.filter((m) => m.resolutions.length).map((m) => (<div key={m.id} className="mb-2.5"><div className="text-sm font-semibold">{m.title}</div>{m.resolutions.map((r) => <div key={r.id} style={{ color: T.textMuted }} className="text-xs ml-3 mt-0.5">• {[r.supplier, r.note].filter(Boolean).join(" — ")}{r.cost ? ` (${r.cost})` : ""}</div>)}</div>))}</div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{books.length} total</span>}>Bookings</SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">{[["confirmed", "Confirmed", SEMANTIC.ok], ["pending", "Pending", SEMANTIC.warn], ["declined", "Declined", SEMANTIC.bad]].map(([k, label, c]) => (<div key={k} className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: c }}>{bStat[k] || 0}</div><div style={{ color: T.textMuted }} className="text-xs">{label}</div></div>))}</div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{msgs.length} total</span>}>Messaging</SectionTitle>
          {MSG_CATEGORIES.map((c) => <Bar key={c} label={c} n={mgCat[c] || 0} total={msgs.length} color={HUE.messaging[1]} />)}
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{acts.filter((a) => a.status === "open").length} open</span>}>Action register</SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">{[["Open", acts.filter((a) => a.status === "open").length, T.accent], ["Overdue", acts.filter((a) => actionFlags(a).overdue).length, SEMANTIC.bad], ["Completed", acts.filter((a) => a.status === "done").length, SEMANTIC.ok]].map(([label, n, c]) => (<div key={label} className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: c }}>{n}</div><div style={{ color: T.textMuted }} className="text-xs">{label}</div></div>))}</div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<div className="flex items-center gap-2"><span style={{ color: T.textMuted }} className="text-[11px]">{motions.length} recorded</span>{motions.length > 0 && <button onClick={exportDecisions} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><Download size={12} /> Export</button>}</div>}>Decisions register</SectionTitle>
          {motions.length === 0 && <p style={{ color: T.textMuted }} className="text-sm">No motions recorded yet.</p>}
          <div className="space-y-1">{motions.map((mo) => (<div key={mo.id} className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}><div className="min-w-0"><div className="text-sm font-medium">{mo.title}</div><div style={{ color: T.textMuted }} className="text-[11px]">{mo.ref ? mo.ref + " · " : ""}{mo.meeting} · decided {fmtDate(mo.decidedDate || mo.date)}{mo.decidedTime ? " " + mo.decidedTime : ""} · for {mo.forCount} / against {mo.againstCount} / abstain {mo.abstainCount}</div></div><Badge color={mo.outcome === "Carried" ? SEMANTIC.ok : SEMANTIC.bad}>{mo.outcome}</Badge></div>))}</div>
        </Card>
      </Wrap>
    </div>
  );
}

// ---------- events ----------------------------------------------------------
function RSVP({ event }) {
  const { T, update, user } = useApp();
  const set = (kind) => update((s) => { const e = s.events.find((x) => x.id === event.id); ["going", "maybe", "cantGo"].forEach((k) => { e[k] = e[k].filter((n) => n !== user.name); }); if (kind) e[kind].push(user.name); });
  const states = [["going", "Going", SEMANTIC.ok], ["maybe", "Maybe", SEMANTIC.warn], ["cantGo", "Can't go", SEMANTIC.bad]];
  return (<div className="flex gap-2 flex-wrap">{states.map(([k, label, c]) => { const on = event[k].includes(user.name); return (<button key={k} onClick={() => set(on ? null : k)} className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: on ? c : "transparent", color: on ? "#fff" : T.text, border: `1px solid ${on ? c : T.border}` }}>{label}</button>); })}</div>);
}
function Events() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.events.filter((e) => e.buildingId === buildingId);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState(null);
  const [f, setF] = useState({ title: "", date: "", timeFrom: "", timeTo: "", location: "", teamsLink: "", organiser: "", image: "" });
  const add = () => { if (!f.title.trim()) return; update((s) => s.events.unshift({ id: "e" + Math.random().toString(36).slice(2, 6), buildingId, ...f, organiser: f.organiser || user.name, going: [], maybe: [], cantGo: [] })); setF({ title: "", date: "", timeFrom: "", timeTo: "", location: "", teamsLink: "", organiser: "", image: "" }); setAdding(false); flash("Event posted"); };

  if (open) {
    const e = store.events.find((x) => x.id === open); if (!e) { setOpen(null); return null; }
    const canEd = isCommittee(user.role) || e.organiser === user.name;
    const startEdit = () => { setEf({ title: e.title, date: e.date, timeFrom: e.timeFrom, timeTo: e.timeTo, location: e.location, teamsLink: e.teamsLink, organiser: e.organiser, image: e.image }); setEditing(true); };
    const saveEdit = () => { update((s) => { const ev = s.events.find((x) => x.id === e.id); Object.assign(ev, { title: ef.title.trim() || ev.title, date: ef.date, timeFrom: ef.timeFrom, timeTo: ef.timeTo, location: ef.location, teamsLink: ef.teamsLink, organiser: ef.organiser, image: ef.image }); }); setEditing(false); flash("Event updated"); };
    const removeEvent = () => { update((s) => { s.events = s.events.filter((x) => x.id !== e.id); }); setEditing(false); setOpen(null); flash("Event removed"); };
    return (<div><Head title="Event" onBack={() => { setEditing(false); setOpen(null); }} backLabel="All events" /><Wrap>
      {editing ? (<Card style={{ padding: 18 }}><div className="space-y-3">
        <Field label="Title"><Input value={ef.title} onChange={(e) => setEf({ ...ef, title: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3"><Field label="Date"><Input type="date" value={ef.date} onChange={(e) => setEf({ ...ef, date: e.target.value })} /></Field><Field label="From"><Input type="time" value={ef.timeFrom} onChange={(e) => setEf({ ...ef, timeFrom: e.target.value })} /></Field><Field label="To"><Input type="time" value={ef.timeTo} onChange={(e) => setEf({ ...ef, timeTo: e.target.value })} /></Field></div>
        <div className="grid sm:grid-cols-2 gap-3"><Field label="Location (physical)"><Input value={ef.location} onChange={(e) => setEf({ ...ef, location: e.target.value })} /></Field><Field label="Teams link (digital)"><Input value={ef.teamsLink} onChange={(e) => setEf({ ...ef, teamsLink: e.target.value })} placeholder="https://teams…" /></Field></div>
        <Field label="Organiser"><Input value={ef.organiser} onChange={(e) => setEf({ ...ef, organiser: e.target.value })} /></Field>
        <Field label="Promo image"><ImagePick value={ef.image} onChange={(v) => setEf({ ...ef, image: v })} /></Field>
        <div className="flex gap-2 flex-wrap"><Btn grad onClick={saveEdit}>Save changes</Btn><Btn kind="ghost" onClick={() => setEditing(false)}>Cancel</Btn><Btn kind="ghost" onClick={removeEvent}><Trash2 size={14} /> Remove</Btn></div>
      </div></Card>) : (
      <Card style={{ padding: 0, overflow: "hidden" }}>{e.image && <img src={e.image} alt="" className="w-full h-56 object-cover" />}<div className="p-6">
        <div className="flex items-start justify-between gap-3"><h2 className="text-2xl font-bold">{e.title}</h2>{canEd && <button onClick={startEdit} className="text-sm font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: T.accent }}><Pencil size={14} /> Edit</button>}</div>
        <div className="space-y-2 mt-3 text-sm">
          <div className="flex items-center gap-2"><Calendar size={16} style={{ color: T.accent }} /> {fmtDate(e.date)}{e.timeFrom && ` · ${e.timeFrom}–${e.timeTo}`}</div>
          {e.location && <div className="flex items-center gap-2"><MapPin size={16} style={{ color: T.accent }} /> {e.location}</div>}
          {e.organiser && <div className="flex items-center gap-2"><Users size={16} style={{ color: T.accent }} /> Organised by {e.organiser}</div>}
        </div>
        {e.teamsLink && <div className="mt-4"><Btn grad onClick={() => openExternal(e.teamsLink)}><Video size={16} /> Join via Teams</Btn></div>}
        <div className="mt-5" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div className="flex gap-4 text-sm mb-3" style={{ color: T.textMuted }}><span><b style={{ color: SEMANTIC.ok }}>{e.going.length}</b> going</span><span><b style={{ color: SEMANTIC.warn }}>{e.maybe.length}</b> maybe</span><span><b style={{ color: SEMANTIC.bad }}>{e.cantGo.length}</b> can't</span></div>
          <div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Your response</div>
          <RSVP event={e} />
          {e.going.length > 0 && <div style={{ color: T.textMuted }} className="text-xs mt-3">Going: {e.going.join(", ")}</div>}
        </div>
      </div></Card>)}
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Events" sub="What's on in the building" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} />
      <Wrap>
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3"><Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="From"><Input type="time" value={f.timeFrom} onChange={(e) => setF({ ...f, timeFrom: e.target.value })} /></Field><Field label="To"><Input type="time" value={f.timeTo} onChange={(e) => setF({ ...f, timeTo: e.target.value })} /></Field></div>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Location (physical)"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field><Field label="Teams link (digital)"><Input value={f.teamsLink} onChange={(e) => setF({ ...f, teamsLink: e.target.value })} placeholder="https://teams…" /></Field></div>
          <Field label="Organiser"><Input value={f.organiser} onChange={(e) => setF({ ...f, organiser: e.target.value })} placeholder={user.name} /></Field>
          <Field label="Promo image (optional)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field>
          <div className="flex gap-2"><Btn grad onClick={add}>Post event</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </div></Card>)}
        {list.map((e) => (<button key={e.id} onClick={() => setOpen(e.id)} className="w-full text-left"><Card hover style={{ padding: 0, overflow: "hidden" }}>{e.image && <img src={e.image} alt="" className="w-full h-40 object-cover" />}<div className="p-[18px]"><div className="flex items-start justify-between gap-2"><div className="font-semibold text-[17px]">{e.title}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div><div style={{ color: T.textMuted }} className="text-sm mt-1 flex flex-wrap gap-x-3"><span className="inline-flex items-center gap-1"><Calendar size={13} /> {fmtDate(e.date)}{e.timeFrom && ` · ${e.timeFrom}`}</span>{e.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {e.location}</span>}{e.teamsLink && <span className="inline-flex items-center gap-1"><Video size={13} /> Teams</span>}</div><div className="flex gap-3 text-xs mt-2.5" style={{ color: T.textMuted }}><span><b style={{ color: SEMANTIC.ok }}>{e.going.length}</b> going</span><span><b style={{ color: SEMANTIC.warn }}>{e.maybe.length}</b> maybe</span></div></div></Card></button>))}
      </Wrap>
    </div>
  );
}

// ---------- gallery (lightbox + save) ---------------------------------------
function Gallery() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.gallery.filter((g) => g.buildingId === buildingId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const newCount = list.filter((g) => g.createdAt > (user.lastSeenGallery || "")).length;
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState("All");
  const [light, setLight] = useState(null);
  const [f, setF] = useState({ caption: "", category: GALLERY_CATEGORIES[0], image: "" });
  const [slide, setSlide] = useState(0);
  const recent = list.slice(0, 10);
  useEffect(() => { if (recent.length < 2) return; const id = setInterval(() => setSlide((s) => (s + 1) % recent.length), 3500); return () => clearInterval(id); }, [recent.length]);
  useEffect(() => { const t = setTimeout(() => update((s) => { const u = s.users.find((x) => x.id === user.id); if (u) u.lastSeenGallery = nowISO(); }), 1200); return () => clearTimeout(t); }, []);
  const add = () => { if (!f.image && !f.caption.trim()) return; update((s) => s.gallery.unshift({ id: "g" + Math.random().toString(36).slice(2, 6), buildingId, caption: f.caption.trim() || "Untitled", category: f.category, color: T.accent, image: f.image, postedBy: user.name, createdAt: nowISO() })); setF({ caption: "", category: GALLERY_CATEGORIES[0], image: "" }); setAdding(false); flash("Photo added to the gallery"); };
  const filtered = cat === "All" ? list : list.filter((g) => g.category === cat);
  const cur = recent[slide];
  const save = (g) => { if (!g.image) { flash("Sample tile — upload photos to save"); return; } const a = document.createElement("a"); a.href = g.image; a.download = (g.caption || "photo") + ".png"; a.click(); };
  return (
    <div>
      <Head title="Gallery" sub="Photos from the community" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add photo</HeaderAction>} />
      <Wrap>
        {newCount > 0 && <Card style={{ padding: 14, background: hexToRgba(T.accent, T.mode === "dark" ? 0.16 : 0.1), border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}><div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} style={{ color: T.accent }} /> {newCount} new photo{newCount > 1 ? "s" : ""} since you last looked</div></Card>}
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3"><Field label="Photo"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field><div className="grid sm:grid-cols-2 gap-3"><Field label="Caption"><Input value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} placeholder="Name this photo" /></Field><Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{GALLERY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field></div><div className="flex gap-2"><Btn grad onClick={add}>Add photo</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div></div></Card>)}
        {recent.length > 0 && cur && (<button onClick={() => setLight(cur)} className="relative rounded-2xl overflow-hidden block w-full" style={{ height: 220, border: `1px solid ${T.border}` }}>{cur.image ? <img src={cur.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center" style={{ background: `linear-gradient(135deg, ${cur.color}, ${hexToRgba(cur.color, 0.55)})` }}><ImageIcon className="text-white/70" size={32} /></div>}<div className="absolute inset-x-0 bottom-0 p-4 text-white text-left" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}><div className="font-semibold">{cur.caption}</div><div className="text-xs text-white/80">{cur.category} · {cur.postedBy}</div></div><div className="absolute bottom-3 right-3 flex gap-1.5">{recent.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === slide ? 16 : 6, background: i === slide ? "#fff" : "rgba(255,255,255,0.5)" }} />)}</div></button>)}
        <div className="flex gap-2 flex-wrap">{["All", ...GALLERY_CATEGORIES].map((c) => { const on = cat === c; return <button key={c} onClick={() => setCat(c)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{c}</button>; })}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{filtered.map((g) => (<button key={g.id} onClick={() => setLight(g)} className="text-left"><div className="rounded-2xl overflow-hidden aspect-square">{g.image ? <img src={g.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center" style={{ background: `linear-gradient(135deg, ${g.color}, ${hexToRgba(g.color, 0.6)})` }}><ImageIcon className="text-white/70" /></div>}</div><div className="text-sm mt-1.5 font-medium">{g.caption}</div><div style={{ color: T.textMuted }} className="text-xs">{g.category} · {g.postedBy}</div></button>))}</div>
      </Wrap>
      {light && (<div className="fixed inset-0 z-[80] grid place-items-center p-5" onClick={() => setLight(null)}><div className="absolute inset-0 bg-black/80" /><div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}><button onClick={() => setLight(null)} className="absolute -top-10 right-0 text-white/80 p-1"><X size={24} /></button>{light.image ? <img src={light.image} alt="" className="w-full rounded-2xl" /> : <div className="w-full aspect-video grid place-items-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${light.color}, ${hexToRgba(light.color, 0.6)})` }}><ImageIcon className="text-white/70" size={40} /></div>}<div className="flex items-center justify-between mt-3 text-white"><div><div className="font-semibold">{light.caption}</div><div className="text-xs text-white/70">{light.category} · {light.postedBy}</div></div><button onClick={() => save(light)} className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5"><Download size={16} /> Save</button></div></div></div>)}
    </div>
  );
}

// ---------- marketplace -----------------------------------------------------
function Marketplace() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const live = store.marketplace.filter((m) => m.buildingId === buildingId && (m.status !== "active" || addDays(m.createdAt.slice(0, 10), 30) >= today()));
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ title: "", price: "", contact: user.phone || user.email || "", desc: "", image: "" });
  const add = () => { if (!f.title.trim()) return; update((s) => s.marketplace.unshift({ id: "p" + Math.random().toString(36).slice(2, 6), buildingId, ...f, seller: user.name, status: "active", createdAt: nowISO() })); setF({ title: "", price: "", contact: user.phone || user.email || "", desc: "", image: "" }); setAdding(false); flash("Listed · auto-expires in 30 days unless renewed"); };
  const setStatus = (id, status) => update((s) => { s.marketplace.find((x) => x.id === id).status = status; });
  const renew = (id) => { update((s) => { s.marketplace.find((x) => x.id === id).createdAt = nowISO(); }); flash("Listing renewed for 30 days"); };
  const remove = (id) => { update((s) => { s.marketplace = s.marketplace.filter((x) => x.id !== id); }); setOpen(null); };

  if (open) {
    const m = store.marketplace.find((x) => x.id === open); if (!m) { setOpen(null); return null; }
    const mine = m.seller === user.name; const daysLeft = 30 - daysBetween(m.createdAt.slice(0, 10), today());
    return (<div><Head title="Listing" onBack={() => setOpen(null)} backLabel="Marketplace" /><Wrap>
      <Card style={{ padding: 0, overflow: "hidden" }}>{m.image && <img src={m.image} alt="" className="w-full h-56 object-cover" />}<div className="p-6">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{m.title}</h2><div className="text-2xl font-bold" style={{ color: T.accent }}>{m.price}</div></div>
        <p className="text-[15px] mt-3">{m.desc}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span style={{ color: T.textMuted }} className="text-sm">{m.seller}</span>{m.status !== "active" && <Badge color={m.status === "sold" ? SEMANTIC.ok : SEMANTIC.warn}>{m.status === "sold" ? "Sold" : "Pending"}</Badge>}{m.status === "active" && <span style={{ color: daysLeft <= 5 ? SEMANTIC.warn : T.textMuted }} className="text-xs">{daysLeft}d left</span>}</div>
        <div className="mt-4" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Contact the seller</div><Btn grad onClick={() => openExternal(m.contact.includes("@") ? `mailto:${m.contact}` : `tel:${m.contact}`)}><Phone size={15} /> {m.contact}</Btn></div>
        {mine && (<div className="flex gap-2 mt-4 flex-wrap">{m.status !== "sold" && <Btn kind="soft" onClick={() => setStatus(m.id, "pending")}>Mark pending</Btn>}{m.status !== "sold" && <Btn kind="soft" onClick={() => setStatus(m.id, "sold")}>Mark sold</Btn>}<Btn kind="ghost" onClick={() => renew(m.id)}><RefreshCw size={14} /> Renew</Btn><Btn kind="ghost" onClick={() => remove(m.id)}><Trash2 size={14} /> Remove</Btn></div>)}
      </div></Card>
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Marketplace" sub="Buy & sell within the building" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> List item</HeaderAction>} />
      <Wrap>
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3"><Field label="Photo (optional)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Item"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label="Price"><Input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="$" /></Field></div><Field label="Contact (so buyers can reach you)"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Phone or email" /></Field><Field label="Details"><TextArea rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field><p style={{ color: T.textMuted }} className="text-xs flex items-center gap-1.5"><ClockIcon size={13} /> Listings auto-expire after 30 days unless renewed or marked sold/pending.</p><div className="flex gap-2"><Btn grad onClick={add}>List item</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div></div></Card>)}
        {live.length === 0 && <Empty icon={ShoppingBag} title="Nothing listed yet" hint="List something your neighbours might want." />}
        {live.map((m) => { const daysLeft = 30 - daysBetween(m.createdAt.slice(0, 10), today()); const stc = m.status === "sold" ? SEMANTIC.ok : m.status === "pending" ? SEMANTIC.warn : T.textMuted; return (
          <button key={m.id} onClick={() => setOpen(m.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3">{m.image ? <img src={m.image} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" /> : <div className="h-14 w-14 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><ShoppingBag size={20} /></div>}<div className="flex-1 min-w-0"><div className="font-semibold truncate">{m.title}</div><div style={{ color: T.textMuted }} className="text-xs">{m.seller}{m.status === "active" ? ` · ${daysLeft}d left` : ""}</div></div><div className="text-right"><div className="font-bold" style={{ color: T.accent }}>{m.price}</div>{m.status !== "active" && <Badge color={stc}>{m.status === "sold" ? "Sold" : "Pending"}</Badge>}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>
        ); })}
      </Wrap>
    </div>
  );
}

// ---------- messaging -------------------------------------------------------
function Messaging() {
  const { T, store, update, building, buildingId, user, flash } = useApp();
  const list = store.messages.filter((m) => m.buildingId === buildingId && (isApprover(user.role) || m.from === user.name));
  const [f, setF] = useState({ to: "Committee (BCC)", category: "Query", subject: "", body: "", doc: "" });
  const send = () => { if (!f.subject.trim()) return; if (f.category === "Application" && !f.doc) { flash("Applications need a document attached"); return; } update((s) => s.messages.unshift({ id: "msg" + Math.random().toString(36).slice(2, 6), buildingId, ...f, from: user.name, date: today() })); setF({ to: "Committee (BCC)", category: "Query", subject: "", body: "", doc: "" }); flash("Message sent"); };
  return (
    <div>
      <Head title="Messaging" sub="Contact the committee or building manager" />
      <Wrap>
        {(building.modules ? building.modules.whatsapp !== false : true) && <Card style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}><MessageCircle size={20} /></div><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{building.whatsappName || "WhatsApp Group"}</div><div style={{ color: T.textMuted }} className="text-xs">For quick chatter — keep formal requests here in the portal.</div></div><Btn grad onClick={() => building.whatsappLink ? openExternal(building.whatsappLink) : flash("WhatsApp Group not set up")}><ExternalLink size={15} /> Open</Btn></div></Card>}
        <Card style={{ padding: 18 }}><div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Field label="To"><Select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option>Committee (BCC)</option><option>Building manager</option></Select></Field><Field label="Type"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MSG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
          <Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Message"><TextArea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          {f.category === "Application" && <Field label="Document (required for applications)"><label style={{ borderColor: f.doc ? T.accent : T.border, color: f.doc ? T.text : T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-3 px-3 text-sm cursor-pointer"><Paperclip size={15} /> {f.doc || "Attach your application document"}<input type="file" className="hidden" onChange={(e) => setF({ ...f, doc: e.target.files?.[0]?.name || "" })} /></label></Field>}
          <Btn grad onClick={send}>Send message</Btn>
        </div></Card>
        {list.map((m) => (<Card key={m.id} style={{ padding: 16 }}><div className="flex items-center justify-between gap-2"><div className="font-semibold">{m.subject}</div><div className="flex gap-1.5"><Badge color={HUE.messaging[1]}>{m.category}</Badge><Badge color={T.textMuted}>→ {m.to}</Badge></div></div><p style={{ color: T.textMuted }} className="text-sm mt-1">{m.body}</p>{m.doc && <div className="mt-2"><FileChip name={m.doc} color={T.accent} /></div>}<div style={{ color: T.textMuted }} className="text-xs mt-2">{m.from} · {fmtDate(m.date)}</div></Card>))}
      </Wrap>
    </div>
  );
}

// ---------- directory -------------------------------------------------------
function Directory() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const [sort, setSort] = useState("unit");
  const listed = store.users.filter((u) => u.buildingId === buildingId && u.status === "active" && u.directoryOptIn);
  const sorted = [...listed].sort((a, b) => {
    if (sort === "unit") return String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true });
    if (sort === "first") return a.name.localeCompare(b.name);
    return a.name.split(" ").slice(-1)[0].localeCompare(b.name.split(" ").slice(-1)[0]);
  });
  const setSelf = (k) => update((s) => { const u = s.users.find((x) => x.id === user.id); u[k] = !u[k]; });
  const setSelfVal = (k, v) => update((s) => { const u = s.users.find((x) => x.id === user.id); u[k] = v; });
  const SORTS = [["unit", "Unit"], ["first", "First name"], ["last", "Last name"]];
  return (
    <div>
      <Head title="Directory" sub="Neighbours who chose to be listed" />
      <Wrap>
        <Card style={{ padding: 16 }}><div className="space-y-3">
          <div><div style={{ color: T.textMuted }} className="text-xs font-semibold uppercase tracking-wider mb-2">Your contact details</div><div className="grid sm:grid-cols-2 gap-3"><Field label="Phone"><Input value={user.phone || ""} onChange={(e) => setSelfVal("phone", e.target.value)} placeholder="04xx xxx xxx" /></Field><Field label="Email"><Input value={user.email || ""} onChange={(e) => setSelfVal("email", e.target.value)} placeholder="you@example.com" /></Field></div></div>
          <Toggle label="Show me in the directory" hint="Nothing of yours appears unless this is on." on={user.directoryOptIn} onClick={() => setSelf("directoryOptIn")} />
          {user.directoryOptIn && (<><Toggle label="Show my phone" on={user.showPhone} onClick={() => setSelf("showPhone")} small /><Toggle label="Show my email" on={user.showEmail} onClick={() => setSelf("showEmail")} small /></>)}
        </div></Card>
        <div className="flex items-center gap-2"><span style={{ color: T.textMuted }} className="text-xs font-semibold uppercase tracking-wider">Sort</span>{SORTS.map(([k, label]) => { const on = sort === k; return <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{label}</button>; })}</div>
        {sorted.length === 0 && <Empty icon={Users} title="No one listed yet" hint="Opt in above to start the directory." />}
        {sorted.map((u) => (<Card key={u.id} style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl grid place-items-center font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}>{u.unit}</div><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{u.name}{u.id === user.id && <span style={{ color: T.textMuted }} className="font-normal"> (you)</span>}</div><div style={{ color: T.textMuted }} className="text-xs">Unit {u.unit} · {ROLE_LABEL[u.role]}</div></div><div className="text-right space-y-0.5">{u.showPhone && u.phone && <a href={`tel:${u.phone}`} className="text-xs flex items-center justify-end gap-1" style={{ color: T.accent }}><Phone size={12} /> {u.phone}</a>}{u.showEmail && <a href={`mailto:${u.email}`} className="text-xs flex items-center justify-end gap-1" style={{ color: T.accent }}><Mail size={12} /> Email</a>}</div></div></Card>))}
      </Wrap>
    </div>
  );
}
function Toggle({ label, hint, on, onClick, small }) {
  const { T } = useApp();
  return (<div className="flex items-center gap-3"><div className="flex-1"><div className={`font-semibold ${small ? "text-[13px]" : "text-sm"}`}>{label}</div>{hint && <div style={{ color: T.textMuted }} className="text-xs">{hint}</div>}</div><button onClick={onClick} className="w-12 h-7 rounded-full transition relative shrink-0" style={{ background: on ? T.accent : T.border }}><span className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all" style={{ left: on ? 22 : 2 }} /></button></div>);
}

// ---------- documents -------------------------------------------------------
function Documents() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const canManage = isCommittee(user.role);
  const all = store.documents.filter((d) => d.buildingId === buildingId);
  const visible = all.filter((d) => d.visibility === "committee" ? isCommittee(user.role) : d.visibility === "owners" ? (d.released && (user.role === "owner" || isCommittee(user.role))) : d.released);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", category: DOC_CATEGORIES[0], visibility: "all", fileType: "", fileName: "", fileData: "" });
  const release = (id) => { update((s) => { const d = s.documents.find((x) => x.id === id); d.released = true; if (d.visibility === "committee") d.visibility = "owners"; }); flash("Document released"); };
  const upload = () => { if (!f.fileName || !f.category) return; update((s) => s.documents.unshift({ id: "d" + Math.random().toString(36).slice(2, 6), buildingId, title: f.title.trim() || f.fileName.replace(/\.[^.]+$/, ""), category: f.category, visibility: f.visibility, released: f.visibility !== "committee", uploadedBy: user.name, date: today(), fileType: f.fileType, fileData: f.fileData })); setF({ title: "", category: DOC_CATEGORIES[0], visibility: "all", fileType: "", fileName: "", fileData: "" }); setAdding(false); flash("Document filed"); };
  const openDoc = (d) => { if (d.fileData) { const a = document.createElement("a"); a.href = d.fileData; a.download = d.title + "." + (d.fileType || "file").toLowerCase(); a.click(); } else flash(`Opening ${d.title}`); };
  const cats = [...new Set(visible.map((d) => d.category))];
  return (
    <div>
      <Head title="Documents" sub={canManage ? "The committee's record of activity & source of truth" : "Building documents available to you"} action={canManage && <HeaderAction onClick={() => setAdding(true)}><Upload size={16} /> Upload</HeaderAction>} />
      <Wrap>
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="File (any type)"><label style={{ borderColor: f.fileName ? T.accent : T.border, color: f.fileName ? T.text : T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-4 px-3 text-sm cursor-pointer"><Upload size={16} /> {f.fileName || "Choose a file to upload"}<input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (d) => setF((p) => ({ ...p, fileName: file.name, fileType: (file.name.split(".").pop() || "").toUpperCase(), fileData: d }))); }} /></label></Field>
          <Field label="Title (optional)"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Defaults to the file name" /></Field>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Category (required)"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Who can see it"><Select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}><option value="all">All residents</option><option value="owners">Owners only</option><option value="committee">Committee only (working file)</option></Select></Field></div>
          <div className="flex gap-2"><Btn grad onClick={upload}>File document</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </div></Card>)}
        {cats.length === 0 && <Empty icon={FolderOpen} title="No documents yet" hint={canManage ? "Upload your first record." : "Documents will appear here once released."} />}
        {cats.map((cat) => (<div key={cat}><SectionTitle><span className="inline-flex items-center gap-1.5"><FolderOpen size={13} /> {cat}</span></SectionTitle>{visible.filter((d) => d.category === cat).map((d) => (<button key={d.id} onClick={() => openDoc(d)} className="w-full text-left"><Card hover style={{ padding: 14, marginBottom: 8 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><FileText size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{d.title}</div><div style={{ color: T.textMuted }} className="text-[11px] flex flex-wrap gap-x-2">{d.fileType && <span>{d.fileType}</span>}<span>Filed {fmtDate(d.date)} · {d.uploadedBy}</span></div>{!d.released && <div style={{ color: SEMANTIC.warn }} className="text-[11px] flex items-center gap-1 mt-0.5"><Lock size={10} /> Committee only — not yet released</div>}</div>{canManage && !d.released ? <Btn grad onClick={(e) => { e.stopPropagation(); release(d.id); }} className="!px-3 !py-1.5 !text-xs">Release</Btn> : <Download size={16} style={{ color: T.textMuted }} />}</div></Card></button>))}</div>))}
      </Wrap>
    </div>
  );
}

// ---------- meetings --------------------------------------------------------
function Meetings() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.meetings.filter((m) => m.buildingId === buildingId);
  const [open, setOpen] = useState(null);
  const [agItem, setAgItem] = useState("");
  const bcc = store.users.filter((u) => u.buildingId === buildingId && (u.role === "bcc" || u.role === "admin"));
  const [showMo, setShowMo] = useState(false);
  const [mo, setMo] = useState({ title: "", ref: "", mover: "", seconder: "", meetingDate: "" });
  const [recId, setRecId] = useState(null);
  const [decF, setDecF] = useState({ forCount: "", againstCount: "", abstainCount: "", decidedDate: today(), decidedTime: "" });
  const canEdit = isCommittee(user.role);
  const minutesDoc = (name) => store.documents.find((d) => d.buildingId === buildingId && d.title === name);
  const STANDING = ["Welcome & apologies", "Confirm previous minutes", "Maintenance update", "Financial report", "Correspondence", "General business"];
  if (open) {
    const m = store.meetings.find((x) => x.id === open); if (!m) { setOpen(null); return null; }
    const md = m.minutes ? minutesDoc(m.minutes) : null;
    const set = (kind) => update((s) => { const mm = s.meetings.find((x) => x.id === m.id); ["going", "apologies"].forEach((k) => { mm[k] = mm[k].filter((n) => n !== user.name); }); if (kind) mm[kind].push(user.name); });
    const draft = () => { const openA = store.actions.filter((a) => a.buildingId === buildingId && a.status === "open"); const items = ["Welcome & apologies", "Confirm previous minutes"]; openA.forEach((a) => items.push("Action review: " + a.title)); items.push("Maintenance update", "Financial report", "Correspondence", "General business"); update((s) => { s.meetings.find((x) => x.id === m.id).agenda = items; }); flash("Draft agenda generated from open actions"); };
    const addAg = () => { if (!agItem.trim()) return; update((s) => s.meetings.find((x) => x.id === m.id).agenda.push(agItem.trim())); setAgItem(""); };
    const rmAg = (i) => update((s) => { s.meetings.find((x) => x.id === m.id).agenda.splice(i, 1); });
    const addProposed = () => { if (!mo.title.trim()) return; update((s) => s.meetings.find((x) => x.id === m.id).motions.push({ id: "mo" + Math.random().toString(36).slice(2, 6), ref: mo.ref.trim(), title: mo.title.trim(), mover: mo.mover, seconder: mo.seconder, meetingDate: mo.meetingDate || m.date, status: "proposed", forCount: 0, againstCount: 0, abstainCount: 0, outcome: "", decidedDate: "", decidedTime: "" })); setMo({ title: "", ref: "", mover: "", seconder: "", meetingDate: "" }); setShowMo(false); flash("Proposed motion added"); };
    const openRec = (x) => { setRecId(x.id); setDecF({ forCount: "", againstCount: "", abstainCount: "", decidedDate: x.meetingDate || m.date || today(), decidedTime: "" }); };
    const recordDec = (id) => { if (!decF.decidedDate || !decF.decidedTime) { flash("Add the date and time the decision was taken"); return; } const f = +decF.forCount || 0, a = +decF.againstCount || 0, ab = +decF.abstainCount || 0; update((s) => { const x = s.meetings.find((y) => y.id === m.id).motions.find((y) => y.id === id); x.forCount = f; x.againstCount = a; x.abstainCount = ab; x.outcome = f > a ? "Carried" : "Lost"; x.status = "decided"; x.decidedDate = decF.decidedDate; x.decidedTime = decF.decidedTime; }); setRecId(null); flash("Decision recorded"); };
    const rmMotion = (id) => update((s) => { const mm = s.meetings.find((x) => x.id === m.id); mm.motions = mm.motions.filter((y) => y.id !== id); });
    return (<div><Head title="Meeting" onBack={() => setOpen(null)} backLabel="All meetings" /><Wrap>
      <Card style={{ padding: 24 }}>
        <h2 className="text-xl font-bold">{m.title}</h2>
        <div className="space-y-2 mt-3 text-sm">
          <div className="flex items-center gap-2"><Calendar size={16} style={{ color: T.accent }} /> {fmtDate(m.date)}{m.timeFrom && ` · ${m.timeFrom}–${m.timeTo}`}</div>
          {m.location && <div className="flex items-center gap-2"><MapPin size={16} style={{ color: T.accent }} /> {m.location}</div>}
        </div>
        {m.teamsLink && <div className="mt-4"><Btn grad onClick={() => openExternal(m.teamsLink)}><Video size={16} /> Join via Teams</Btn></div>}
        {m.note && <p style={{ color: T.textMuted }} className="text-sm mt-4">{m.note}</p>}
        {m.minutes && <div className="mt-4"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Minutes</div>{md ? <FileChip name={md.title} data={md.fileData} color={T.accent} /> : <Badge color={T.textMuted}>{m.minutes}</Badge>}</div>}
        <div className="mt-5" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div className="flex gap-4 text-sm mb-3" style={{ color: T.textMuted }}><span><b style={{ color: SEMANTIC.ok }}>{m.going.length}</b> attending</span><span><b style={{ color: SEMANTIC.warn }}>{m.apologies.length}</b> apologies</span></div>
          <div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Your response</div>
          <div className="flex gap-2">{[["going", "I'll attend", SEMANTIC.ok], ["apologies", "Send apologies", SEMANTIC.warn]].map(([k, label, c]) => { const on = m[k].includes(user.name); return <button key={k} onClick={() => set(on ? null : k)} className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: on ? c : "transparent", color: on ? "#fff" : T.text, border: `1px solid ${on ? c : T.border}` }}>{label}</button>; })}</div>
        </div>
      </Card>

      <Card style={{ padding: 18 }}><SectionTitle right={canEdit && <button onClick={draft} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><RefreshCw size={12} /> Draft from open actions</button>}>Agenda</SectionTitle>
        {m.agenda.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No agenda yet.{canEdit ? " Draft one from open actions or add items below." : ""}</p>}
        <ol className="space-y-1.5">{m.agenda.map((it, i) => (<li key={i} className="flex items-center gap-2 text-sm"><span className="h-5 w-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}>{i + 1}</span><span className="flex-1">{it}</span>{canEdit && <button onClick={() => rmAg(i)} style={{ color: T.textMuted }}><X size={13} /></button>}</li>))}</ol>
        {canEdit && <div className="flex gap-2 mt-3"><Input value={agItem} onChange={(e) => setAgItem(e.target.value)} placeholder="Add agenda item" /><Btn grad onClick={addAg}><Plus size={15} /></Btn></div>}
      </Card>

      <Card style={{ padding: 18 }}><SectionTitle right={canEdit && <button onClick={() => setShowMo((v) => !v)} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><Plus size={12} /> Add motion</button>}>Motions &amp; decisions</SectionTitle>
        {showMo && canEdit && (<div className="space-y-3 mb-4 rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
          <Field label="Motion"><Input value={mo.title} onChange={(e) => setMo({ ...mo, title: e.target.value })} placeholder="e.g. Approve the carpark door repair quote" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Reference no. (optional)"><Input value={mo.ref} onChange={(e) => setMo({ ...mo, ref: e.target.value })} placeholder="e.g. M-2026-014" /></Field><Field label="Meeting date"><Input type="date" value={mo.meetingDate || m.date} onChange={(e) => setMo({ ...mo, meetingDate: e.target.value })} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Moved by"><Select value={mo.mover} onChange={(e) => setMo({ ...mo, mover: e.target.value })}><option value="">Select…</option>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field><Field label="Seconded by"><Select value={mo.seconder} onChange={(e) => setMo({ ...mo, seconder: e.target.value })}><option value="">Select…</option>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field></div>
          <div className="flex gap-2"><Btn grad onClick={addProposed}><Plus size={15} /> Add proposed motion</Btn><Btn kind="ghost" onClick={() => setShowMo(false)}>Cancel</Btn></div>
        </div>)}
        {m.motions.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No motions yet.{canEdit ? " Add proposed motions to vote on, then record each decision." : ""}</p>}
        <div className="space-y-2.5">{m.motions.map((x) => { const decided = x.status === "decided"; return (
          <div key={x.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">{x.ref && <span style={{ color: T.textMuted }} className="text-[11px] font-bold">{x.ref}</span>}<div className="font-medium text-sm">{x.title}</div></div>
              <div className="flex items-center gap-1.5 shrink-0"><Badge color={decided ? (x.outcome === "Carried" ? SEMANTIC.ok : SEMANTIC.bad) : SEMANTIC.warn}>{decided ? x.outcome : "Proposed"}</Badge>{canEdit && <button onClick={() => rmMotion(x.id)} style={{ color: T.textMuted }}><X size={13} /></button>}</div>
            </div>
            <div style={{ color: T.textMuted }} className="text-[11px] mt-1.5">{(x.mover || x.seconder) && <>Moved {x.mover || "—"}{x.seconder && `, seconded ${x.seconder}`} · </>}Meeting {fmtDate(x.meetingDate || m.date)}</div>
            {decided && <div style={{ color: T.textMuted }} className="text-[11px] mt-0.5">For {x.forCount} / against {x.againstCount} / abstain {x.abstainCount} · decided {fmtDate(x.decidedDate)}{x.decidedTime ? ` ${x.decidedTime}` : ""}</div>}
            {!decided && canEdit && (recId === x.id ? (<div className="mt-3 space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div className="grid grid-cols-3 gap-2"><Field label="For"><Input type="number" value={decF.forCount} onChange={(e) => setDecF({ ...decF, forCount: e.target.value })} /></Field><Field label="Against"><Input type="number" value={decF.againstCount} onChange={(e) => setDecF({ ...decF, againstCount: e.target.value })} /></Field><Field label="Abstain"><Input type="number" value={decF.abstainCount} onChange={(e) => setDecF({ ...decF, abstainCount: e.target.value })} /></Field></div>
              <div className="grid grid-cols-2 gap-2"><Field label="Decision date"><Input type="date" value={decF.decidedDate} onChange={(e) => setDecF({ ...decF, decidedDate: e.target.value })} /></Field><Field label="Decision time"><Input type="time" value={decF.decidedTime} onChange={(e) => setDecF({ ...decF, decidedTime: e.target.value })} /></Field></div>
              <div className="flex gap-2"><Btn grad onClick={() => recordDec(x.id)}><Vote size={15} /> Save decision</Btn><Btn kind="ghost" onClick={() => setRecId(null)}>Cancel</Btn></div>
            </div>) : <div className="mt-2"><Btn kind="soft" onClick={() => openRec(x)} className="!py-1.5 !text-xs"><Vote size={13} /> Record decision</Btn></div>)}
          </div>
        ); })}</div>
      </Card>
    </Wrap></div>);
  }
  return (<div><Head title="Meetings" sub="AGM and committee meetings" /><Wrap>{list.map((m) => (<button key={m.id} onClick={() => setOpen(m.id)} className="w-full text-left"><Card hover style={{ padding: 16 }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${HUE.meetings[0]}, ${HUE.meetings[1]})` }}><Gavel size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold">{m.title}</div><div style={{ color: T.textMuted }} className="text-xs">{fmtDate(m.date)}{m.timeFrom && ` · ${m.timeFrom}`}{m.motions.filter((x) => x.status === "decided").length > 0 && ` · ${m.motions.filter((x) => x.status === "decided").length} decision(s)`}</div></div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>))}</Wrap></div>);
}

// ---------- key & fob register (committee only) -----------------------------
function KeyFobRegister() {
  const { T, store, update, buildingId, flash } = useApp();
  const list = store.keyfobs.filter((k) => k.buildingId === buildingId);
  const [adding, setAdding] = useState(false);
  const [filt, setFilt] = useState("all");
  const [kbulk, setKbulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const importFobs = () => { const rows = kbulk.split("\n").map((l) => l.trim()).filter(Boolean); if (!rows.length) return; update((s) => rows.forEach((l) => { const [type, label, serial, unit, holder] = l.split(",").map((x) => (x || "").trim()); s.keyfobs.unshift({ id: "kf" + Math.random().toString(36).slice(2, 8), buildingId, type: type || "Fob", label: label || "", serial: serial || "", unit: unit || "", holder: holder || "", issued: today(), status: "issued", notes: "" }); })); setKbulk(""); setShowBulk(false); flash(`${rows.length} device(s) imported`); };
  const [f, setF] = useState({ type: "Fob", label: "", serial: "", unit: "", holder: "", issued: today(), notes: "" });
  const add = () => { if (!f.label.trim() && !f.serial.trim()) return; update((s) => s.keyfobs.unshift({ id: "kf" + Math.random().toString(36).slice(2, 6), buildingId, ...f, status: "issued" })); setF({ type: "Fob", label: "", serial: "", unit: "", holder: "", issued: today(), notes: "" }); setAdding(false); flash("Added to register"); };
  const setStatus = (id, status) => update((s) => { s.keyfobs.find((x) => x.id === id).status = status; });
  const STC = { issued: SEMANTIC.ok, returned: T.textMuted, lost: SEMANTIC.bad };
  const counts = { issued: list.filter((k) => k.status === "issued").length, returned: list.filter((k) => k.status === "returned").length, lost: list.filter((k) => k.status === "lost").length };
  const shown = filt === "all" ? list : list.filter((k) => k.status === filt);
  return (<div><Head title="Key & Fob Register" sub="Committee-only record of access devices" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} /><Wrap>
    <Card style={{ padding: 14, background: T.surfaceAlt }}><div className="flex items-center justify-between gap-2"><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><Lock size={14} /> Visible to the committee only — residents can't see this page.</p><button onClick={() => setShowBulk((v) => !v)} className="text-[11px] font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: T.accent }}><Upload size={12} /> Bulk import</button></div>
      {showBulk && <div className="mt-3"><Field label="type, label, serial, unit, holder (one per line)"><TextArea rows={3} value={kbulk} onChange={(e) => setKbulk(e.target.value)} placeholder={"Fob, Main entry, SN-1024, 412, Sandra Pho"} /></Field><div className="mt-2"><Btn grad onClick={importFobs}><Upload size={15} /> Import devices</Btn></div></div>}
    </Card>
    {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Fob", "Key", "Remote", "Swipe card"].map((t) => <option key={t}>{t}</option>)}</Select></Field><Field label="What it opens"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Main entry" /></Field></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Serial / number"><Input value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></Field><Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Holder"><Input value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} /></Field><Field label="Issued"><Input type="date" value={f.issued} onChange={(e) => setF({ ...f, issued: e.target.value })} /></Field></div>
      <Field label="Notes (optional)"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="flex gap-2"><Btn grad onClick={add}>Add device</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
    </div></Card>)}
    <div className="flex gap-2 flex-wrap">{[["all", "All"], ["issued", `Issued ${counts.issued}`], ["returned", `Returned ${counts.returned}`], ["lost", `Lost ${counts.lost}`]].map(([k, label]) => { const on = filt === k; return <button key={k} onClick={() => setFilt(k)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{label}</button>; })}</div>
    {shown.length === 0 && <Empty icon={KeyRound} title="Nothing here" hint="Add access devices to track who holds what." />}
    {shown.map((k) => (<Card key={k.id} style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><KeyRound size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{k.type} · {k.label}{k.serial ? ` · ${k.serial}` : ""}</div><div style={{ color: T.textMuted }} className="text-xs">Unit {k.unit || "—"} · {k.holder || "unassigned"} · issued {fmtDate(k.issued)}{k.notes ? ` · ${k.notes}` : ""}</div></div><Badge color={STC[k.status]}>{k.status}</Badge></div><div className="flex gap-2 mt-3">{k.status !== "returned" && <Btn kind="soft" onClick={() => setStatus(k.id, "returned")} className="!py-1.5 !text-xs">Mark returned</Btn>}{k.status !== "lost" && <Btn kind="ghost" onClick={() => setStatus(k.id, "lost")} className="!py-1.5 !text-xs">Mark lost</Btn>}{k.status !== "issued" && <Btn kind="ghost" onClick={() => setStatus(k.id, "issued")} className="!py-1.5 !text-xs">Re-issue</Btn>}</div></Card>))}
  </Wrap></div>);
}

// ---------- fire safety -----------------------------------------------------
function FireSafety() {
  const { T, store, update, building, user, flash } = useApp();
  const canEdit = isCommittee(user.role);
  const [c, setC] = useState({ label: "", number: "" });
  const std = [
    { label: "Emergency — Police, Fire, Ambulance", number: "000" },
    { label: "Emergency from a mobile", number: "112" },
    { label: "Text emergency (hearing / speech impaired)", number: "106" },
    { label: "SES — storm & flood", number: "132 500" },
    { label: "Poisons Information", number: "13 11 26" },
    { label: "13 HEALTH", number: "13 43 25 84" },
  ];
  const custom = building.emergency || [];
  const addC = () => { if (!c.label.trim() || !c.number.trim()) return; update((s) => { const b = s.buildings.find((x) => x.id === building.id); b.emergency = b.emergency || []; b.emergency.push({ label: c.label.trim(), number: c.number.trim() }); }); setC({ label: "", number: "" }); flash("Contact added"); };
  const rmC = (i) => update((s) => { s.buildings.find((x) => x.id === building.id).emergency.splice(i, 1); });
  return (<div><Head title="Fire Safety" sub="Emergency contacts & Queensland references" /><Wrap>
    <Card style={{ padding: 18 }}><SectionTitle>Emergency contacts</SectionTitle>
      {std.map((x, i) => (<div key={i} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm">{x.label}</span><a href={`tel:${x.number.replace(/\s/g, "")}`} className="font-bold" style={{ color: T.accent }}>{x.number}</a></div>))}
      {building.buildingManager && <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm">Building manager — {building.buildingManager}</span><span style={{ color: T.textMuted }} className="text-xs">on site</span></div>}
      {custom.map((x, i) => (<div key={i} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm">{x.label}</span><div className="flex items-center gap-2"><a href={`tel:${x.number.replace(/\s/g, "")}`} className="font-bold" style={{ color: T.accent }}>{x.number}</a>{canEdit && <button onClick={() => rmC(i)} style={{ color: T.textMuted }}><X size={13} /></button>}</div></div>))}
      {canEdit && (<div className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-2"><Input value={c.label} onChange={(e) => setC({ ...c, label: e.target.value })} placeholder="Label" /><Input value={c.number} onChange={(e) => setC({ ...c, number: e.target.value })} placeholder="Number" /></div><Btn grad onClick={addC}><Plus size={15} /> Add contact</Btn></div>)}
    </Card>
    <Card style={{ padding: 18 }}><div className="flex items-center gap-2 mb-2"><Flame size={18} style={{ color: SEMANTIC.bad }} /><div className="font-semibold">Queensland smoke alarm law</div></div>
      <ul className="space-y-2 text-sm" style={{ color: T.text }}>
        <li>• All Queensland homes, townhouses and units must have <b>interconnected photoelectric smoke alarms</b> by <b>1 January 2027</b> (already required for properties sold or leased since 1 January 2022).</li>
        <li>• Alarms must be photoelectric — ionisation alarms are no longer permitted — comply with <b>AS 3786-2014</b>, be under 10 years old, and interconnected so when one sounds, they all sound.</li>
        <li>• Required in every bedroom, in hallways connecting bedrooms, and on every storey.</li>
        <li>• The law applies to both houses/townhouses (class 1a) and units/apartments (class 2).</li>
      </ul>
      <div style={{ color: T.textMuted }} className="text-xs mt-3">Source: Queensland Fire Department (fire.qld.gov.au) and qld.gov.au — general information only. Confirm your building's obligations with your strata manager or a licensed installer.</div>
      <div className="flex gap-2 mt-3 flex-wrap"><Btn kind="ghost" onClick={() => openExternal("https://www.fire.qld.gov.au/prepare/fire/smoke-alarms")}><ExternalLink size={14} /> QFD smoke alarms</Btn><Btn kind="ghost" onClick={() => openExternal("https://www.qld.gov.au/emergency/safety/fire/smoke-alarms")}><ExternalLink size={14} /> qld.gov.au</Btn></div>
    </Card>
    <Card style={{ padding: 18 }}><SectionTitle>In an emergency</SectionTitle>
      <ul className="space-y-2 text-sm">
        <li>• If there's fire or smoke, get out and stay out — call <b>000</b> from a safe place.</li>
        <li>• Use the stairs, never the lifts. Follow the exit signs to your assembly area.</li>
        <li>• Close doors behind you to slow the spread; don't stop to collect belongings.</li>
        <li>• If you can't get out, stay low, seal door gaps with wet towels and signal from a window.</li>
      </ul>
      <div style={{ color: T.textMuted }} className="text-xs mt-3">The building's full evacuation plan is in Documents.</div>
    </Card>
  </Wrap></div>);
}

// ---------- business directory ----------------------------------------------
function BusinessDirectory() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.businesses.filter((b) => b.buildingId === buildingId);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState("All");
  const [f, setF] = useState({ name: "", category: BUSINESS_CATEGORIES[0], phone: "", contact: "", desc: "" });
  const [note, setNote] = useState("");
  const add = () => { if (!f.name.trim()) return; update((s) => s.businesses.unshift({ id: "biz" + Math.random().toString(36).slice(2, 6), buildingId, ...f, addedBy: user.name, recommendations: [] })); setF({ name: "", category: BUSINESS_CATEGORIES[0], phone: "", contact: "", desc: "" }); setAdding(false); flash("Business added"); };
  const toggleRec = (id, withNote) => update((s) => { const b = s.businesses.find((x) => x.id === id); const mine = b.recommendations.find((r) => r.by === user.name); if (mine) b.recommendations = b.recommendations.filter((r) => r.by !== user.name); else b.recommendations.push({ by: user.name, note: withNote || "" }); });

  if (open) {
    const b = store.businesses.find((x) => x.id === open); if (!b) { setOpen(null); return null; }
    const recommended = b.recommendations.some((r) => r.by === user.name);
    return (<div><Head title="Business" onBack={() => setOpen(null)} backLabel="Directory" /><Wrap>
      <Card style={{ padding: 24 }}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{b.name}</h2><div className="mt-1"><Badge color={T.accent}>{b.category}</Badge></div></div><div className="text-right"><div className="text-lg font-bold" style={{ color: b.recommendations.length ? SEMANTIC.ok : T.textMuted }}>{b.recommendations.length}</div><div style={{ color: T.textMuted }} className="text-[11px]">recommend</div></div></div>
        {b.desc && <p className="text-sm mt-3">{b.desc}</p>}
        <div className="flex flex-wrap gap-2 mt-4">{b.phone && <Btn grad onClick={() => openExternal(`tel:${b.phone.replace(/\s/g, "")}`)}><Phone size={15} /> {b.phone}</Btn>}{b.contact && <Btn kind="soft" onClick={() => openExternal(b.contact.includes("@") ? `mailto:${b.contact}` : `https://${b.contact.replace(/^https?:\/\//, "")}`)}>{b.contact.includes("@") ? <Mail size={15} /> : <ExternalLink size={15} />} {b.contact}</Btn>}</div>
        <div style={{ color: T.textMuted }} className="text-xs mt-3">Added by {b.addedBy}</div>
        <div className="mt-5" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <SectionTitle>Resident recommendations</SectionTitle>
          {b.recommendations.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No recommendations yet — be the first.</p>}
          <div className="space-y-2 mb-3">{b.recommendations.map((r, i) => (<div key={i} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="text-sm font-medium flex items-center gap-1.5"><ThumbsUp size={13} style={{ color: SEMANTIC.ok }} /> {r.by}{r.by === user.name ? " (you)" : ""}</div>{r.note && <p style={{ color: T.textMuted }} className="text-sm mt-1">{r.note}</p>}</div>))}</div>
          {recommended ? <Btn kind="ghost" onClick={() => toggleRec(b.id)}><X size={15} /> Remove my recommendation</Btn> : (<div className="space-y-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" /><Btn grad onClick={() => { toggleRec(b.id, note); setNote(""); }}><ThumbsUp size={15} /> Recommend</Btn></div>)}
        </div>
      </Card>
    </Wrap></div>);
  }
  const cats = ["All", ...Array.from(new Set(list.map((b) => b.category)))];
  const filtered = cat === "All" ? list : list.filter((b) => b.category === cat);
  return (<div><Head title="Business Directory" sub="Trusted local services, recommended by residents" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} /><Wrap>
    {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Business name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{BUSINESS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field><Field label="Email or website"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="name@example.com" /></Field></div>
      <Field label="Note (optional)"><TextArea rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Why you'd recommend them" /></Field>
      <div className="flex gap-2"><Btn grad onClick={add}>Add business</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
    </div></Card>)}
    <div className="flex gap-2 flex-wrap">{cats.map((c) => { const on = cat === c; return <button key={c} onClick={() => setCat(c)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{c}</button>; })}</div>
    {filtered.length === 0 && <Empty icon={Store} title="No businesses yet" hint="Add a trusted local service for your neighbours." />}
    {filtered.map((b) => (<button key={b.id} onClick={() => setOpen(b.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${HUE.directory[0]}, ${HUE.directory[1]})` }}><Store size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold truncate">{b.name}</div><div style={{ color: T.textMuted }} className="text-xs">{b.category}{b.phone ? ` · ${b.phone}` : ""}</div></div><div className="flex items-center gap-1" style={{ color: b.recommendations.length ? SEMANTIC.ok : T.textMuted }}><ThumbsUp size={14} /> <span className="text-sm font-bold">{b.recommendations.length}</span></div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>))}
  </Wrap></div>);
}

// ---------- settings --------------------------------------------------------
function SettingsView() {
  const { T, store, update, building, buildingId, user, flash } = useApp();
  const canEdit = isCommittee(user.role);
  const setB = (k, v) => update((s) => { s.buildings.find((b) => b.id === building.id)[k] = v; });
  const [r, setR] = useState({ name: "", unit: "", email: "", phone: "", role: "owner", msc: false });
  const [rbulk, setRbulk] = useState("");
  const residents = store.users.filter((u) => u.buildingId === buildingId && u.status === "active");
  const importResidents = () => { const rows = rbulk.split("\n").map((l) => l.trim()).filter(Boolean); if (!rows.length) return; update((s) => rows.forEach((l) => { const [name, unit, role, email, phone] = l.split(",").map((x) => (x || "").trim()); if (!name) return; s.users.push({ id: "u" + Math.random().toString(36).slice(2, 8), buildingId, name, unit: unit || "", role: (() => { const x = (role || "").toLowerCase(); return x.startsWith("t") ? "tenant" : (x.startsWith("b") || x.includes("committee")) ? "bcc" : x.startsWith("m") ? "manager" : x.startsWith("s") ? "strata" : "owner"; })(), status: "active", email: email || "", phone: phone || "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: nowISO() }); })); setRbulk(""); flash(`${rows.length} resident(s) imported`); };
  const addResident = () => { if (!r.name.trim()) return; update((s) => s.users.push({ id: "u" + Math.random().toString(36).slice(2, 6), buildingId, name: r.name.trim(), unit: r.unit.trim(), email: r.email.trim(), phone: r.phone.trim(), role: r.role, msc: r.msc, status: "active", directoryOptIn: false, showPhone: false, showEmail: false, lastSeenGallery: nowISO() })); setR({ name: "", unit: "", email: "", phone: "", role: "owner", msc: false }); flash("Person added"); };
  return (
    <div>
      <Head title="Settings" sub={building.name} />
      <Wrap>
        <Card style={{ padding: 18 }}><SectionTitle>Logo</SectionTitle><div className="flex items-center gap-3">{building.logoImage ? <img src={building.logoImage} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl grid place-items-center font-black" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}>{building.logoText}</div>}<label style={{ borderColor: T.border, color: T.text }} className="border rounded-xl px-3 py-2 text-sm cursor-pointer inline-flex items-center gap-2"><Upload size={15} /> Upload image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (d) => update((s) => { s.buildings.find((b) => b.id === building.id).logoImage = d; })); }} /></label>{building.logoImage && <button onClick={() => update((s) => { s.buildings.find((b) => b.id === building.id).logoImage = ""; })} style={{ color: T.textMuted }} className="text-xs underline">Use initials</button>}</div></Card>
        <Card style={{ padding: 18 }}><SectionTitle>Appearance</SectionTitle><ThemeGrid value={building.themeId} onChange={(id) => update((s) => { s.buildings.find((b) => b.id === building.id).themeId = id; })} /></Card>
        <Card style={{ padding: 18 }}><SectionTitle>Building Details</SectionTitle>
          {canEdit ? (<div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Building name"><Input value={building.name} onChange={(e) => setB("name", e.target.value)} /></Field><Field label="Tower / building description"><Input value={building.towerDesc || ""} onChange={(e) => setB("towerDesc", e.target.value)} placeholder="e.g. East Tower / Building 2" /></Field></div>
            <Field label="Type"><Input value={building.type} onChange={(e) => setB("type", e.target.value)} /></Field>
            <Field label="Address"><Input value={building.address} onChange={(e) => setB("address", e.target.value)} /></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Units"><Input type="number" value={building.units} onChange={(e) => setB("units", Number(e.target.value) || 0)} /></Field><Field label="Floors"><Input type="number" value={building.floors} onChange={(e) => setB("floors", Number(e.target.value) || 0)} /></Field><Field label="Towers"><Input type="number" value={building.towers} onChange={(e) => setB("towers", Number(e.target.value) || 0)} /></Field></div>
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Committee (BCC) email"><Input value={building.bccEmail || ""} onChange={(e) => setB("bccEmail", e.target.value)} placeholder="committee@yourbuilding.org" /></Field><Field label="Building manager"><Input value={building.buildingManager || ""} onChange={(e) => setB("buildingManager", e.target.value)} /></Field></div>
          </div>) : (<div className="space-y-1.5 text-sm"><Row label="Name" value={building.name} />{building.towerDesc && <Row label="Tower / building" value={building.towerDesc} />}<Row label="Type" value={building.type} /><Row label="Address" value={building.address || "—"} /><Row label="Units" value={`${building.units} · ${building.floors} floors · ${building.towers} tower(s)`} /><Row label="Committee email" value={building.bccEmail || "—"} /><Row label="Building manager" value={building.buildingManager || "—"} /></div>)}
          {!canEdit && <p style={{ color: T.textMuted }} className="text-xs mt-3 flex items-center gap-1.5"><Lock size={12} /> Only the committee can change building details.</p>}
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle>Strata Management</SectionTitle>
          {canEdit ? (<div className="space-y-3">
            <Field label="Management firm"><Input value={building.strataManager || ""} onChange={(e) => setB("strataManager", e.target.value)} placeholder="e.g. Definitive Strata Co." /></Field>
            <div className="grid sm:grid-cols-3 gap-3"><Field label="Contact name"><Input value={building.strataContactName || ""} onChange={(e) => setB("strataContactName", e.target.value)} /></Field><Field label="Phone"><Input value={building.strataContactPhone || ""} onChange={(e) => setB("strataContactPhone", e.target.value)} /></Field><Field label="Email"><Input value={building.strataContactEmail || ""} onChange={(e) => setB("strataContactEmail", e.target.value)} /></Field></div>
            <p style={{ color: T.textMuted }} className="text-xs">Strata personnel who need to post formal notices can be added as a Strata manager under People &amp; Units above.</p>
          </div>) : (<div className="space-y-1.5 text-sm"><Row label="Firm" value={building.strataManager || "—"} /><Row label="Contact" value={building.strataContactName || "—"} />{building.strataContactPhone && <Row label="Phone" value={building.strataContactPhone} />}{building.strataContactEmail && <Row label="Email" value={building.strataContactEmail} />}</div>)}
        </Card>
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{residents.length} listed</span>}>People &amp; Units</SectionTitle>
          <p style={{ color: T.textMuted }} className="text-sm mb-3">Pre-load names against unit numbers. More than one name per unit is fine.</p>
          <div className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><Field label="Name"><Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field><Field label="Role"><Select value={r.role} onChange={(e) => setR({ ...r, role: e.target.value })}><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="bcc">Committee (BCC)</option><option value="manager">Building manager</option><option value="strata">Strata manager</option></Select></Field></div><div className="grid sm:grid-cols-2 gap-3"><Field label="Unit (blank for strata / manager)"><Input value={r.unit} onChange={(e) => setR({ ...r, unit: e.target.value })} /></Field><Field label="Phone"><Input value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value })} placeholder="04xx xxx xxx" /></Field></div><Field label="Email"><Input value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} /></Field><Toggle label="Also on Maintenance Sub-Committee (MSC)" on={r.msc} onClick={() => setR({ ...r, msc: !r.msc })} small /><Btn grad onClick={addResident}><Plus size={15} /> Add person</Btn>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 4 }}><Field label="Bulk import — name, unit, role, email, phone (one per line)"><TextArea rows={3} value={rbulk} onChange={(e) => setRbulk(e.target.value)} placeholder={"Sandra Pho, 412, owner, sandra@example.com, 0400 555 666"} /></Field><div className="mt-2"><Btn kind="soft" onClick={importResidents}><Upload size={15} /> Import residents</Btn></div></div></div>
        </Card>)}
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>Features for this building</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Turn modules on or off for residents of {building.name}.</p><div className="space-y-2.5">{OPTIONAL_MODULES.concat("whatsapp").map((k) => { const on = building.modules ? building.modules[k] !== false : true; return (<Toggle key={k} label={MODULE_LABELS[k]} on={on} onClick={() => update((s) => { const b = s.buildings.find((x) => x.id === building.id); b.modules = b.modules || {}; b.modules[k] = !on; })} small />); })}</div></Card>)}
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>WhatsApp group</SectionTitle><div className="space-y-3"><Field label="Group name"><Input value={building.whatsappName || ""} onChange={(e) => update((s) => { s.buildings.find((b) => b.id === building.id).whatsappName = e.target.value; })} placeholder="e.g. Salt on Kings Residents" /></Field><Field label="Invite link"><Input value={building.whatsappLink || ""} onChange={(e) => update((s) => { s.buildings.find((b) => b.id === building.id).whatsappLink = e.target.value; })} placeholder="https://chat.whatsapp.com/…" /></Field><p style={{ color: T.textMuted }} className="text-xs">In WhatsApp: open the group → Group info → "Invite to group via link". Paste it here once — residents tap straight through.</p></div></Card>)}
      </Wrap>
    </div>
  );
}
function Row({ label, value }) { const { T } = useApp(); return <div className="flex justify-between gap-4 py-1"><span style={{ color: T.textMuted }}>{label}</span><span className="font-medium text-right">{value}</span></div>; }

// ---------- pending ---------------------------------------------------------
function PendingScreen() {
  const { T, building, user, setBuildingId } = useApp();
  return (<div style={{ background: T.appBg, color: T.text }} className="min-h-screen grid place-items-center px-5"><Card style={{ padding: 32, maxWidth: 380 }}><div className="text-center"><div className="h-14 w-14 rounded-2xl grid place-items-center mx-auto mb-4" style={{ background: hexToRgba(SEMANTIC.warn, 0.15), color: SEMANTIC.warn }}><ClockIcon size={26} /></div><div className="font-semibold text-lg">Access Requested</div><p style={{ color: T.textMuted }} className="text-sm mt-1.5">Your request to join {building.name} as {ROLE_LABEL[user.role]} is with the committee. You'll get an email when it's approved.</p><Btn kind="ghost" onClick={() => setBuildingId(null)} className="mt-5">Back to buildings</Btn></div></Card></div>);
}
