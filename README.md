# CheckingBoard - Dispatch Driver Tracker

Dynamic, Excel-inspired fleet dispatch board built with **Vue 3**, **Tailwind CSS** and **Supabase**.
All teams and dispatchers share one Supabase database: accounts, fleet, and the activity audit log.

---

## 🚀 Setup (once)

1. **Database:** in your Supabase project, open **SQL Editor**, paste the whole of
   `supabase_schema.sql` and click **Run**. It is safe on an existing project: it keeps your
   companies, drivers and activity history.
2. **Turn off public sign-up:** Supabase → **Authentication → Sign In / Providers** →
   disable **Allow new users to sign up**. (Accounts are created by managers inside the app.)
3. **Environment variables** on the host where the frontend is deployed (then rebuild / redeploy):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   Both values are in Supabase → **Project Settings → API**. For local development, put the
   same two lines in a `.env` file.
4. **Create your team:** open the app → **Create a Team**. You become the manager.
5. **Bring in the existing fleet** (only if the database already had drivers from before
   team accounts): in the SQL Editor run
   ```sql
   SELECT public.claim_legacy_fleet('your-username');
   ```

Then add staff in **Team & Staff Management** (click your name in the top bar) and give each
person their username and password.

---

## 💻 Local development

```bash
npm install
npm run dev        # http://localhost:5173  (needs the .env above)
npm run build      # production build in dist/
```

Double-clicking `start.bat` also runs the dev server.

## 📱 Phone app & push alerts

CheckingBoard installs on phones as an app (Android: **Install app**; iPhone: Safari → Share →
**Add to Home Screen**). Staff check in and out there; managers see attendance.

Check-in works as soon as `supabase_schema.sql` has been re-run and a manager has set the office on
the Shifts page. **Phone alerts** (push notifications) need a one-time setup:

1. **Keys.** The public key goes in `.env` (and on your host, e.g. Vercel → Settings → Environment
   Variables, then redeploy):
   ```
   VITE_VAPID_PUBLIC_KEY=...
   ```
   The private key goes in `supabase/.env.push` (git-ignored):
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@example.com
   ```
   To make a new pair: `npx web-push generate-vapid-keys`.
2. **Upload the secrets and deploy the function** (Supabase CLI; sign in once with your Supabase
   account, `your-project-ref` is in the project URL):
   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase secrets set --env-file supabase/.env.push
   npx supabase functions deploy send-push
   ```

Without these steps everything else works; only the phone pop-ups are missing.

### ⏰ Shift reminders (check in / check out)

Once phone alerts work, staff can get a reminder 2 minutes before their shift starts and ends.
Managers switch it on or off on the **Attendance** page. It needs one more function and a
one-time schedule:

1. Deploy the function (it is called by the database, not a user, hence `--no-verify-jwt`):
   ```bash
   npx supabase functions deploy shift-reminders --no-verify-jwt
   ```
2. In the Supabase **SQL Editor** (use your project URL):
   ```sql
   SELECT public.setup_shift_reminders('https://your-project-ref.supabase.co');
   ```
   This turns on `pg_cron` and `pg_net`, creates a private secret and calls the function every
   minute. If it says an extension is not available, enable **pg_cron** and **pg_net** under
   Database → Extensions and run it again. To stop it: `SELECT cron.unschedule('cb-shift-reminders');`

## ✅ Tests

The test suite runs against a real Supabase **test** project with `supabase_schema.sql` applied
(each run creates new test logins, so don't point it at production):

```bash
TEST_SUPABASE_URL=https://test-project.supabase.co TEST_SUPABASE_ANON_KEY=... npm test
```

## 🎨 Status & Color Configuration

Status names, codes and colors live in `src/config/statusConfig.js`.

## 🧹 Unused files (safe to delete)

These are no longer used and were replaced by short "UNUSED" stubs:
`server/` (old Express backend; `data.json` there is old test data), `supabase_activities_migration.sql`,
`src/services/storageService.js`, `src/services/excelService.js`,
`src/components/SupabaseConnectModal.vue`, `tests/activity_accountability.test.js`.

See `checkingboard.txt` for the full specification.
