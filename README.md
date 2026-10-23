<div align="center">

# Examen de Español

**A complete Spanish proficiency exam platform for language schools and independent exam centres.**

Candidates receive personal exam assignments, complete a four-skill assessment in a calm, distraction-free interface, and receive transparent results and verifiable certificates. Administrators manage content, scheduling, grading and publication from a dedicated console.

[Live site](https://erdalbirinci.github.io/examen-espanol/) · [Admin console](https://erdalbirinci.github.io/examen-espanol/adminpanel) · [Supabase schema](supabase/schema.sql)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Auth-3ECF8E?logo=supabase&logoColor=white)

</div>

## Overview

Examen de Español is a static React single-page application backed by Supabase. It is designed for a real assessment workflow rather than a demo quiz: candidates only see exams assigned to their email address, every submission is validated on the server, correct answers never reach the browser, and results stay hidden until an administrator publishes them.

The candidate experience is in Spanish. The administration console is in Turkish, matching the workflow of the exam centre that operates it.

### At a glance

- Six CEFR levels: **A1, A2, B1, B2, C1 and C2**.
- Four independently scored skills: **vocabulary and grammar, listening, writing and speaking**.
- Assignment-based access with per-exam duration, due date and result visibility.
- Server-side submission, duplicate-submission protection and automatic scoring.
- Resumable exams through a server-side draft.
- Result lookup by reference code and email.
- Verifiable certificates for published results of **60/100 or higher**.
- Responsive, premium UI with optional WebGL backgrounds and reduced-motion support.

## Screenshots

All screenshots below are from the live GitHub Pages deployment.

![Candidate landing page](docs/screenshots/landing-desktop.png)

*The candidate landing page: exam overview, 3D certificate medallion and the candidate sign-in panel.*

| Mobile candidate landing | Mobile result lookup |
| :---: | :---: |
| <img src="docs/screenshots/landing-mobile.png" width="330" alt="Mobile candidate landing page"> | <img src="docs/screenshots/result-lookup-mobile.png" width="330" alt="Mobile result lookup page"> |

![Administrator sign-in](docs/screenshots/admin-login.png)

*The administrator sign-in screen. Administrators manage assignments, content, grading and certificates from the console.*

## Features

### Candidate experience

- **Invitation-gated accounts.** Registration is only available to an email address that already has an exam assignment or a previous submission.
- **Personal dashboard.** Candidates see only their own assignments, with level, note, due date and current status.
- **Flexible section order.** Candidates can move between the four sections freely; answers are preserved per section.
- **Autosave and resume.** A server-side draft is written while the exam is in progress. The same browser resumes automatically; another device can continue with the draft code and email.
- **Visible timer.** The remaining time comes from the server-side start timestamp. The last five minutes turn amber and the last minute turns red.
- **Automatic submission.** When time runs out, the current exam is submitted instead of being lost.
- **Pre-submit review.** A summary shows which sections are complete and which are still missing before final submission.
- **Result lookup.** A reference code and email are enough to retrieve the candidate's own result summary.
- **Certificates.** Eligible candidates can download a PDF or PNG certificate and share a public verification link.

### Exam integrity

- Correct answers are stored in the private `questions` table. Candidates read only the `questions_public` view, which excludes `correct_index` and explanations.
- Submission goes through the `submit_attempt` database function, not a direct table insert.
- The server validates the assignment ID, candidate email, level, due date, answer shapes and file paths before accepting a submission.
- One assignment can produce only one attempt (`attempts.assignment_id` is unique).
- A two-minute rate limit prevents accidental duplicate submissions from the same email.
- Test scoring runs in Postgres. Manual listening, writing and speaking scores are entered by an administrator and the weighted total is calculated server-side.
- Result fields are hidden by server functions until the assignment's results are published.

### Administration

The admin console covers the complete exam lifecycle:

| Section | What it does |
| --- | --- |
| **Overview** | Exam volume, monthly activity, pending grading, average test score, level distribution, content completeness matrix and JSON backup |
| **Candidate exams** | Create and delete assignments with email, level, title, note, due date, duration and result visibility |
| **Exam results** | Review answers, listening transcripts, writing samples and speaking recordings; assign section scores; publish results; trigger result emails |
| **Test questions** | Level-scoped multiple-choice CRUD with four options, correct answer and ordering |
| **Listening** | Upload audio (up to 50 MB), title, play limit, ordering and grading transcript |
| **Writing** | One prompt per level with a minimum word count |
| **Speaking** | One prompt per level with preparation and speaking times |

Admin routes require a Supabase session whose profile has `role = 'admin'`. All data access is additionally protected by row-level security.

### Content import and export

**Test questions → Bulk import** accepts CSV or JSON, either as an uploaded file or pasted text. A preview lists valid, invalid and already-existing questions before anything is written. Only valid rows are inserted and duplicate prompt text is skipped.

**Download CSV** exports all questions for the selected level in the same column layout, encoded as UTF-8 with a BOM for Excel compatibility. The file can be edited and re-imported; existing prompts are skipped.

CSV header:

```csv
prompt,option_a,option_b,option_c,option_d,correct,explanation,position
"¿Cómo ___?",te llamas,te llama,se llamas,llamas,A,,1
```

JSON format:

```json
[
  {
    "prompt": "¿Cómo ___?",
    "options": ["te llamas", "te llama", "se llamas", "llamas"],
    "correct": "A",
    "explanation": "Saludo básico",
    "position": 1
  }
]
```

`correct` accepts a letter from A to F or a number from 1 to 6. In JSON, `correct_index` is zero-based. If `position` is omitted, the question is appended after the existing questions. At least two options are required, and rows with empty options are rejected.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, React Router 7, Tailwind CSS 4, lucide-react |
| 3D and motion | Three.js, lazy-loaded WebGL scenes, CSS animations, `prefers-reduced-motion` support |
| Hosting | GitHub Pages, built by GitHub Actions, static SPA with a `404.html` fallback |
| Database and auth | Supabase Postgres with row-level security, Supabase Auth |
| File storage | Supabase Storage: public `exam-media` audio, private `exam-recordings` recordings |
| Scoring | Postgres functions and triggers (`submit_attempt`, `score_attempt`, `issue_certificate`, `get_certificate`) |
| Optional email | Supabase Edge Function `notify-result` using Resend |

### Data flow

1. An administrator creates listening, writing and speaking content, then assigns an exam to a candidate email.
2. The candidate registers or signs in, opens the assigned exam and receives a server-backed draft.
3. Answers are saved to the draft while the timer runs from the server's `started_at` timestamp.
4. Final submission validates the assignment and writes a locked attempt. Multiple-choice answers are scored immediately; the other three sections wait for manual grading.
5. The administrator reviews the attempt, enters section scores and publishes the result when ready.
6. The candidate can look up the result and, if eligible, generate a certificate with a public verification code.

## Exam structure and scoring

| Section | Candidate task | Weight |
| --- | --- | --- |
| **Vocabulario y Gramática** | Multiple-choice questions for the assigned level | 40% |
| **Comprensión Auditiva** | Listen up to the allowed number of plays and transcribe what was heard | 20% |
| **Expresión Escrita** | Write a composition on the assigned prompt | 20% |
| **Expresión oral** | Record an answer or upload an audio file | 20% |

The total is calculated on a 100-point scale and rounded. The test portion is scored automatically; the other three sections are scored by an administrator from 0 to 100.

### Timing

Each assignment can define its own duration. If no duration is provided, the level default from `exam_settings` applies (45–90 minutes in the sample configuration). The timer is anchored to the server-side draft start, so refreshing the page or switching devices does not reset it.

### Certificates

A certificate is issued only when all of the following are true:

- the attempt has been graded;
- the result is published to the candidate;
- the total score is at least **60/100**.

The certificate code is random and does not expose the candidate's email. `/certificado/<code>` is a public verification page that returns only the certificate fields through the `get_certificate` function. Certificates can be downloaded as PDF or PNG, copied as a link, or shared to LinkedIn, X, WhatsApp and Facebook.

## Getting started

### Prerequisites

- **Node.js 22 LTS** and npm
- A [Supabase](https://supabase.com) project
- A GitHub repository with Pages enabled (for deployment)

### 1. Clone and install

```bash
git clone https://github.com/ErdalBirinci/examen-espanol.git
cd examen-espanol
npm install
```

### 2. Configure the frontend

```bash
cp .env.example .env
```

Set the public Supabase values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The anon key is designed to be public and is constrained by RLS. **Never put a `service_role` key in the frontend, `.env` or this repository.**

### 3. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the complete contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Apply the migrations in filename order:
   - [`20261023_exam_integrity.sql`](supabase/migrations/20261023_exam_integrity.sql)
   - [`20261024_result_lookup.sql`](supabase/migrations/20261024_result_lookup.sql)
   - [`20261025_exam_drafts.sql`](supabase/migrations/20261025_exam_drafts.sql)
   - [`20261026_result_email.sql`](supabase/migrations/20261026_result_email.sql)
   - [`20261027_membership.sql`](supabase/migrations/20261027_membership.sql)
   - [`20261028_assignment_settings.sql`](supabase/migrations/20261028_assignment_settings.sql)
   - [`20261029_certificates.sql`](supabase/migrations/20261029_certificates.sql)

   The migrations are idempotent and safe to run again.
4. Create the administrator account in **Authentication → Users → Add user**:
   - Email: `<username>@examen.local` (for example `yonetici@examen.local`)
   - Password: a strong password of your choice
   - Enable **Auto Confirm User**
5. Uncomment the `insert into public.profiles ...` block at the end of `schema.sql`, replace the email, and run it. This links the auth user to the `admin` role. Example:

   ```sql
   insert into public.profiles (id, username, display_name, role)
   select id, 'yonetici', 'Yönetici', 'admin'
   from auth.users
   where email = 'yonetici@examen.local'
   on conflict (id) do update
     set username = excluded.username, role = 'admin';
   ```

6. Optional: run [`supabase/seed.sql`](supabase/seed.sql) to insert 10 sample questions and one writing/speaking prompt per level. Listening audio still needs to be uploaded from the admin console.
7. Copy **Project URL** and the **anon public** key from **Project Settings → API** into `.env`.

> The admin login maps the username to `<username>@examen.local`. The password is never stored in the repository.

### 4. Run locally

```bash
npm run dev
```

Open `http://localhost:5173`.

### Frontend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon/publishable key used by the browser client |
| `VITE_BASE_PATH` | Deployment only | Vite base path; set automatically to `/<repository>/` by the Pages workflow |

Local development uses `/` as the base path. The production workflow sets `VITE_BASE_PATH` so assets resolve under the repository subpath.

## Deployment

The app is deployed as a static site to GitHub Pages.

1. Push the repository to GitHub with `main` as the default branch.
2. Open **Settings → Secrets and variables → Actions → Variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
4. Push to `main`, or run `.github/workflows/deploy.yml` manually with **Run workflow**.

The workflow:

- installs dependencies with `npm ci`;
- builds with Node 22 and the repository's base path;
- runs `scripts/postbuild.mjs`, which copies `dist/index.html` to `dist/404.html` and writes `.nojekyll`;
- uploads the artifact and deploys it with `actions/deploy-pages`.

The `404.html` fallback is required because GitHub Pages has no server-side rewrites. It lets deep links such as `/adminpanel`, `/examen/<id>` and `/certificado/<code>` boot the SPA at the requested URL.

| Environment | URL |
| --- | --- |
| Candidate app | `https://<user>.github.io/<repository>/` |
| Admin console | `https://<user>.github.io/<repository>/adminpanel` |
| Result lookup | `https://<user>.github.io/<repository>/resultado` |

## Authentication and security

- Candidate accounts use Supabase Auth email/password. Registration is restricted by `check_candidate_email`, which checks for an existing assignment or previous attempt.
- Admin authentication uses a username converted to `<username>@examen.local`. Access is checked against `profiles.role = 'admin'` in the UI and, more importantly, by RLS policies in the database.
- The candidate role has no access to correct answers, other candidates' attempts or admin-only tables.
- Public certificate verification returns only the certificate holder's name, level, score and dates; it never returns an email address or answers.
- Listening audio is public so candidates can play it. Speaking recordings are private and are opened by administrators through signed URLs.
- All storage and table policies live in `supabase/schema.sql` and the migrations.

### Production checklist

- [ ] Run `schema.sql` and every migration against the production project.
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions repository variables.
- [ ] Set the Supabase Auth **Site URL** to the GitHub Pages URL.
- [ ] Add the password-reset redirect URLs:
  - `https://<user>.github.io/<repository>/cuenta/restablecer`
  - `http://localhost:5173/**` for development
- [ ] Configure a custom SMTP provider before enabling email confirmation or password reset at scale. Supabase's built-in email sender is rate-limited.
- [ ] Verify the live deployment after the first push.
- [ ] Keep the admin password and every `service_role` key out of the repository.

## Password recovery

- `/cuenta/recuperar` requests a reset email.
- The email link lands on `/cuenta/restablecer`, where the candidate sets a new password.
- If Supabase falls back to the Site URL instead of the configured redirect, the app moves the recovery hash to `/cuenta/restablecer` before the session is lost.

## Optional result emails

The `supabase/functions/notify-result` Edge Function sends a result summary through Resend when an administrator saves the final grading. It requires these function secrets:

- `RESEND_API_KEY`
- `RESULT_FROM_EMAIL` — a verified sender address
- `APP_PUBLIC_URL` — the public candidate URL

If the secrets are missing, grading still works. The admin console shows a configuration notice and skips the email. `attempts.result_notified_at` prevents the same result from being sent twice.

## Project structure

```text
.
├── .github/workflows/deploy.yml   # GitHub Pages build and deployment
├── docs/screenshots/              # README screenshots
├── scripts/postbuild.mjs          # 404.html + .nojekyll for Pages
├── src/
│   ├── admin/                     # Admin login, layout, grading, content and assignments
│   ├── components/                # Shared UI, header, footer, 3D scenes, tilt cards
│   ├── exam/                      # Candidate landing, portal, exam shell and four steps
│   ├── lib/                       # Supabase client, typed API layer, scoring helpers
│   ├── App.tsx                    # Routes
│   ├── index.css                  # Tailwind theme, glass surfaces and motion
│   └── main.tsx
├── supabase/
│   ├── schema.sql                 # Tables, views, RLS, storage buckets, scoring
│   ├── seed.sql                   # Optional sample content
│   ├── migrations/                # Incremental schema and RPC changes
│   └── functions/notify-result/   # Optional Resend result email
├── index.html
├── vite.config.ts
└── package.json
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Candidate landing page and sign-in/register panel |
| `/cuenta` | Candidate dashboard with assigned exams |
| `/cuenta/recuperar` | Request a password reset |
| `/cuenta/restablecer` | Set a new password |
| `/examen/:assignmentId` | The four-section exam |
| `/resultado` | Result lookup by reference code and email |
| `/certificado/:code` | Public certificate verification |
| `/adminpanel` | Admin sign-in |
| `/adminpanel/panel` | Admin overview |
| `/adminpanel/atamalar` | Candidate exam assignments |
| `/adminpanel/sonuclar` | Exam results and grading |
| `/adminpanel/test` | Multiple-choice questions |
| `/adminpanel/dinleme` | Listening content |
| `/adminpanel/yazma` | Writing prompts |
| `/adminpanel/konusma` | Speaking prompts |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check, build for production and create Pages fallback files |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |

## Operational notes and limitations

- **Listening play limits are counted on the client.** Audio can still be downloaded directly from its public URL, so `max_plays` is a strong nudge rather than a hard security boundary.
- **Speaking uploads are capped at 50 MB** in both the UI and the storage bucket policy.
- **Anonymous writes to `attempts` are disabled.** New attempts are only created by the server-side submission function.
- **The JSON backup is read-only.** The overview page can export all tables, but automatic restore is not implemented.
- **Results are paginated server-side** at 25 rows per page; name/email search runs in the database.
- **Email confirmation should be configured deliberately.** The sample workflow assumes it is disabled; if you enable it, set up your own SMTP provider and test the full registration and password-reset flow.
- **Free-tier Supabase limits apply** (1 GB storage and 500 MB database at the time of writing). Review the current plan before a large exam session.
- **The 3D scenes are progressive enhancement.** A CSS medallion remains visible if WebGL is unavailable, and the scenes respect reduced-motion and lower-end mobile devices.

## License

No license file is included in this repository. Add one before distributing the project outside its current ownership.
