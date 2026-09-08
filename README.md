# Attendance & Deductions App

A small internal tool for tracking employee attendance, computing lateness/absence/infraction
cash deductions, and managing everything from a password-protected admin dashboard.

Built with **Next.js (App Router)** + **Prisma** + **PostgreSQL** + **Tailwind CSS**, designed to
deploy on **Vercel**.

Seeded with your real roster (29 staff) pulled from
`LULU_ENTERTAINMENT_ATTENDANCE__25_AUGUST_-_30TH_SEPTEMBER.xlsx`, and default penalty amounts
matching that spreadsheet (Lateness ₦10,000, Absence ₦50,000, Infraction ₦10,000, Major
Infraction ₦50,000). Edit `prisma/seed.ts` or the in-app Settings page to change any of this.

## What's included

- **Employees** — name, role, active/inactive, per-employee working-day schedule.
- **Attendance** — a daily grid to mark each employee Present / Late / Absent / Excused / Off Day.
- **Deductions** — an auto-computed breakdown per employee (counts + cash amounts), filterable by
  date range, plus a form to apply an infraction (with its cash penalty) to any employee on any
  work day.
- **Settings** — edit the cash penalty amount for each deduction type.
- **Admin login** — role-based accounts (Owner/Manager and Assistant per department) stored in the database with secure scrypt password hashing. Protected under `/admin` by middleware.

## 1. Local setup

**Prerequisites:** Node.js 18+, and a Postgres database. The easiest free option is
[Neon](https://neon.tech) or [Vercel Postgres](https://vercel.com/storage/postgres) — both give
you a `DATABASE_URL` in under a minute. (Any Postgres works, including one on your own server.)

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in real values
cp .env.example .env
# Edit .env:
#   DATABASE_URL      -> your Postgres connection string
#   SESSION_SECRET    -> run `openssl rand -base64 32` and paste the result
# (Accounts are stored in the database. Run `npm run accounts` to list or update them.)

# 3. Create the database tables
npx prisma migrate dev --name init

# 4. Load your real employee roster + default penalty amounts
npm run seed

# 5. Run it
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/login`, then into `/admin` once you sign in.

## 2. Push the code to GitHub

Vercel deploys straight from a Git repo, so create one first:

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repository on GitHub (no README/license, so it stays empty), then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

## 3. Set up a production database

If you haven't already, create a Postgres database for production (Neon and Vercel Postgres both
work well and have generous free tiers). Grab its connection string — you'll need it in step 4.

## 4. Deploy to Vercel

1. Go to **vercel.com** → **Add New Project** → import the GitHub repo you just pushed.
2. Vercel auto-detects Next.js — leave the build settings as default.
3. Before the first deploy, open **Environment Variables** and add:
   - `DATABASE_URL` — your production Postgres connection string
   - `SESSION_SECRET` — a long random string (`openssl rand -base64 32`)
4. Click **Deploy**.

Vercel runs `npm install` (which runs `prisma generate` automatically via `postinstall`) and then
`npm run build`. Once it's live, you still need to create the tables in your **production**
database — run this once from your local machine, pointed at the production `DATABASE_URL`:

```bash
DATABASE_URL="<your production connection string>" npx prisma migrate deploy
DATABASE_URL="<your production connection string>" npm run seed
```

(Alternatively, wire this up as a one-off command in Vercel's dashboard under Project → Settings →
Functions, or run it via `vercel env pull` + the commands above locally.)

## 5. Managing Accounts & Passwords

Logins are stored in the database with secure `scrypt` password hashing. To view existing accounts or change usernames and passwords, run:

```bash
# List all accounts and their teams:
npm run accounts

# Change a password:
npm run accounts -- <username> <new-password>

# Change a username:
npm run accounts -- <current-username> - <new-username>

# Change both username and password:
npm run accounts -- <current-username> <new-password> <new-username>
```

## 6. After deploy

- Visit your Vercel URL — you'll land on `/login`.
- Log in with your admin or assistant username and password.
- Go to **Mark Attendance** to start recording days.
- Go to **Deductions** to see the live breakdown and apply infractions.
- Go to **Penalty Settings** any time to change the cash amounts.

## Notes on scope / what to harden before real payroll use

This is a solid working MVP, not a finished payroll system. Before relying on it for actual salary
deductions, consider:

- **Multiple admin accounts** — already implemented with per-department Owner and Assistant roles and scrypt password hashing.
- **Audit trail** — who marked what attendance, and when infractions were applied/edited/removed.
- **CSV/Excel export** of the deductions breakdown, since payroll is likely still run outside
  this app.
- **Automatic OFF_DAY marking** based on each employee's `workingDays`, rather than requiring a
  manual click every day (the field exists in the schema already — just not applied
  automatically yet).
