# Setting up ApplyIQ

About 10 minutes. You need two accounts: Supabase (database + login) and Google AI Studio (Gemini).

You do **not** need to build or host an email system. Supabase sends the confirmation
emails. Step 4 is where you decide whether you want them at all.

---

## 1. Create the Supabase project — 2 min

[supabase.com](https://supabase.com) → **New project**.

- **Name:** anything
- **Database password:** let it generate one, save it in your password manager.
  You won't need it for this app, but you can't recover it later.
- **Region:** pick the region **your app runs in, not the one you sit in**. The API routes
  execute on Vercel's servers, not in Accra, so the hop that matters is Vercel → Supabase.
  Vercel's free tier defaults to `iad1` (Washington DC), so `East US` is the match. If you
  set Vercel's function region to London or Frankfurt, pick the matching Supabase region.

Wait ~2 minutes while it provisions.

---

## 2. Create the tables — 1 min

**SQL Editor** (left sidebar) → **New query** → paste the entire contents of
[`supabase-schema.sql`](supabase-schema.sql) → **Run**.

You should see `Success. No rows returned.` That one file creates every table, index,
trigger and security policy. It's safe to re-run any time you pull schema changes.

> If you had data in this project from before login existed, set `claim_email` near the
> bottom of that file to your email address *before* running it. Otherwise those old rows
> become invisible the moment row-level security switches on.

---

## 3. Copy your keys — 1 min

**Project Settings → API**. You need two values:

| Dashboard label | Goes in `.env.local` as |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Ignore the `service_role` key. This app never uses it, and it bypasses all security —
it should never end up in a `NEXT_PUBLIC_` variable or in the browser.

```bash
cp .env.example .env.local
```

Then paste both values in. The `anon` key is safe to expose publicly; row-level security
is what actually protects the data, and it's already switched on by step 2.

---

## 4. Decide how accounts get created — 2 min

**This is the step worth thinking about.** Everything else is copy-paste.

Go to **Authentication → Sign In / Providers → Email**.

### Option A — confirmation off (recommended to start)

Turn **Confirm email** *off*. People sign up and are immediately logged in. No emails
are sent at all, so nothing can rate-limit or land in spam.

Use this while it's you and a handful of testers. The signup page already handles it —
it detects that a session came back and drops you straight into the app.

### Option B — confirmation on

Leave **Confirm email** *on*. Supabase emails a link; clicking it lands on
`/auth/callback`, which signs the person in and redirects them into the app.

If you pick this, you **must** also set the URLs in the next step, or the links break.

> **The catch:** Supabase's built-in email sender is shared infrastructure, throttled to a
> handful of messages per hour, and their docs are explicit that it is not for production.
> It's fine for testing. The moment real users sign up, go to **Project Settings → Auth →
> SMTP Settings** and connect your own sender — [Resend](https://resend.com) has a free
> tier that covers thousands a month and takes about five minutes to wire up.

---

## 5. Set the redirect URLs — 1 min

**Authentication → URL Configuration.** This is the screen everyone forgets, and skipping
it is why confirmation links usually appear "broken".

- **Site URL:** `http://localhost:3000` while developing. Change it to your real domain
  when you deploy.
- **Redirect URLs:** add both, one per line:

```
http://localhost:3000/auth/callback
https://your-app.vercel.app/auth/callback
```

Supabase refuses to redirect anywhere not on that list, so an unlisted URL silently fails.
Add the production one now even if you haven't deployed yet.

You can skip this entire step if you chose Option A — no emails, no links, no redirects.

---

## 6. Gemini key — 1 min

[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**.
Paste it into `.env.local` as `GEMINI_API_KEY`. Free tier is fine for personal use.

> **If logging an entry saves but extracts no skills**, Google has retired the model id.
> The error names its replacement — put it in `.env.local` as `GEMINI_MODEL=...` and
> restart. No code change. Existing entries have a **↻ Retry extraction** button.

> **Company research needs a paid key.** It uses Google Search grounding, which is
> metered separately from normal generation and is not included on the free tier. Without
> it the briefing still generates, but from the model's training data — it says so at the
> top of the output. Everything else in the app works fine on the free tier.

---

## 7. Run it

```bash
npm install
npm run dev
```

[localhost:3000](http://localhost:3000) → you'll be redirected to `/login` → **Sign up**.

Then, to confirm it all works end to end:

1. **Log** tab → write a sentence about something you did today → **Log & Extract Skills**.
   You should see extracted skills appear within a few seconds. If this works, your
   database, auth and Gemini key are all correct.
2. **Growth → Skills** → those skills should be listed.
3. **Growth → Living CVs** → **Generate CV** → pick *General* → you get a full CV.

---

## When you deploy

In Vercel → **Settings → Environment Variables**, add the same three values from
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).

Then go back to Supabase → **Authentication → URL Configuration** and change **Site URL**
to your real domain. If you forget, confirmation emails will keep pointing at localhost.

---

## Things that will bite you

**Free-tier projects pause after about a week of no activity.** You'll get an email, and
the dashboard has a **Restore** button that takes a minute. No data is lost. If you use
this daily it'll never happen; if you leave it for a fortnight, expect it.

**"Invalid API key"** — you copied `service_role` instead of `anon`, or there's a trailing
newline in `.env.local`. Restart `npm run dev` after any env change; Next.js only reads
those at startup.

**Signed up but the app is empty** — that's usually correct. Every table is scoped to your
user id, so a new account starts genuinely blank. Log one work entry and it fills in.

**Confirmation email never arrives** — check spam first, then the built-in sender's hourly
limit. If you're just testing, switch to Option A rather than fighting it.
