# ApplyIQ — AI Career Coach

Your personal job application assistant. Upload CVs, paste job descriptions, and get AI-powered coaching, cover letters, gap analysis, and company research — all in one place.

**Stack:** Next.js 14 · Supabase (Postgres) · Gemini 2.0 Flash · Vercel

---

## Local Setup

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

### 3. Set up environment variables
```bash
cp .env.local.example .env.local
```
Edit `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key
```

Get your Gemini key free at [aistudio.google.com](https://aistudio.google.com)

### 4. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/applyiq.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework preset: **Next.js** (auto-detected)

### 3. Add environment variables in Vercel
In your Vercel project → **Settings → Environment Variables**, add:
```
NEXT_PUBLIC_SUPABASE_URL      → your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY → your Supabase anon key
GEMINI_API_KEY                → your Gemini API key
```

### 4. Deploy
Click **Deploy**. Done. Vercel handles builds automatically on every push.

---

## Project Structure

```
applyiq/
├── app/
│   ├── layout.js            # Root layout + fonts
│   ├── page.js              # Main app shell
│   ├── globals.css
│   └── api/
│       └── sessions/
│           ├── route.js           # GET list, POST create
│           └── [id]/
│               ├── route.js       # GET, PATCH, DELETE session
│               ├── cvs/
│               │   ├── route.js          # POST upload CV
│               │   └── [cvId]/route.js   # DELETE CV
│               ├── chat/route.js         # POST chat message
│               ├── research/route.js     # POST company research
│               └── suggest-cv/route.js   # POST suggest best CV
│
├── components/
│   ├── Logo.jsx
│   ├── Sidebar.jsx
│   ├── SetupPanel.jsx
│   ├── ChatPanel.jsx
│   └── Markdown.jsx
│
├── lib/
│   ├── supabase.js          # Supabase client
│   ├── gemini.js            # Gemini API + prompts
│   └── api-client.js        # Frontend fetch helpers
│
├── supabase-schema.sql      # Run this in Supabase SQL Editor
└── .env.local.example       # Copy to .env.local
```

---

## Features

| Feature | Details |
|---|---|
| Session history | Sidebar with all past applications, like Claude's chat list |
| Multiple CVs | Upload and manage several CVs per session |
| Auto CV suggestion | AI picks the best CV for the job |
| Company research | Auto-triggered on role confirm via Gemini web search grounding |
| Gap analysis | High-level — meaningful gaps only |
| Cover letter | Tailored to the role and your CV |
| Free chat | Ask anything about the application |
| Persistent history | All sessions and chats stored in Supabase |
