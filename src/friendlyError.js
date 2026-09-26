// One place that turns a thrown error into words a resident can act on.
//
// Every catch in the app used to flash String(e.message || e), which put raw
// database and network text in front of people ("new row violates row-level
// security policy", "TypeError: Failed to fetch", "Edge Function returned a
// non-2xx status code"). This maps the known shapes to plain English with a next
// step, and passes through messages that are already written for people (the
// app's own thrown errors and the plain-English database rules such as the
// walk-through guards). Anything that still looks technical gets a generic,
// honest sentence instead of the raw text.
//
// Pure function, no imports: safe to use in the demo, production and SignIn.

const rules = [
  // Specific, known messages first.
  [/committee act/i, "Only the committee can amend a finding at this building."],
  [/committee verification/i, "Only the committee can close a finding at this building."],
  [/No active BCC members/i, "Your committee isn't set up on NaloHub yet, so this can't go to a committee vote. Nothing was sent. Please contact your committee or building manager directly."],
  [/range lower bound must be less than or equal to range upper bound/i, "The start date needs to be on or before the end date."],
  [/duplicate key|already exists|23505/i, "That's already recorded, so nothing new was added."],
  [/only request this after|security purposes|rate limit|too many requests|429/i, "Just a moment. That was tried a few times in quick succession, so wait about a minute and try again."],
  [/invalid format|validate email/i, "That email address doesn't look quite right. Check it and try again."],
  [/Invalid login credentials/i, "That email and password don't match. Check both and try again."],
  [/JWT expired|jwt|invalid claim|refresh token|not authenticated|401/i, "Your sign-in has timed out. Refresh the page and try again."],
  [/row-level security|permission denied|42501|not permitted|not allowed|forbidden|403/i, "You don't have permission to do that here, so nothing was changed. If you think you should, ask your committee."],
  [/Failed to fetch|NetworkError|Load failed|network|offline|ERR_|timed? ?out|timeout/i, "You seem to be offline, so that didn't go through. Check your connection and try again."],
  [/non-2xx|status code|Internal Server Error|500|502|503|504|Bad Gateway/i, "Something went wrong on our side. Nothing was lost; please try again in a minute."],
  [/payload too large|413|exceeded the maximum|too large|entity too large/i, "That file is too large to upload. Try a smaller copy (under 5 MB)."],
];

// Words that mark a message as written for developers rather than people.
const TECHNICAL = /violates|constraint|relation |column |function |syntax|null value|TypeError|ReferenceError|undefined|is not a function|Unexpected token|JSON|PGRST|SQLSTATE|stack|\bat \w+ \(|uuid|<!DOCTYPE|\{|\}/i;

export function friendlyError(e, fallback) {
  const raw = String((e && (e.message || e.error_description || e.error || e.msg)) || e || "").trim();
  for (const [re, msg] of rules) if (re.test(raw)) return msg;
  if (raw && raw.length <= 160 && !TECHNICAL.test(raw)) return raw;
  return fallback || "That didn't work. Please try again, and if it keeps happening let your committee know.";
}

export function isPermissionError(e) {
  const raw = String((e && (e.message || e.code)) || e || "");
  return /row-level security|permission denied|42501|not permitted|not allowed|forbidden/i.test(raw);
}

export default friendlyError;
