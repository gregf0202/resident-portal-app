// Midnight Harbour — Greg's signature dark palette
export const T = {
  bg: "#0a1422",
  surface: "#101d30",
  surfaceAlt: "#16263d",
  text: "#e8eef7",
  textMuted: "#9fb2c8",
  border: "rgba(255,255,255,0.10)",
  accent: "#38bdf8",
  accent2: "#22d3ee",
  headerFrom: "#0e2a4a",
  headerVia: "#14507e",
  headerTo: "#0a3a63",
};

export const SEM = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171" };

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
