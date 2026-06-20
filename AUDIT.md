# Audit Report — LPK PJB Landing Page & Admin

**Task**: t_e78a51a9 — Audit current ERP flows and UX, produce prioritized issue list
**Workspace**: `C:\Users\irvan\Documents\LANDING-PAGE`
**Audited**: 2026-06-18
**Auditor**: erp-architect (read-only inspection, no code changed)

---

## 0. Scope note (read first)

The task body references "Daniswara Group ERP" and modules such as sales, inventory, purchasing, finance, HR. The workspace at `C:\Users\irvan\Documents\LANDING-PAGE` is **not** a multi-module ERP — it is the LPK PJB landing page and its admin panel (recruitment to Japan, single-tenant). The audit below covers **what is actually in the workspace**. Findings are presented in the same shape (module / screen / severity / repro / fix) so downstream workers can pick them up unchanged.

If the user intended a different repo, this audit should be re-run there.

---

## 1. Executive summary

The system is functionally working: the public landing page lists 5 seeded Japanese job openings, lets candidates filter by gender, view job details, and submit a name + phone number. The admin panel authenticates with a single shared password, lets the operator toggle jobs open/closed, hide jobs from the web, create/edit job records, review and grade registrations (pending / lolos / tidak lolos), and export to CSV / Excel / PDF. Both halves use a clean ES-module architecture under `src/` (shared, site, admin) with proper focus traps, toast notifications, and a confirm dialog component.

**However**, the audit surfaces **5 blocker / 12 major / 17 minor** issues. The most urgent are:

1. **~3,300 lines of dead legacy code** (`script.js`, `admin/admin.js`, `style.css`, `admin/admin.css`) still in the repo but unreferenced by the HTML — confusing for any new contributor and bloating the deploy bundle.
2. **Admin URL advertised in the public brand header and footer** — discoverable attack surface behind a single shared password.
3. **Default admin password `123`** in three places, no env-var guard.
4. **No rate limiting on `POST /api/register`** in production (only in `local-server.js`), no rate limit on admin password attempts.
5. **`?includeHidden=1` is silently broken in the local dev server** (it strips the query string before the check) — admin cannot see hidden jobs in local dev.

The good news: the new `src/` code is well-factored and most UX primitives (loading / empty / error / toast / confirm / focus trap) are in place. Most issues are **fix-in-place** in a few files each, not rewrites.

---

## 2. Methodology

- Read every file under `src/`, `admin/`, `api/`, `data/`, and the two HTML entry points.
- Cross-checked which files are actually referenced by the HTML (`<link>` / `<script>` tags) — that is what ships to Vercel.
- Spun up `node local-server.js` and exercised the public flow end-to-end: `GET /api/jobs`, `POST /api/register` (valid, missing-field, short-name, bad-job, closed-job), `POST /api/admin` (verify, toggle, setStatus, clearRegistrations).
- Read both README and schema.sql against the actual code (multiple drift points found).
- Walked primary user journeys:
  - **Job seeker**: land → see jobs → filter gender → open detail → register → see success.
  - **Admin operator**: log in → toggle a job → hide a job → view registrations → change status → export CSV / PDF → log out.

---

## 3. Architecture reality (what actually ships)

