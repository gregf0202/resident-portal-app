# Parking permit tent card and live verify — spec and status

**20 September 2026 · Replaces the black-and-yellow `permit-pdf` layout · Verify endpoint LIVE (v0.35.1)**

## What exists today

- **`permit-pdf` edge function (v8)** already prints two cards top-and-bottom on A4 with a FOLD HERE line, in the old black/yellow "Temporary Parking Permit" template. The tent format is therefore not new; the design is.
- **`permit-verify` edge function (v3, deployed 20 Sep, `verify_jwt=false`)** — public, read-only. `GET /functions/v1/permit-verify?id=<permit uuid>&fmt=json` returns `{permit_no, building, status, valid_from, valid_to, approved, checked}`. Status is one of Current / Not yet started / Expired / Revoked / Not active, computed on Brisbane dates. It never returns unit, vehicle or rego, and it looks up by uuid so permit numbers cannot be enumerated (PP-0001 exists at both Curve and SeaHaven). CORS open. Tested live against Curve PP-0001. Source is kept in `supabase/functions/permit-verify/index.ts`.
- **Why the page is not served by the function:** the Supabase gateway on `*.supabase.co` delivers a `text/html` response as `text/plain` (confirmed in `function_edge_logs`: the function emits `text/plain` even with the header set). So the function serves JSON and the page lives on our own domain.
- **`public/permit.html`** (v0.35.1) — a static page in the Vite `public/` folder, served at `https://portal.nalohub.com/permit.html?id=<uuid>`. It fetches the JSON above and renders the branded card (navy header, permit number in teal serif, status badge, valid dates, approval, checked-at). Live once the v0.35.1 commit is pushed.

**Check after deploy:** open `https://portal.nalohub.com/permit.html?id=3a01a8f0-cb45-4f5a-91fb-70bb639c00f1`. Expect Curve Birtinya, PP-0001, Current, 20–23 Sep 2026 (Expired from 24 Sep). Hard refresh if Netlify serves a cached 404. The QR on the deck card, the tent PDF and the A4 PNG already encode that URL.

## Card layout (design units 900 × 560; scale to mm × 0.1978)

| Element | Position / style |
|---|---|
| Header band | 0,0 → 900×130, navy `#0B1F3A`, top corners radiused |
| "VISITOR PARKING PERMIT" | x 40, baseline 48, 22 pt bold, `#B8C4CE`. Use the application category label |
| **Building name** | x 40, baseline 104, **52 pt bold white** — the prominent line |
| NaloHub logo | white-on-navy mark, 170 × 63 at x 690, y 38, inside the header. NaloHub stays; the building is named in the header |
| **QR** | 160 × 160 at x 700, y 155, navy on white. Encodes `https://portal.nalohub.com/permit.html?id=<permit uuid>` |
| PERMIT No. / number | label baseline 180; number baseline 240, 58 pt bold serif, teal `#1FA6A6` |
| Rule | x 40→660, y 272 |
| UNIT / VEHICLE / REGO / VALID | labels baseline 305 and 410 (20 pt bold grey); values baseline 345 and 450 (34 pt bold navy). VEHICLE and VALID at x 200 |
| **Building photo** | the aerial photo of the building, cropped to the towers, feathered edges fading toward the text, in a 256 × 162 box at x 640, y 352 (`xMidYMid slice`); base sits on the footer baseline. Per building: `buildings.data.heroImage` if present, else omit |
| Footer line | x 40, baseline 522, 20 pt grey: "Approved by the Committee · {approval_date} · Display on dash · Scan to verify" |

## Page geometry (A4 portrait, mm)

Fold at y 148.5 (dashed, "fold here"). Each card 178 × 110.7 centred in its A5 half; top card rotated 180° about (105, 74.25). Footer at y 291: "Fold along the line and stand on the dash or console. Both sides show the same permit."

## Still to do in `permit-pdf`

Replace the black/yellow drawing with this layout (pdf-lib: draw the navy header, embed the white logo PNG and the feathered building photo, draw the QR from a matrix). Keep the existing data flow, auth and filename. Add the `EXPIRED` diagonal watermark for non-current permits and the per-building `permit_layout` toggle (`tent` default, `single`). Reference artwork: `Curve_Parking_Permit_Tent_A4.png`.
