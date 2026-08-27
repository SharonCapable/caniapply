# ApplyIQ — AI Career Coach

Your living career record. Log what you actually do each day — by voice or text — and ApplyIQ
builds the skill ledger and the domain-specific CVs from it, then coaches you through each
application against the evidence you already have.

**Now with accounts, a daily work log, a skill ledger, and self-updating Living CVs.**

**Stack:** Next.js 14 · Supabase (Postgres) · Gemini (model set by `GEMINI_MODEL`) · Tesseract.js · Sharp


---

## Latest Updates

- **Accounts + Row Level Security**: email/password login; every table is scoped to `auth.uid()`,
  enforced in Postgres and in every API route.
- **Work Log**: log daily work by voice (Chrome/Edge) or text, tagged **personal / client / company**.
  Gemini extracts skills, domains and an impact statement from each entry.
- **Skill Ledger**: every skill tracked with first/last use, occurrence count, recency and an
  inferred proficiency you can override. Includes a new-skills-per-month growth chart.
- **Living CVs**: domain-specific CVs generated from the log. Each card shows how many entries
  have landed since it was written, and **↻ Refresh** rewrites it in place from the latest data.
- **Living CV → Apply**: attach a Living CV to an application and the coach, gap analysis and
  auto-suggest all read it exactly like an uploaded CV.
- **Evidence-aware coaching**: the coach also sees your last 90 days of logs, so it separates
  *real* gaps from *packaging* gaps — things you have done but never put on paper.
- **Robust Document Extraction**: Integrated a powerful document processing library that handles native PDFs, scanned images, and Office documents.
- **OCR Support**: Built-in support for Tesseract.js to automatically extract text from image-based CVs (PNG, JPG, JPEG).
- **Image Pre-processing**: Uses Sharp for high-quality image manipulation to improve OCR accuracy.
- **Modular Architecture**: Clean separation of concerns with a dedicated `DocumentExtractor` lib.
- **Improved UX**: Auto-selection of CVs and more lenient readiness checks to get you coaching faster.

---

## Local Setup

**New here? Follow [SETUP.md](SETUP.md)** — a click-by-click walkthrough of the Supabase
project, including how account confirmation emails work and the redirect screen everyone
misses. About 10 minutes. The condensed version follows.

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In your Supabase dashboard, go to **SQL Editor** and paste the contents of `supabase-schema.sql` — then click **Run**
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon / public` key

> **Upgrading an existing project?** `supabase-schema.sql` is idempotent — re-run the whole file.
> Rows created before login existed have `user_id = NULL` and will disappear once RLS is on.
> Set `claim_email` in the **BACKFILL** block near the bottom of the file to your account email
> before running, and they will be assigned to you.

### 3. Set up environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key

# Extractor Config
OCR_PROVIDER=tesseract
AI_PROVIDER=gemini
AI_ENABLED=true
MAX_FILE_SIZE_MB=50
```

### 4. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Update ApplyIQ with robust document extraction and OCR"
git push -u origin master
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo (`SharonCapable/caniapply`)
3. Framework preset: **Next.js** (auto-detected)

### 3. Add environment variables in Vercel
In your Vercel project → **Settings → Environment Variables**, add:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
GEMINI_API_KEY
OCR_PROVIDER=tesseract
AI_PROVIDER=gemini
AI_ENABLED=true
```

### 4. Deploy
Click **Deploy**. Vercel handles builds automatically on every push.

---

## Project Structure

```
applyiq/
├── app/
│   ├── layout.js            # Root layout + fonts
│   ├── page.js              # Main app shell
│   ├── login/               # Email/password sign in + sign up
│   ├── auth/callback/       # Exchanges Supabase email links for a session
│   └── api/                 # API Routes (Deep integrated Document Extractor)
├── middleware.js            # Session refresh + route protection
├── components/          # React components (WorkLogger, SkillDashboard, LivingCVPanel, ...)
├── lib/
│   ├── extractor/       # Robust Document Extractor (OCR, Parsing, AI)
│   ├── supabase.js      # Browser Supabase client (client components only)
│   ├── supabase-server.js # Per-request server client + requireUser / requireOwnedSession
│   ├── skills.js        # Skill normalisation + proficiency inference
│   ├── living-cv.js     # Living CV generation + staleness
│   └── gemini.js        # Gemini API + prompts
├── storage/             # Local temp storage for processing
├── logs/                # Application logs
└── supabase-schema.sql  # Database schema
```

---

## Features

| Feature | Details |
|---|---|
| **NEW: Accounts** | Email/password login, RLS-isolated data per user |
| **NEW: Work Log** | Voice or text, tagged personal / client / company |
| **NEW: Skill Ledger** | Recency, occurrence count, inferred proficiency, growth chart |
| **NEW: Living CVs** | Domain-specific CVs regenerated in place from your logs |
| **NEW: OCR Support** | Extracts text from scanned PDFs and Images (PNG/JPG) |
| **NEW: Sharp Processing**| Pre-processes images for better extraction quality |
| Session history | Sidebar with all past applications |
| Multiple CVs | Upload and manage several CVs per session |
| Auto CV suggestion | AI picks the best CV for the job |
| Company research | Gemini web search grounding; falls back to ungrounded (and says so) when the key has no grounding quota |
| Gap analysis | High-level — meaningful gaps only |
| Cover letter | Tailored to the role and your CV |
| Persistent history | All sessions and chats stored in Supabase |

### Not built yet

**Job finder (phase 2)** — the Apify/LinkedIn scraping digest currently running as a scheduled
Claude task has no home in the app yet. The intended shape: a Jobs tab that pulls fresh listings,
matches each against the Living CVs, and offers "start an application" straight into the Apply flow.

**Server-side voice** — voice input uses the browser's Web Speech API, so it only works in
Chrome/Edge and no audio is ever stored. Moving transcription server-side (Whisper on your own
box) would fix both, and would let you log from a phone.