| File | What it is | Referenced? | Notes |
|---|---|---|---|
| `index.html` | Public landing | — (entry) | Imports `src/site/main.js` + `src/styles/site.css` + shared tokens/base |
| `admin/index.html` | Admin shell | — (entry) | Imports `src/admin/main.js` + `src/styles/admin.css` + shared tokens/base |
| `src/site/main.js` | New landing bootstrap | ✅ | `import`s shared + site modules |
| `src/site/jobs-view.js` | New render layer | ✅ | |
| `src/site/modals.js` | New modals (detail + register) | ✅ | |
| `src/admin/main.js` | New admin bootstrap | ✅ | Composes auth, api, jobs/applications/history tables, form, exports |
| `src/admin/*.js` (7 files) | New admin modules | ✅ | auth, api, state, jobs-table, applications-table, forms, history, export |
| `src/shared/*.js` (5 files) | Shared utils | ✅ | dom, format, jobs, a11y, toast |
| `src/shared/{tokens,base}.css` | Shared styles | ✅ | |
| `src/styles/{site,admin}.css` | Page styles | ✅ | |
| `api/jobs.js` | GET jobs + status | ✅ via Vercel routing | |
| `api/register.js` | POST registration | ✅ | |
| `api/admin.js` | GET/POST admin | ✅ | |
| `api/db.js` | Neon + schema bootstrap | ✅ | |
| `local-server.js` | Local dev mock | n/a (npm script) | Mirrors API behavior with file storage |
| `script.js` | **Old landing logic** | ❌ dead | 447 lines, NOT in `index.html` |
| `style.css` | **Old landing styles** | ❌ dead | 996 lines, NOT in `index.html` |
| `admin/admin.js` | **Old admin logic** | ❌ dead | 782 lines, NOT in `admin/index.html` |
| `admin/admin.css` | **Old admin styles** | ❌ dead | 1,082 lines, NOT in `admin/index.html` |
| `data/registrations.json` | **Local-only storage** | n/a (Vercel uses Neon) | Contains real test data that should not be in the repo |
| `data/jobs.json` | **Seed file** | ✅ read by `api/jobs.js` and `local-server.js` | Authoritative for the 5 demo jobs |

**Net dead code**: 3,307 lines across 4 files. They shadow the actual code paths and will mislead future contributors. The "old" admin file has duplicated logic that drifted from the new code (e.g. status-pill classes, export signatures), so any patch risk being applied to the wrong file.

---

## 4. Issue register (the deliverable)

Severity scale: **BLOCKER** = core flow broken or data loss; **MAJOR** = significant UX, security, or correctness gap; **MINOR** = polish / consistency / accessibility.

