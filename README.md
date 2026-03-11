# ApplyIQ — AI Career Coach

Your personal job application assistant. Upload CVs, paste job descriptions, and get AI-powered coaching, cover letters, gap analysis, and company research — all in one place.

**Now with Robust Document Processing & OCR support!**

**Stack:** Next.js 14 · Supabase (Postgres) · Gemini 2.5 Flash · Tesseract.js · Sharp


---

## Latest Updates

- **Robust Document Extraction**: Integrated a powerful document processing library that handles native PDFs, scanned images, and Office documents.
- **OCR Support**: Built-in support for Tesseract.js to automatically extract text from image-based CVs (PNG, JPG, JPEG).
- **Image Pre-processing**: Uses Sharp for high-quality image manipulation to improve OCR accuracy.
- **Modular Architecture**: Clean separation of concerns with a dedicated `DocumentExtractor` lib.
- **Improved UX**: Auto-selection of CVs and more lenient readiness checks to get you coaching faster.

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
│   └── api/                 # API Routes (Deep integrated Document Extractor)
├── components/          # React components (SetupPanel, ChatPanel, etc.)
├── lib/
│   ├── extractor/       # Robust Document Extractor (OCR, Parsing, AI)
│   ├── supabase.js      # Supabase client
│   └── gemini.js        # Gemini API + prompts
├── storage/             # Local temp storage for processing
├── logs/                # Application logs
└── supabase-schema.sql  # Database schema
```

---

## Features

| Feature | Details |
|---|---|
| **NEW: OCR Support** | Extracts text from scanned PDFs and Images (PNG/JPG) |
| **NEW: Sharp Processing**| Pre-processes images for better extraction quality |
| Session history | Sidebar with all past applications |
| Multiple CVs | Upload and manage several CVs per session |
| Auto CV suggestion | AI picks the best CV for the job |
| Company research | Auto-triggered via Gemini web search grounding |
| Gap analysis | High-level — meaningful gaps only |
| Cover letter | Tailored to the role and your CV |
| Persistent history | All sessions and chats stored in Supabase |
