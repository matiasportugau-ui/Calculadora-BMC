# Fix: Google Drive Config 503 Error — Apply Migration to Production

## Problem
The error `drive_config 503: drive_config_unavailable` appears in production because the database migration for Google Drive configuration hasn't been applied to the Cloud Run PostgreSQL database.

**Root cause:** PostgreSQL error `42P01` ("relation does not exist") when the code tries to use `identity.user_drive_config` table that doesn't exist yet.

## Solution
Apply the migration `supabase/migrations/20260624000001_user_drive_config.sql` to the production database.

### Option A: Supabase CLI (Recommended)

**Prerequisites:** Supabase CLI installed and authenticated
```bash
# Install (if needed)
brew install supabase/tap/supabase
# or: npm i -g supabase

# Login to your Supabase account
supabase login

# Link this repo to the Calculadora-BMC project
supabase link --project-ref htnwozvopveibwppyjhg

# Apply all pending migrations to the remote database
supabase db push
```

**Verification:**
```bash
supabase migration list  # Should show 20260624000001_user_drive_config as applied
```

### Option B: Dashboard SQL Editor (Easiest)

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/htnwozvopveibwppyjhg/sql/new
2. Copy the entire contents of `supabase/migrations/20260624000001_user_drive_config.sql`
3. Paste into the SQL editor
4. Click "Run" or press Cmd+Enter

**Note:** The migration uses `IF NOT EXISTS` so it's safe to re-run.

### Option C: Direct psql (If you have DATABASE_URL access)

```bash
export DATABASE_URL="<your-production-database-url>"
psql $DATABASE_URL < supabase/migrations/20260624000001_user_drive_config.sql
```

## Verification

After applying the migration, verify it was successful:

1. **Check table exists:**
   ```bash
   # Via psql (requires DATABASE_URL)
   psql $DATABASE_URL -c "\d identity.user_drive_config"
   
   # Should output:
   # ─────────────────────────────────────────────────────────────────
   #                        Table "identity.user_drive_config"
   # ... columns: user_id, email, folder_id, folder_name, valid, etc.
   ```

2. **Run contract tests against production:**
   ```bash
   npm run test:contracts  # Validates /api/drive/config endpoint against live API
   ```

3. **Test in the UI:**
   - Navigate to https://calculadora-bmc.vercel.app
   - Click the "Google Drive" panel
   - Click "Elegir carpeta" (Choose folder)
   - The 503 error should be gone; you should see the Drive folder picker instead

## What the migration creates

The migration creates:
- `identity.user_drive_config` table — stores each user's configured Drive folder
- Columns: `user_id`, `email`, `folder_id`, `folder_name`, `valid`, timestamps
- Index on `email` for quick lookups
- Row-level security policies (service_role has full access)
- Trigger for auto-updating `updated_at` timestamp

## Quick summary

1. **Local:** `supabase link && supabase db push`
2. **Dashboard:** Paste SQL into https://supabase.com/dashboard/project/htnwozvopveibwppyjhg/sql/new and run
3. **Direct:** `psql $DATABASE_URL < supabase/migrations/20260624000001_user_drive_config.sql`

Once applied, test at https://calculadora-bmc.vercel.app — the Google Drive panel should work.