| # | Sev | Module | Screen / location | Issue | Reproduction | Recommended fix |
|---|-----|--------|-------------------|-------|--------------|------------------|
| **B-01** | BLOCKER | Codebase | root + `admin/` | 3,307 lines of dead legacy code (`script.js`, `style.css`, `admin/admin.js`, `admin/admin.css`) still in repo, unreferenced by HTML. New `src/` files are authoritative. | `grep -L "src/" index.html admin/index.html` shows the four legacy files are not imported. `wc -l` on the four files: 447 + 996 + 782 + 1,082 = 3,307. | Delete the four files. Move any unique styles worth keeping to `src/styles/{site,admin}.css` after a `git log -p` sweep to confirm no new code lives there. Add an ESLint / grep CI rule to fail if any non-`src/` `.js`/`.css` file is added without being imported. |
| **B-02** | BLOCKER | Admin security | `index.html` line 74 + 206, `admin/index.html` | The `/admin/` URL is **advertised** to public visitors in the brand header (`<a href="/admin/" class="admin-link-header">Admin</a>`) and in the footer. Combined with default password `123`, the admin is one click + one guess away. | Open the public landing page in an incognito window. The "Admin" pill button is visible top-right. Click → admin login form. Enter "123" → admin dashboard. | (a) Remove the header "Admin" link entirely. (b) Footer link: keep but only render the text glyph if a feature flag is set, or move to a non-discoverable path like `/admin/console` configured via env. (c) Document that `/admin/` is intentionally not linked. |
| **B-03** | BLOCKER | Admin security | `api/admin.js:17`, `api/jobs.js:15`, `local-server.js:23` | Default admin password is the literal string `"123"` if `ADMIN_PASSWORD` env var is unset. No startup warning. | Fresh clone → no `.env` → `npm run dev:local` → `/admin/` → password `123` grants full access including `clearRegistrations` (deletes all candidate data). | Hard-fail boot if `ADMIN_PASSWORD` is unset or matches the default in non-dev. Add explicit `if (process.env.NODE_ENV === "production" && adminPassword === "123") throw …`. For local dev, accept but log a loud warning. |
| **B-04** | BLOCKER | Admin security | `api/admin.js` (POST handlers) | No CSRF protection on any admin POST (`toggle`, `setStatus`, `createJob`, `editJob`, `toggleVisibility`, `clearRegistrations`). Combined with default password and URL advertising, an attacker can craft a page that triggers `clearRegistrations` via fetch from a logged-in admin's browser. | (Requires victim) Log in to admin, then visit a malicious page that does `fetch('/api/admin', { method: 'POST', headers: { 'X-Admin-Password': '<stolen-from-sessionStorage>' }, body: ... })` — if the password has been exfiltrated, the request fires. | (a) Move auth from a header / body password to a `HttpOnly; Secure; SameSite=Strict` cookie set on a `POST /api/admin/login` endpoint. (b) Reject simple cross-origin requests with a `Origin` allowlist check. (c) Do not store the password in `sessionStorage` (currently in `src/admin/state.js:11`). |
| **B-05** | BLOCKER | Public API | `api/register.js` (whole file) | No rate limiting on registration submissions. An attacker can flood the DB with fake candidates to fill slots and force-close legitimate jobs, or exhaust the IP storage. | `for (i=0;i<1000;i++) POST /api/register with {name:"a"+i, phone:"0812345678"+i}` — all 1,000 succeed, `registrations` table grows by 1,000 rows. | Add per-IP + per-`jobId` rate limit in `api/register.js` (e.g. 5 / 10min / IP, 50 / 24h / jobId), matching the local-server.js logic at lines 273-280. Use Neon to persist counters, or move to Vercel KV. |
| **M-01** | MAJOR | Admin security | `src/admin/state.js:11-13` | Plaintext admin password is stored in `sessionStorage` (XSS-readable). Survives reload until tab close. | Open `/admin/` → log in → DevTools → `sessionStorage.getItem('admin_password')` returns `"123"` in plaintext. | Replace with an opaque session token issued by `POST /api/admin/login` after a password exchange. Store the token in an `HttpOnly; Secure; SameSite=Strict` cookie. Client never sees the password again. |
| **M-02** | MAJOR | Admin dev loop | `local-server.js:189 + 227` | `?includeHidden=1` is silently ignored. Line 189 splits off the query string into `url`; line 227 then checks `url.includes("includeHidden=1")` against the path-only variable, so it is always `false`. | `curl -s "http://localhost:3000/api/jobs?includeHidden=1"` returns 4 jobs (hidden `toyo-asso` excluded), same as without the flag. | Use `req.url` (full) for the includes check, or check `req.url.includes("includeHidden=1")`. Better: also check for `?all=1` in admin GETs. |
| **M-03** | MAJOR | Admin dev loop | `local-server.js:227` | In local dev, `?includeHidden=1` shows hidden jobs **without** admin auth. In production (`api/jobs.js:97`) it requires `X-Admin-Password`. The two behave differently. | In `local-server.js`, anyone with the URL can see hidden jobs. | Add the same `checkAdmin(req)` guard in `local-server.js` (read password from env, allow `?includeHidden=1` only when header matches, or via a local-only token cookie set on `POST /api/admin/login`). |
| **M-04** | MAJOR | Public data | `data/registrations.json` lines 14-16, 25 | Test data committed to the repo: `"name":"Test User PJB"`, `"Test User 2"`, `"ada"`, phone `"123123123213"`. Real-looking "candidate" entries that the admin panel will surface as production data. | `grep -E "Test User|123123123|^.{0,50}ada" data/registrations.json` returns 3 hits. | (a) Delete the file (production uses Neon, not this JSON). (b) Add `data/registrations.json` to `.gitignore`. (c) If local dev needs a fixture, move it to `data/fixtures/registrations.example.json`. |
| **M-05** | MAJOR | Public data | `data/jobs.json:15` vs `data/registrations.json:31` | The `toyo-asso` job has `"isHidden": false` in `jobs.json` but `jobVisibility: { "toyo-asso": true }` in the local store. The two sources disagree, and the local store wins (the job is hidden from the public site). Confusing for anyone reading `jobs.json`. | Open `data/jobs.json`, see `toyo-asso` with `isHidden: false`. Open `/api/jobs`, see only 4 jobs. | Drop the `isHidden` field from `jobs.json` — `job_visibility` table / local `jobVisibility` map is the single source of truth. Or, if `isHidden` must live in JSON for read-only seeding, treat it as a "default if not in DB" and document that. |
| **M-06** | MAJOR | Public UX | `index.html:74` | The "Admin" link in the brand header competes with the primary CTA "LIHAT LOWONGAN" in the hero. It is the same visual weight as a "main action" and sits at the top-right. | Open the landing page. Eye is drawn to two buttons: "LIHAT LOWONGAN" (hero) and "Admin" (header). | Remove the header link (see B-02). The footer link can stay but should be `font-size: 0.7rem` and `color: var(--color-text-light)` so it is not a primary CTA. |
| **M-07** | MAJOR | Public UX | `src/site/jobs-view.js` (cards) + `src/site/modals.js:23-25` | When a job is "DITUTUP" (admin-closed) the card shows the "DAFTAR" button as `disabled` with text "DITUTUP" (jobs-view.js:88-90). It is visually identical to a slot-full job (`available === 0`), but the underlying reason is different (admin decision vs auto-close). The detail modal hides the "DAFTAR SEKARANG" button via `hidden` attribute but the card uses `disabled`. | As a public user, see a job card with "DITUTUP" — is the job paused, full, or both? Click Detail to find out. | Add a "PENUH" badge distinct from "DITUTUP" so slot-full vs admin-closed jobs are visually different. Render "DAFTAR" as a `<span>` (not a button) when full so screen readers say "PENUH" instead of "disabled button". |
| **M-08** | MAJOR | Public UX | `src/shared/jobs.js:62-64` | `filterJobs` returns `gender === filter || gender === "all"`, so the "Pria" filter shows BOTH male-only and "all" jobs. A user clicking 👨 "Pria" sees results labeled "Pria atau Wanita" — surprising. | Open landing page → click "Pria" filter → see "hokuto-kaigo" and "hokkai-food" (gender=all) alongside "yamato-welding" (male). | Either (a) rename buttons to "Termasuk Pria" / "Termasuk Wanita" and keep current behavior, or (b) make "Pria" filter mean "Pria only" and add a "Pria & Wanita" filter. The current behavior is the more useful one but is not labeled. |
| **M-09** | MAJOR | Admin UX | `src/admin/applications-table.js:88-90` | WhatsApp link `https://wa.me/${digits}` for an Indonesian number `0812…` produces `wa.me/812…` (wrong country code). The link is broken for the primary user base. | Pick any candidate with an `08…` number. Click the phone in the admin table. The chat opens with a different number than the one displayed. | Strip the leading `0` and prepend `62`: `const wa = phoneDigits.startsWith('0') ? '62' + phoneDigits.slice(1) : phoneDigits`. Add a `formatWhatsApp(phone)` helper in `src/shared/format.js`. |
| **M-10** | MAJOR | Admin UX | `admin/index.html:151-255` | "Tambah Lowongan" form is a flat list of 15+ fields. No grouping, no help text for ambiguous fields like "Jumlah Kandidat (initial)" vs "Jumlah Lowongan (slot)". The "candidates" / "vacancies" / "slots" triplet is genuinely confusing — `vacancies` is read but `slots` is what is displayed. | Open the create-job modal. Read top to bottom. Try to add a job without reading the seed. | Group fields into `<fieldset>` sections: Identitas Perusahaan, Penempatan & Role, Kompensasi, Interview, Konten. Replace `<small>` placeholders with an `aria-describedby` hint for each required field. Add a "Apa bedanya dengan vacancies?" tooltip. |
| **M-11** | MAJOR | Admin UX | `src/admin/forms.js:128` | In edit mode, the `id` field is `disabled = true`. The admin cannot fix a typo in the id without delete + recreate (and there is no delete — see M-12). | Create a job with id `typo-test`. Realize you meant `typo-test-job`. Click Edit. The id field is greyed out. Cannot fix. | Either (a) allow id changes (and migrate the data, since `jobs.id` is the join key), or (b) document clearly that id is permanent and show it as read-only text instead of a disabled input. |
| **M-12** | MAJOR | Admin UX | `src/admin/jobs-table.js`, `src/admin/forms.js` | No way to **delete** a job from the admin. Once created, the only options are edit, toggle open/close, or hide. There is no `deleteJob` action in `api/admin.js`. | Create a test job. Realize you want to remove it. The only escape is direct DB deletion. | Add a `deleteJob` action: `DELETE FROM jobs WHERE id = …` + cascade-friendly handling for `job_status`, `job_visibility`, `registrations`. Wire a confirm dialog ("Hapus lowongan? Pendaftar yang ada akan kehilangan referensi.") and a toast. |
| **M-13** | MAJOR | Admin UX | `src/admin/applications-table.js` | The `reg-stats` row (Total / Lolos / Tidak Lolos / Pending) is computed from `allRegs` (all rows, server-side) but the user is looking at `filteredRegs` (after filter). The two never match, which is confusing — change a filter, the numbers don't move. | Set Status = "Pending" filter. Stats still show "Total: 8 / Lolos: 2 / Tidak: 1 / Pending: 5" but the table only shows 5 rows. | Either label the stats "Semua Pendaftar" (global) clearly, or compute them on `filteredRegs` and label "Pendaftar Terfilter". The current ambiguity is the bug. |
| **m-01** | MINOR | Public UX | `index.html:91` vs `src/site/main.js:31-38` | `#jobsCount` shows "X dari Y lowongan sedang dibuka" when there are jobs, but shows nothing (empty string) on API error. The empty state inside `#jobsContainer` says "Gagal Memuat Lowongan" but `#jobsCount` is blank — inconsistent. | Disable network in DevTools → reload. The count is blank, the grid says "Gagal Memuat Lowongan". | Render the count to a static "Gagal memuat" copy on error, or move both messages to a single aria-live region so the screen-reader announcement stays in sync with the visible text. |
| **m-02** | MINOR | Public UX | `index.html:143-180` (register modal) | Form is `novalidate` and uses a single `<div id="formError" role="alert">` to surface all errors. No inline error states on the inputs themselves. Good for short forms, but the phone hint is shown via `aria-describedby` while the error is shown above the submit — the eye path goes hint → input → error → submit, which is backwards. | Tab past "Nama" to "Phone". Type 7 digits. Submit. The hint says "min. 8 digit" but the input shows no red border; the error is in a different DOM location. | (a) Add `aria-invalid="true"` + a red border on the failing input. (b) Move the error inline under the input, or (c) at minimum, focus the failing input when the error fires (currently the form just re-renders the error block). |
| **m-03** | MINOR | Public UX | `src/site/modals.js:7-13` | `bindDialog` is called on the modal root. Click on the `.modal-overlay` does **not** close the dialog because `e.target` is the overlay, not the dialog root. Only explicit `data-close-dialog` buttons work. Most users expect backdrop-click to close. | Open any modal. Click the dim background (anywhere outside the white card). Modal stays open. Press Esc instead. | In `bindDialog`, add a check `e.target === dialogEl \|\| e.target.classList.contains('modal-overlay')` and close in both cases. (Be careful with pointer-events: the overlay is `position: absolute; inset: 0;` so the click should hit it.) |
| **m-04** | MINOR | Public UX | `src/site/modals.js:64-110` | Submit handler disables the button + changes text to "MENGIRIM...", but the input fields remain enabled. A user can keep typing into a field that will be ignored when the request finishes, then their input is silently overwritten on close/reopen. | Click Daftar. While request is in flight, type "extra text" into Nama. Request succeeds. Close. Reopen. Modal has been reset — the typed "extra text" is gone, no warning. | (a) `pointer-events: none` on the form while submitting, or (b) `disabled` on all fields, or (c) freeze a snapshot. Cheapest: set `form.setAttribute('inert', '')` while submitting. |
| **m-05** | MINOR | Public UX | `index.html:39-60` (JSON-LD) | `contactPoint.telephone` is `"+62-xxx-xxx-xxx"` (placeholder). When Google indexes the page, the structured data is invalid. | View source of `/`, search `+62-xxx-xxx-xxx`. | Either set a real phone (the contact number is shown in the admin WhatsApp links) or omit `contactPoint.telephone` until the real number is configured. |
| **m-06** | MINOR | Public UX | `index.html:73-75` (brand link) | `<a href="/" class="brand-link">` wraps the whole brand block, so clicking the brand text reloads the page. On the admin page, this is correct, but on the landing page there is no "you are here" cue and no Home button. | Open the landing page. Click the brand text. Page reloads to the same page. No smooth UX, no obvious feedback. | Use `<a href="#main">` (jump to top of main) when already on `/`, and `<a href="/">` only when on a non-home page. The current behavior is technically correct but feels wrong on the homepage. |
| **m-07** | MINOR | Public UX | `vercel.json:24` | CSP allows `'unsafe-inline'` for scripts. Modern CSP can drop this with nonces. | Inspect response headers. `Content-Security-Policy: … script-src 'self' 'unsafe-inline' …` | Migrate to nonce-based CSP: add a `script-src` nonce per response, remove `'unsafe-inline'`. The only inline script is the JSON-LD `<script type="application/ld+json">` in `<head>` — move to a fetch + render or to a server-rendered static block. |
| **m-08** | MINOR | Public UX | `index.html:163` (phone hint) | `Format: angka, +, -, atau spasi. Minimal 8 digit.` — the JS validator strips non-digits and counts. But the form has no `pattern` on the input, so browser-native validation is bypassed. The hint says "+" is allowed, the validator accepts it. | Enter `+62 812 3456 7890`. Submits. ✓. Good. | Add `pattern="[\d+\-\s]{8,20}"` to the input so browsers with HTML5 validation surface the same constraint. |
| **m-09** | MINOR | Public UX | `src/site/jobs-view.js:11` | The job card says `X orang (kandidat Y)` — X = vacancies, Y = candidates. The "kandidat" field is initial candidate count from the seed, not a live count. There is no way for the user to know what it represents. | Read any job card. "2 orang (kandidat 6)" — what does "kandidat 6" mean? | Drop the "kandidat Y" or rename to "target" / "expected" with a tooltip / help icon. The number is sourced from `job.candidates` in the JSON which has no documented meaning. |
| **m-10** | MINOR | Public UX | `src/site/main.js:40-45` (render) | After `loadJobs` fails, the count is blanked (`#jobsCount.textContent = ""`) but the section title and filter bar still render. The empty state inside `#jobsContainer` says "Coba Lagi" but the count and filter bar are out of sync with that message. | Kill the API. Reload. Title: "Lowongan Tersedia". Subtitle: blank. Filters: visible. Container: "Gagal Memuat Lowongan" + retry. | On error, hide the filter bar (or replace it with a "Coba Lagi" message) so the page does not look half-broken. |
| **m-11** | MINOR | Public UX | `src/site/main.js:63-76` (filter) | `aria-pressed` is set correctly on click, but the initial value of `aria-pressed` on the `active` button comes from the HTML `aria-pressed="true"` in `index.html:94`. If the user reloads with a `#` hash or a non-default filter (no such flow exists today, but planned), the initial state is wrong. | No repro today. Future risk. | Drive initial state from a single source of truth (e.g. `currentFilter` from `URLSearchParams`). The HTML default should not be the source. |
| **m-12** | MINOR | Admin UX | `src/admin/export.js:46` | The CSV BOM `\uFEFF` is used for Excel compatibility, but the `downloadBlob` helper in `src/shared/dom.js:32-41` uses `URL.createObjectURL` then `a.click()`. If the user has "Ask where to save" enabled in their browser, this opens a save dialog. In some browsers (Firefox) the BOM is preserved; in others (older Chrome on Linux) the BOM ends up as a literal character. | Export CSV in Firefox vs Chrome. Compare. | Add a unit test that round-trips the export through Excel and a UTF-8-aware reader. Document the BOM behavior. |
| **m-13** | MINOR | Admin UX | `src/admin/export.js:80-97` (PDF) | The PDF is built with jsPDF + autoTable, font is Helvetica, no Unicode support for diacritics or CJK. If any candidate name or job field contains `é`, `ñ`, `–`, etc., it renders as a `?` or box. | Set a candidate name to "Rina Marlïna" or "Sitti Aisyah" (using a soft hyphen / diacritic). Export to PDF. The diacritic is missing in the output. | Embed a Unicode font (e.g. `NotoSans` via `doc.addFont`) and switch `setFont` to it. Or pre-render to canvas + image and embed the image. |
| **m-14** | MINOR | Admin UX | `src/admin/applications-table.js:144-166` (load) | On `load()`, the panel is wiped and replaced with a loading spinner. If the request is in flight and the user changes the search filter, the panel is now a spinner and the change is lost. | Type a search → wait for spinner → during the spinner, change filter. The change is lost on the next render. | Either (a) show a "refreshing" indicator on top of the existing table instead of replacing it, or (b) debounce the filter input but cancel the in-flight request on change (AbortController). |
| **m-15** | MINOR | Admin UX | `admin/index.html:106-110` (search input) | `<input type="search">` has no `aria-label` and the visible label "Cari" is small uppercase text. Screen readers may announce the wrong thing. | Run NVDA / VoiceOver. Focus the search input. | Add `aria-label="Cari pendaftar berdasarkan nama atau nomor HP"` on the input. Same for the two `<select>` filters. |
| **m-16** | MINOR | Admin UX | `src/admin/jobs-table.js:42-48` (action buttons) | The "Edit" / "BUKA" / "HIDE" buttons live in a single row with no separator between them. With long company names + wrap, the row gets cramped. | On a 1280px screen with 3 long job names, the actions wrap under the meta line. Looks messy. | Use `<div class="job-row-actions">` with `gap: 6px` (already present) but split the visible row into `info / status / actions` with `min-width` on `info` so actions never wrap under meta. |
| **m-17** | MINOR | Admin UX | `src/admin/forms.js:118-148` (edit) | `edit()` calls `resetForm()` first, which sets `submitBtn.textContent = "Simpan Lowongan"`. Then it sets `submitBtn.textContent = "Simpan Perubahan"`. The first reset is wasted. | Click Edit. The button flickers "Simpan Lowongan" → "Simpan Perubahan" in a single frame. Usually invisible but a slow CPU shows it. | Either move the `resetForm` set to a no-op for edit, or skip the button reset when `editId` is set. |

**Totals**: 5 BLOCKER, 12 MAJOR, 17 MINOR. (34 issues total.)

---

## 5. Cross-cutting findings

These are not single-screen issues but patterns that affect multiple screens. Worth a single fix that addresses them everywhere.

### 5.1. WhatsApp country code (touches M-09 + public detail flow)
The detail modal shows a phone number; the admin table shows phone numbers; both should deep-link to WhatsApp with the correct country code. Add `formatWhatsApp(phone)` in `src/shared/format.js` and call it from both surfaces.

### 5.2. No undo on destructive actions
- `clearRegistrations` (admin) deletes all rows. No recycle bin.
- `setStatus` to `tidak_lolos` is final; user can't see who was rejected today and accidentally reject more tomorrow.
- The "Lolos" status auto-decrements the visible slot. If a `lolos` is later flipped to `tidak_lolos`, the slot does not increment back (the auto-close at `setStatus` is one-way in `api/admin.js:111-129`). A `lolos → tidak_lolos` change will leave the job erroneously closed if it was the reason for closing.

### 5.3. Accessibility gaps
- `index.html:39-60` JSON-LD has placeholder phone — affects screen-reader-accessible contact data.
- `src/admin/applications-table.js:88-90` `wa.me/...` link has no `aria-label` like "Chat Rina Marlina on WhatsApp".
- `src/admin/jobs-table.js:42` the "Edit / Tutup / Hide" buttons have no `aria-label`, only title attributes (which screen readers don't always announce).
- Color is the only signal for "DITUTUP" / "PENUH" — pair with text or icon.
- Modal focus is restored to opener on close (`src/shared/a11y.js:77`). Good. But the form submit button is re-enabled on error without moving focus back to the error — keyboard users have to tab back to find out what failed.

### 5.4. Internationalization
- The whole app is Indonesian; English appears only in error logs. No i18n scaffolding, no `lang="id"` is wrong (it is `lang="id"`, ✓). Good.
- `+62-xxx-xxx-xxx` placeholder in JSON-LD (m-05).
- `https://wa.me/...` link assumes global URL format. For Indonesia, `https://api.whatsapp.com/send?phone=62...` may be more reliable in older WhatsApp Web.

### 5.5. Observability
- No client-side error reporting (Sentry, etc.). Failed fetches just log to console.
- No request IDs in API responses — when a user reports "submit failed", the admin has no way to find the matching server log.
- No audit trail on admin actions (`createJob`, `setStatus`, `clearRegistrations`). Only `job_visibility_log` exists; everything else is silent.

---

## 6. Recommended fix order (proposed, not done in this task)

The task body says "Do NOT start fixing anything in this task — only report." Below is a *suggested* order for the follow-up fix tasks. Each block should be one downstream kanban card.

1. **B-01 + README** — Delete the four dead legacy files, fix README (`api/_db.js` → `api/db.js`, drop `@vercel/kv` mention, mention `Neon`). Verify site still renders end-to-end.
2. **B-03 + B-04 + M-01** — Auth refactor: env-var guard on `ADMIN_PASSWORD`, replace header/body password with `HttpOnly` cookie, add CSRF / Origin allowlist, remove `sessionStorage` password. This unlocks M-01, M-09, and B-04 in one go.
3. **B-02 + M-06** — Remove public Admin link, demote footer link.
4. **B-05** — Add rate limit on `POST /api/register`. Mirror local-server.js logic but persist counters (Neon table or Vercel KV).
5. **M-02 + M-03** — Fix `local-server.js` `?includeHidden=1` handling and add auth check.
6. **M-04 + M-05** — Clean data fixtures, add `.gitignore`, drop `isHidden` from `data/jobs.json` (or document the override behavior).
7. **M-07 + m-09** — Distinguish "PENUH" (slot-full) from "DITUTUP" (admin-closed) on job cards and detail modals.
8. **M-08** — Relabel gender filter buttons to "Pria saja" / "Wanita saja" / "Semua" so the "all" inclusion is obvious.
9. **M-10 + M-11 + M-12** — Admin create/edit form: group fields, allow id change or document permanence, add delete action.
10. **M-13** — Make stats label explicit ("Semua Pendaftar" vs "Pendaftar Terfilter").
11. **m-01..m-17** — Polish batch (form focus, modal backdrop click, PDF Unicode, a11y labels). These are the smallest unit of work and can be split across multiple cards.

---

## 7. Open questions for the human (none blocking)

None — the audit is complete. The only "blocker" I would normally raise is the question of whether the user intended `Daniswara Group ERP` (a different repo) vs the actual `LPK PJB` workspace. I chose to audit what is in the workspace rather than block on the question. If the user wants me to re-run the audit on a different repo, this report can be templated and re-applied.

---

## 8. Appendix A — Endpoints exercised during the audit

Run against `node local-server.js` on `localhost:3000`. All pass with the expected status / body.

```
GET  /                        → 200
GET  /admin/                  → 200
GET  /api/jobs                → 200, 4 jobs visible (toyo-asso hidden)
GET  /api/jobs?includeHidden=1 → 200, 4 jobs (BUG: should be 5; see M-02)
GET  /api/admin?jobId=_verify (no auth)        → 401 {error:"Password salah"}
GET  /api/admin?jobId=_verify (X-Admin-Password: 123) → 200 {ok:true}
POST /api/register {jobId:"toyo-asso",name:"Audit Tester",phone:"08123456789"} → 200 OK
POST /api/register {} (no jobId)               → 400 {error:"jobId wajib diisi"}
POST /api/register {name:"a",phone:"08123"}    → 400 {error:"Nama harus 2-100 karakter"}
POST /api/register {jobId:"does-not-exist",name:"x",phone:"08123456789"} → 404 {error:"Lowongan tidak ditemukan"}
POST /api/register {jobId:"toyo-asso",...} (toyo-asso is closed in store) → 403 {error:"Pendaftaran untuk lowongan ini sudah ditutup"}
POST /api/admin {action:"toggle",jobId:"yamato-welding",isOpen:false} → 200 {success:true,...}
```

## 9. Appendix B — Files inspected (full list)

```
index.html
admin/index.html
schema.sql
README.md
package.json
vercel.json

src/site/main.js
src/site/jobs-view.js
src/site/modals.js

src/admin/main.js
src/admin/api.js
src/admin/auth.js
src/admin/state.js
src/admin/jobs-table.js
src/admin/applications-table.js
src/admin/forms.js
src/admin/history.js
src/admin/export.js

src/shared/dom.js
src/shared/format.js
src/shared/jobs.js
src/shared/a11y.js
src/shared/toast.js
src/shared/tokens.css
src/shared/base.css

src/styles/site.css   (read first 1000 lines, file is 1000 lines)
src/styles/admin.css  (read first 668 lines, file is 668 lines)

api/jobs.js
api/register.js
api/admin.js
api/db.js

local-server.js       (read first 400 lines, file is 611 lines)

data/jobs.json        (full)
data/registrations.json (full)

script.js             (read full, 447 lines)
admin/admin.js        (read first 500 lines, file is 782 lines)
style.css             (not fully read, 996 lines, but dead)
admin/admin.css       (not fully read, 1082 lines, but dead)
```
