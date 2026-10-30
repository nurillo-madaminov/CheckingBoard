-- ==============================================================================
-- CHECKINGBOARD - SUPABASE DATABASE SETUP (single shared team database)
-- ==============================================================================
-- Run this whole script in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- * Safe on a fresh project AND on a project that already ran the older
--   CheckingBoard scripts: it never deletes or re-seeds companies, drivers or
--   activities. Existing fleet rows are kept and marked as the unclaimed
--   legacy team ('team-1') until a manager claims them (see step 9).
-- * Safe to run more than once.
--
-- Accounts:
--   Logins are real Supabase Auth users (bcrypt-hashed passwords). They are
--   created only through the functions below, so in Authentication -> Sign In /
--   Providers you should turn OFF "Allow new users to sign up".
--   A username "nick" signs in as the internal address nick@checkingboard.internal
--   (never emailed; the app does this mapping for you).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 1. TABLES (created if missing, upgraded in place if they already exist)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_sign_reset_date DATE,                 -- US Eastern date of the last daily NO SIGN reset
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS last_sign_reset_date DATE;

CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id TEXT PRIMARY KEY,                       -- = auth.users.id (as text)
    team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'manager')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
-- Work shift the manager assigned this person to (see save_shift_schedule)
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS shift_code TEXT
    CHECK (shift_code IN ('MORNING', 'AFTERNOON', 'NIGHT'));
-- Old scripts stored plain-text demo passwords here; passwords now live (hashed) in Supabase Auth.
ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS password_hash;

CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL DEFAULT 'team-1',
    name TEXT NOT NULL,
    note TEXT DEFAULT '',
    order_index INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS team_id TEXT NOT NULL DEFAULT 'team-1';

CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL DEFAULT 'team-1',
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    unit TEXT DEFAULT '',
    name TEXT NOT NULL,
    sign TEXT DEFAULT 'SIGNED',
    status TEXT DEFAULT 'READY',
    notes TEXT DEFAULT '',
    highlight_color TEXT DEFAULT '',
    order_index INTEGER DEFAULT 1,
    last_checked_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS team_id TEXT NOT NULL DEFAULT 'team-1';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.activities (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL DEFAULT 'team-1',
    staff_user_id TEXT REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    staff_name_snapshot TEXT NOT NULL DEFAULT 'Unknown Historical Actor',
    driver_id TEXT REFERENCES public.drivers(id) ON DELETE SET NULL,
    driver_name_snapshot TEXT NOT NULL DEFAULT '',
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name_snapshot TEXT NOT NULL DEFAULT '',
    action_type TEXT NOT NULL,
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extra_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS team_id TEXT NOT NULL DEFAULT 'team-1';
-- Which shift recorded the action, and the work day that shift belongs to (stamped by the trigger)
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS shift_code TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS shift_date DATE;

-- Activity history must survive driver / company / staff deletion: FKs are ON DELETE SET NULL
DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT * FROM (VALUES
            ('activities_driver_id_fkey', 'driver_id', 'public.drivers'),
            ('activities_company_id_fkey', 'company_id', 'public.companies'),
            ('activities_staff_user_id_fkey', 'staff_user_id', 'public.staff_profiles')
        ) AS t(conname, col, ref)
    LOOP
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.conname AND confdeltype <> 'n') THEN
            EXECUTE format('ALTER TABLE public.activities DROP CONSTRAINT %I', fk.conname);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.conname) THEN
            EXECUTE format('ALTER TABLE public.activities ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE SET NULL',
                           fk.conname, fk.col, fk.ref);
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS companies_team_id_idx ON public.companies (team_id);
CREATE INDEX IF NOT EXISTS drivers_team_id_idx ON public.drivers (team_id);
CREATE INDEX IF NOT EXISTS activities_team_id_idx ON public.activities (team_id, action_at DESC);
CREATE INDEX IF NOT EXISTS activities_shift_date_idx ON public.activities (team_id, shift_date, shift_code);
CREATE INDEX IF NOT EXISTS staff_profiles_team_id_idx ON public.staff_profiles (team_id);

-- The legacy team that holds fleet data created before team accounts existed
INSERT INTO public.teams (id, name) VALUES ('team-1', 'Legacy fleet (unclaimed)')
ON CONFLICT (id) DO NOTHING;

-- Old demo profiles (Manager Sarah / Staff John / Staff Alice) have no Auth login.
-- Keep them for history (activity snapshots) but mark them inactive.
UPDATE public.staff_profiles p
SET is_active = false
WHERE p.is_active
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = p.id);

-- ------------------------------------------------------------------------------
-- 2. SESSION HELPERS (who is signed in, which team, are they a manager)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT team_id FROM public.staff_profiles
    WHERE id = auth.uid()::text AND is_active
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid()::text AND is_active AND role = 'manager'
    )
$$;

-- The signed-in member's current shift (activity visibility, shift-wide notifications)
CREATE OR REPLACE FUNCTION public.current_shift_code()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT shift_code FROM public.staff_profiles
    WHERE id = auth.uid()::text AND is_active
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
    SELECT lower(trim(p_username)) || '@checkingboard.internal'
$$;

-- New rows default to the signed-in user's team (existing rows were backfilled above)
ALTER TABLE public.companies ALTER COLUMN team_id SET DEFAULT public.current_team_id();
ALTER TABLE public.drivers ALTER COLUMN team_id SET DEFAULT public.current_team_id();
ALTER TABLE public.activities ALTER COLUMN team_id SET DEFAULT public.current_team_id();

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY: every dispatcher sees only their own team
-- ------------------------------------------------------------------------------
-- Remove every older policy (including the old "Allow public ..." ones)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('teams', 'staff_profiles', 'companies', 'drivers', 'activities')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their team"
    ON public.teams FOR SELECT TO authenticated
    USING (id = public.current_team_id());

-- Profiles are read-only to clients; changes go through the functions in step 5
CREATE POLICY "Members read their team roster"
    ON public.staff_profiles FOR SELECT TO authenticated
    USING (team_id = public.current_team_id());

-- Everyone in the team reads and edits companies / drivers and adds drivers;
-- only managers add companies or remove either.
CREATE POLICY "Members read their team companies"
    ON public.companies FOR SELECT TO authenticated
    USING (team_id = public.current_team_id());

CREATE POLICY "Members edit their team companies"
    ON public.companies FOR UPDATE TO authenticated
    USING (team_id = public.current_team_id())
    WITH CHECK (team_id = public.current_team_id());

CREATE POLICY "Managers add companies"
    ON public.companies FOR INSERT TO authenticated
    WITH CHECK (team_id = public.current_team_id() AND public.is_team_manager());

CREATE POLICY "Managers remove companies"
    ON public.companies FOR DELETE TO authenticated
    USING (team_id = public.current_team_id() AND public.is_team_manager());

CREATE POLICY "Members read their team drivers"
    ON public.drivers FOR SELECT TO authenticated
    USING (team_id = public.current_team_id());

CREATE POLICY "Members edit their team drivers"
    ON public.drivers FOR UPDATE TO authenticated
    USING (team_id = public.current_team_id())
    WITH CHECK (
        team_id = public.current_team_id()
        AND EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_id AND c.team_id = public.current_team_id()
        )
    );

-- Staff and managers both add drivers; only managers remove them
CREATE POLICY "Members add drivers"
    ON public.drivers FOR INSERT TO authenticated
    WITH CHECK (
        team_id = public.current_team_id()
        AND EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_id AND c.team_id = public.current_team_id()
        )
    );

CREATE POLICY "Managers remove drivers"
    ON public.drivers FOR DELETE TO authenticated
    USING (team_id = public.current_team_id() AND public.is_team_manager());

-- Staff read their own records and those their shift-mates logged on their shift
-- (credited to the shift they are on now, by someone on it now); managers read the whole team
CREATE POLICY "Staff read own and shift activities, managers read team"
    ON public.activities FOR SELECT TO authenticated
    USING (
        team_id = public.current_team_id()
        AND (
            staff_user_id = auth.uid()::text
            OR public.is_team_manager()
            OR (
                activities.shift_code = public.current_shift_code()
                AND EXISTS (
                    SELECT 1 FROM public.staff_profiles p
                    WHERE p.id = activities.staff_user_id
                      AND p.team_id = activities.team_id
                      AND p.shift_code = activities.shift_code
                )
            )
        )
    );

-- Inserts are stamped by the trigger below; the check makes forgery impossible.
-- Only the dispatch action buttons create log records (no automatic status-change logs).
CREATE POLICY "Members record activities as themselves"
    ON public.activities FOR INSERT TO authenticated
    WITH CHECK (
        team_id = public.current_team_id()
        AND staff_user_id = auth.uid()::text
        AND action_type IN ('SHIFT', 'CYCLE', 'FIX_LOG', 'BREAK', 'DRIVER_CONNECTED')
    );
-- No UPDATE or DELETE policy on activities: the audit trail is immutable.

-- ------------------------------------------------------------------------------
-- 4. ACTIVITY ACTOR & SHIFT STAMPING
--    Actor, name snapshot, team, time and shift come from the session - never from the client.
-- ------------------------------------------------------------------------------
-- Shifts run on Tashkent time (UTC+5, no daylight saving). Default hours:
--   MORNING 07:00-15:00, AFTERNOON 13:00-23:00, NIGHT 23:00-07:00
-- A manager can change the hours of each shift, separately for each day of the
-- week (public.shift_hours; days without a row use the defaults).
-- An action is credited to the shift its author is assigned to; someone with no
-- assigned shift is placed by the clock (in an overlap, the earlier-starting shift wins).
-- The work day is the Tashkent date the shift starts on, so a shift that runs
-- past midnight still belongs to the day it began. An action outside the hours
-- (early start, late finish) goes to the nearest run of the shift.

-- Custom hours, minutes after Tashkent midnight; weekday 1 = Monday ... 7 = Sunday
-- of the day the shift starts. end_min <= start_min means it ends the next day.
CREATE TABLE IF NOT EXISTS public.shift_hours (
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    shift_code TEXT NOT NULL CHECK (shift_code IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_min SMALLINT NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
    end_min SMALLINT NOT NULL CHECK (end_min BETWEEN 0 AND 1439),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, shift_code, weekday),
    CHECK (start_min <> end_min)
);
ALTER TABLE public.shift_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their team shift hours" ON public.shift_hours;
-- Read-only to clients; managers change it through save_shift_hours
CREATE POLICY "Members read their team shift hours"
    ON public.shift_hours FOR SELECT TO authenticated
    USING (team_id = public.current_team_id());

-- Hours of one shift on one work day (custom row, else the default)
CREATE OR REPLACE FUNCTION public.cb_shift_hours(p_team TEXT, p_shift TEXT, p_day DATE)
RETURNS TABLE (start_min INT, end_min INT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT coalesce(h.start_min, d.start_min)::int, coalesce(h.end_min, d.end_min)::int
    FROM (VALUES ('MORNING', 420, 900), ('AFTERNOON', 780, 1380), ('NIGHT', 1380, 420)) AS d(code, start_min, end_min)
    LEFT JOIN public.shift_hours h
      ON h.team_id = p_team AND h.shift_code = d.code AND h.weekday = extract(isodow FROM p_day)::int
    WHERE d.code = p_shift
$$;

-- The old two-argument version placed shifts by fixed hours
DROP FUNCTION IF EXISTS public.cb_shift_of(TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.cb_shift_of(p_at TIMESTAMPTZ, p_assigned TEXT DEFAULT NULL, p_team TEXT DEFAULT NULL)
RETURNS TABLE (shift_code TEXT, shift_date DATE)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH t AS (
        SELECT p_at AT TIME ZONE 'Asia/Tashkent' AS ts
    ), runs AS (
        -- Every run of every candidate shift that starts yesterday or today
        SELECT c.code, d.day,
               d.day + make_interval(mins => h.start_min) AS starts,
               d.day + make_interval(mins => h.end_min)
                     + CASE WHEN h.end_min <= h.start_min THEN interval '1 day' ELSE interval '0' END AS ends
        FROM t
        CROSS JOIN (VALUES ('MORNING'), ('AFTERNOON'), ('NIGHT')) AS c(code)
        CROSS JOIN LATERAL (VALUES (t.ts::date - 1), (t.ts::date)) AS d(day)
        CROSS JOIN LATERAL public.cb_shift_hours(p_team, c.code, d.day) AS h
        WHERE p_assigned IS NULL OR c.code = p_assigned
    )
    SELECT r.code, r.day
    FROM runs r, t
    -- Inside a run [starts, ends) = distance 0; overlaps go to the run that started first
    ORDER BY CASE
                 WHEN t.ts >= r.ends THEN t.ts - r.ends + interval '1 microsecond'
                 WHEN t.ts < r.starts THEN r.starts - t.ts
                 ELSE interval '0'
             END,
             r.starts
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.activities_stamp_actor()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    me RECORD;
    drv RECORD;
    comp RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        -- SQL editor / service role maintenance; RLS still blocks anonymous clients
        IF NEW.shift_date IS NULL THEN
            SELECT s.shift_code, s.shift_date INTO NEW.shift_code, NEW.shift_date
            FROM public.cb_shift_of(coalesce(NEW.action_at, NOW()), NULL, NEW.team_id) s;
        END IF;
        RETURN NEW;
    END IF;

    SELECT id, display_name, team_id, shift_code INTO me
    FROM public.staff_profiles
    WHERE id = auth.uid()::text AND is_active;

    IF me.id IS NULL THEN
        RAISE EXCEPTION 'Your account is not active in any team' USING ERRCODE = '42501';
    END IF;

    NEW.staff_user_id := me.id;
    NEW.staff_name_snapshot := me.display_name;
    NEW.team_id := me.team_id;
    NEW.action_at := NOW();
    NEW.created_at := NOW();
    SELECT s.shift_code, s.shift_date INTO NEW.shift_code, NEW.shift_date
    FROM public.cb_shift_of(NOW(), me.shift_code, me.team_id) s;
    IF NEW.id IS NULL OR NEW.id = '' THEN
        NEW.id := 'act-' || replace(gen_random_uuid()::text, '-', '');
    END IF;

    -- Historical snapshots are taken from the live rows when they exist in this team
    IF NEW.driver_id IS NOT NULL THEN
        SELECT d.id, d.unit, d.name, d.company_id INTO drv
        FROM public.drivers d WHERE d.id = NEW.driver_id AND d.team_id = me.team_id;
        IF drv.id IS NULL THEN
            NEW.driver_id := NULL;
        ELSE
            NEW.driver_name_snapshot := CASE WHEN coalesce(drv.unit, '') <> '' THEN drv.unit || ' - ' || drv.name ELSE drv.name END;
            NEW.company_id := coalesce(NEW.company_id, drv.company_id);
        END IF;
    END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.id, c.name INTO comp
        FROM public.companies c WHERE c.id = NEW.company_id AND c.team_id = me.team_id;
        IF comp.id IS NULL THEN
            NEW.company_id := NULL;
        ELSE
            NEW.company_name_snapshot := comp.name;
        END IF;
    END IF;

    NEW.driver_name_snapshot := coalesce(NEW.driver_name_snapshot, '');
    NEW.company_name_snapshot := coalesce(NEW.company_name_snapshot, '');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_stamp_actor ON public.activities;
CREATE TRIGGER activities_stamp_actor
    BEFORE INSERT ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.activities_stamp_actor();

-- Only managers rename a company or change its note; staff may still reorder companies
CREATE OR REPLACE FUNCTION public.companies_guard_details()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND (NEW.name IS DISTINCT FROM OLD.name OR NEW.note IS DISTINCT FROM OLD.note)
       AND NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can edit company details' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_guard_details ON public.companies;
CREATE TRIGGER companies_guard_details
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.companies_guard_details();

-- Records from before shifts existed: place them by the clock
UPDATE public.activities a
SET (shift_code, shift_date) = (SELECT s.shift_code, s.shift_date FROM public.cb_shift_of(a.action_at, NULL, a.team_id) s)
WHERE a.shift_date IS NULL;

-- ------------------------------------------------------------------------------
-- 5. ACCOUNT FUNCTIONS (called from the app with supabase.rpc)
-- ------------------------------------------------------------------------------
-- Internal: create a confirmed Supabase Auth user for a username/password
CREATE OR REPLACE FUNCTION public._cb_create_auth_user(p_username TEXT, p_password TEXT, p_display_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_username TEXT := lower(trim(coalesce(p_username, '')));
    v_email TEXT := public.login_email(p_username);
    v_uid UUID := gen_random_uuid();
BEGIN
    IF v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' THEN
        RAISE EXCEPTION 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore';
    END IF;
    IF length(coalesce(p_password, '')) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters';
    END IF;
    IF length(trim(coalesce(p_display_name, ''))) = 0 THEN
        RAISE EXCEPTION 'Name is required';
    END IF;
    IF EXISTS (SELECT 1 FROM public.staff_profiles WHERE lower(username) = v_username)
       OR EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        RAISE EXCEPTION 'Username is already taken';
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, crypt(p_password, gen_salt('bf')), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('username', v_username, 'display_name', trim(p_display_name)),
        NOW(), NOW(), '', '', '', ''
    );

    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
        v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', NOW(), NOW(), NOW()
    );

    RETURN v_uid;
END;
$$;

-- "Create a Team": anyone can register a team; the creator becomes its manager
CREATE OR REPLACE FUNCTION public.register_team(p_team_name TEXT, p_manager_name TEXT, p_username TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team_id TEXT := 'team-' || replace(gen_random_uuid()::text, '-', '');
    v_uid UUID;
BEGIN
    IF length(trim(coalesce(p_team_name, ''))) = 0 THEN
        RAISE EXCEPTION 'Team name is required';
    END IF;

    v_uid := public._cb_create_auth_user(p_username, p_password, p_manager_name);

    INSERT INTO public.teams (id, name) VALUES (v_team_id, trim(p_team_name));
    INSERT INTO public.staff_profiles (id, team_id, username, email, display_name, role, is_active)
    VALUES (v_uid::text, v_team_id, lower(trim(p_username)), public.login_email(p_username), trim(p_manager_name), 'manager', true);

    RETURN json_build_object('team_id', v_team_id, 'user_id', v_uid);
END;
$$;

-- Manager creates a login for a staff member (or another manager) in their own team
CREATE OR REPLACE FUNCTION public.create_staff_account(p_display_name TEXT, p_username TEXT, p_password TEXT, p_role TEXT DEFAULT 'staff')
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team_id TEXT := public.current_team_id();
    v_role TEXT := CASE WHEN p_role = 'manager' THEN 'manager' ELSE 'staff' END;
    v_uid UUID;
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can create staff accounts' USING ERRCODE = '42501';
    END IF;

    v_uid := public._cb_create_auth_user(p_username, p_password, p_display_name);

    INSERT INTO public.staff_profiles (id, team_id, username, email, display_name, role, is_active)
    VALUES (v_uid::text, v_team_id, lower(trim(p_username)), public.login_email(p_username), trim(p_display_name), v_role, true);

    RETURN json_build_object('id', v_uid::text, 'username', lower(trim(p_username)), 'display_name', trim(p_display_name), 'role', v_role);
END;
$$;

-- Internal: the target must be another member of the caller's team
CREATE OR REPLACE FUNCTION public._cb_assert_manages(p_staff_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can manage staff accounts' USING ERRCODE = '42501';
    END IF;
    IF p_staff_id = auth.uid()::text THEN
        RAISE EXCEPTION 'You cannot change your own role or status';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = p_staff_id AND team_id = public.current_team_id()
    ) THEN
        RAISE EXCEPTION 'Staff account not found in your team';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_role(p_staff_id TEXT, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_role NOT IN ('staff', 'manager') THEN
        RAISE EXCEPTION 'Role must be staff or manager';
    END IF;
    PERFORM public._cb_assert_manages(p_staff_id);
    UPDATE public.staff_profiles SET role = p_role, updated_at = NOW() WHERE id = p_staff_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_staff_password(p_staff_id TEXT, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF length(coalesce(p_new_password, '')) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters';
    END IF;
    PERFORM public._cb_assert_manages(p_staff_id);
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = NOW()
    WHERE id::text = p_staff_id;
    -- Sign the account out everywhere so the old password stops working immediately
    DELETE FROM auth.sessions WHERE user_id::text = p_staff_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_active(p_staff_id TEXT, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public._cb_assert_manages(p_staff_id);
    -- A deactivated member leaves their shift (so they drop out of shift lists,
    -- shift-mate visibility and reminders); reactivating does not restore it
    UPDATE public.staff_profiles
    SET is_active = p_active,
        shift_code = CASE WHEN p_active THEN shift_code ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_staff_id;
    -- Block (or unblock) the login itself; history is never touched
    UPDATE auth.users
    SET banned_until = CASE WHEN p_active THEN NULL ELSE NOW() + INTERVAL '100 years' END,
        updated_at = NOW()
    WHERE id::text = p_staff_id;
    IF NOT p_active THEN
        DELETE FROM auth.sessions WHERE user_id::text = p_staff_id;
        -- Their phones stop getting alerts (the table is created in step 7D)
        IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
            DELETE FROM public.push_subscriptions WHERE staff_id = p_staff_id;
        END IF;
    END IF;
END;
$$;

-- Earlier versions left deactivated members on their shift
UPDATE public.staff_profiles SET shift_code = NULL WHERE NOT is_active AND shift_code IS NOT NULL;

-- Any member can rename themselves (past activity snapshots keep the old name)
CREATE OR REPLACE FUNCTION public.update_my_display_name(p_display_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF length(trim(coalesce(p_display_name, ''))) = 0 THEN
        RAISE EXCEPTION 'Name is required';
    END IF;
    UPDATE public.staff_profiles
    SET display_name = trim(p_display_name), updated_at = NOW()
    WHERE id = auth.uid()::text AND is_active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Your account is not active' USING ERRCODE = '42501';
    END IF;
END;
$$;

-- Any member changes their own username, which is also their sign-in name
-- (<username>@checkingboard.internal); they stay signed in
CREATE OR REPLACE FUNCTION public.update_my_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid TEXT := auth.uid()::text;
    v_username TEXT := lower(trim(coalesce(p_username, '')));
    v_email TEXT := public.login_email(p_username);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = v_uid AND is_active) THEN
        RAISE EXCEPTION 'Your account is not active' USING ERRCODE = '42501';
    END IF;
    IF v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' THEN
        RAISE EXCEPTION 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore';
    END IF;
    IF EXISTS (SELECT 1 FROM public.staff_profiles WHERE lower(username) = v_username AND id <> v_uid)
       OR EXISTS (SELECT 1 FROM auth.users WHERE email = v_email AND id::text <> v_uid) THEN
        RAISE EXCEPTION 'Username is already taken';
    END IF;

    UPDATE public.staff_profiles SET username = v_username, email = v_email, updated_at = NOW() WHERE id = v_uid;
    UPDATE auth.users
    SET email = v_email,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', v_username),
        updated_at = NOW()
    WHERE id::text = v_uid;
    UPDATE auth.identities
    SET identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = NOW()
    WHERE user_id::text = v_uid AND provider = 'email';
    RETURN v_username;
END;
$$;

-- Any member changes their own password after confirming the current one.
-- This device stays signed in; their other devices are signed out.
CREATE OR REPLACE FUNCTION public.change_my_password(p_current_password TEXT, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_hash TEXT;
    v_session TEXT := auth.jwt() ->> 'session_id';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = v_uid::text AND is_active) THEN
        RAISE EXCEPTION 'Your account is not active' USING ERRCODE = '42501';
    END IF;
    IF length(coalesce(p_new_password, '')) < 6 THEN
        RAISE EXCEPTION 'New password must be at least 6 characters';
    END IF;
    SELECT encrypted_password INTO v_hash FROM auth.users WHERE id = v_uid;
    IF coalesce(v_hash, '') = '' OR v_hash <> crypt(coalesce(p_current_password, ''), v_hash) THEN
        RAISE EXCEPTION 'Your current password is not correct';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = NOW()
    WHERE id = v_uid;
    -- Only when this session is known, so this device is never signed out by mistake
    IF v_session IS NOT NULL THEN
        DELETE FROM auth.sessions WHERE user_id = v_uid AND id::text <> v_session;
    END IF;
END;
$$;

-- Daily sign reset: the first dispatcher online after US Eastern midnight resets
-- every driver in the team to NO SIGN, exactly once per team per day.
CREATE OR REPLACE FUNCTION public.run_daily_sign_reset()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team TEXT := public.current_team_id();
    v_today DATE := (NOW() AT TIME ZONE 'America/New_York')::date;
    v_last DATE;
BEGIN
    IF v_team IS NULL THEN
        RETURN false;
    END IF;
    SELECT last_sign_reset_date INTO v_last FROM public.teams WHERE id = v_team FOR UPDATE;
    IF v_last IS NULL THEN
        UPDATE public.teams SET last_sign_reset_date = v_today WHERE id = v_team;  -- start tracking, no reset
        RETURN false;
    END IF;
    IF v_last >= v_today THEN
        RETURN false;
    END IF;
    UPDATE public.drivers SET sign = 'NO SIGN', updated_at = NOW() WHERE team_id = v_team AND sign IS DISTINCT FROM 'NO SIGN';
    UPDATE public.teams SET last_sign_reset_date = v_today, updated_at = NOW() WHERE id = v_team;
    RETURN true;
END;
$$;

-- Manager sets the whole shift schedule at once:
--   {"MORNING": [staff ids], "AFTERNOON": [...], "NIGHT": [...]}
-- Any number of people per shift, one shift per person; anyone left out is unassigned.
CREATE OR REPLACE FUNCTION public.save_shift_schedule(p_schedule JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team TEXT := public.current_team_id();
    v_shift TEXT;
    v_ids TEXT[];
    v_all TEXT[] := '{}';
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can change the shift schedule' USING ERRCODE = '42501';
    END IF;

    FOREACH v_shift IN ARRAY ARRAY['MORNING', 'AFTERNOON', 'NIGHT'] LOOP
        v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_schedule -> v_shift, '[]'::jsonb)));
        IF v_ids && v_all THEN
            RAISE EXCEPTION 'A person can be on only one shift';
        END IF;
        v_all := v_all || v_ids;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM unnest(v_all) AS u(staff_id)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.staff_profiles p
            WHERE p.id = u.staff_id AND p.team_id = v_team AND p.is_active
        )
    ) THEN
        RAISE EXCEPTION 'Only active members of your team can be scheduled';
    END IF;

    UPDATE public.staff_profiles
    SET shift_code = NULL, updated_at = NOW()
    WHERE team_id = v_team AND shift_code IS NOT NULL AND NOT (id = ANY (v_all));

    FOREACH v_shift IN ARRAY ARRAY['MORNING', 'AFTERNOON', 'NIGHT'] LOOP
        UPDATE public.staff_profiles
        SET shift_code = v_shift, updated_at = NOW()
        WHERE team_id = v_team
          AND shift_code IS DISTINCT FROM v_shift
          AND id = ANY (ARRAY(SELECT jsonb_array_elements_text(coalesce(p_schedule -> v_shift, '[]'::jsonb))));
    END LOOP;
END;
$$;

-- Manager replaces the team's shift hours:
--   [{"shift_code": "MORNING", "weekday": 1, "start_min": 420, "end_min": 900}, ...]
-- Days left out use the default hours.
CREATE OR REPLACE FUNCTION public.save_shift_hours(p_hours JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team TEXT := public.current_team_id();
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can change shift hours' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(coalesce(p_hours, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Shift hours must be a list';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(coalesce(p_hours, '[]'::jsonb))
            AS r(shift_code TEXT, weekday INT, start_min INT, end_min INT)
        WHERE r.start_min IS NOT DISTINCT FROM r.end_min
    ) THEN
        RAISE EXCEPTION 'A shift cannot start and end at the same time';
    END IF;

    DELETE FROM public.shift_hours WHERE team_id = v_team;
    -- The table checks reject unknown shifts, days and times
    INSERT INTO public.shift_hours (team_id, shift_code, weekday, start_min, end_min)
    SELECT v_team, r.shift_code, r.weekday, r.start_min, r.end_min
    FROM jsonb_to_recordset(coalesce(p_hours, '[]'::jsonb))
        AS r(shift_code TEXT, weekday INT, start_min INT, end_min INT);
END;
$$;

-- Drag-and-drop reorders: [{id, order_index, company_id?}, ...]. Runs as the caller,
-- so the same row security applies (staff may reorder, but not add or remove rows).
CREATE OR REPLACE FUNCTION public.save_driver_order(p_rows JSONB)
RETURNS VOID
LANGUAGE sql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    UPDATE public.drivers d
    SET order_index = (r ->> 'order_index')::int,
        company_id = coalesce(r ->> 'company_id', d.company_id),
        updated_at = NOW()
    FROM jsonb_array_elements(p_rows) AS r
    WHERE d.id = r ->> 'id'
$$;

CREATE OR REPLACE FUNCTION public.save_company_order(p_rows JSONB)
RETURNS VOID
LANGUAGE sql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    UPDATE public.companies c
    SET order_index = (r ->> 'order_index')::int,
        updated_at = NOW()
    FROM jsonb_array_elements(p_rows) AS r
    WHERE c.id = r ->> 'id'
$$;

-- Who can call what
REVOKE ALL ON FUNCTION public.run_daily_sign_reset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_daily_sign_reset() TO authenticated;
REVOKE ALL ON FUNCTION public.save_shift_schedule(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_shift_schedule(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.save_shift_hours(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_shift_hours(JSONB) TO authenticated;
-- Internal: only the activity trigger places actions in shifts
REVOKE ALL ON FUNCTION public.cb_shift_hours(TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cb_shift_of(TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_driver_order(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_driver_order(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.save_company_order(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_company_order(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public._cb_create_auth_user(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cb_assert_manages(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_team(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_team(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_staff_account(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_role(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_staff_password(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_active(TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_display_name(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_username(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_my_password(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_my_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_role(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_staff_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_active(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_display_name(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. CLIENT TABLE PRIVILEGES (RLS above decides which rows)
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.teams, public.staff_profiles, public.companies, public.drivers, public.activities FROM anon;
GRANT SELECT ON public.teams, public.staff_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies, public.drivers TO authenticated;
GRANT SELECT, INSERT ON public.activities TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.teams, public.staff_profiles FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.activities FROM authenticated;
REVOKE ALL ON public.shift_hours FROM anon;
GRANT SELECT ON public.shift_hours TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.shift_hours FROM authenticated;

-- ------------------------------------------------------------------------------
-- 7. REALTIME (live sync between dispatchers)
-- ------------------------------------------------------------------------------
ALTER TABLE public.companies REPLICA IDENTITY FULL;
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
DO $$
DECLARE
    t TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    FOREACH t IN ARRAY ARRAY['companies', 'drivers', 'activities'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 7B. NOTIFICATIONS (manager -> staff) AND EXTENSIONS (manager publishes, team downloads)
-- ------------------------------------------------------------------------------
-- (public.current_shift_code() is defined with the session helpers in step 2)

-- audience: ALL = whole team, SHIFT = everyone on audience_shift, STAFF = one person
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT ('ntf-' || replace(gen_random_uuid()::text, '-', '')),
    team_id TEXT NOT NULL DEFAULT public.current_team_id(),
    sender_id TEXT REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    body TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'SHIFT', 'STAFF')),
    audience_shift TEXT CHECK (audience_shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    audience_staff_id TEXT REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (audience <> 'SHIFT' OR audience_shift IS NOT NULL),
    CHECK (audience <> 'STAFF' OR audience_staff_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS notifications_team_idx ON public.notifications (team_id, created_at DESC);

-- One row per person per notification they have seen
CREATE TABLE IF NOT EXISTS public.notification_reads (
    notification_id TEXT NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, staff_id)
);

-- Extension builds a manager publishes for the team (file in the 'extensions' storage bucket)
CREATE TABLE IF NOT EXISTS public.extensions (
    id TEXT PRIMARY KEY DEFAULT ('ext-' || replace(gen_random_uuid()::text, '-', '')),
    team_id TEXT NOT NULL DEFAULT public.current_team_id(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    version TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    setup_steps TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    published_by TEXT REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    publisher_name TEXT NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS extensions_team_idx ON public.extensions (team_id, published_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read notifications meant for them" ON public.notifications;
DROP POLICY IF EXISTS "Managers send notifications" ON public.notifications;
DROP POLICY IF EXISTS "Managers delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Members read their own read marks" ON public.notification_reads;
DROP POLICY IF EXISTS "Members mark notifications read" ON public.notification_reads;
DROP POLICY IF EXISTS "Members read team extensions" ON public.extensions;
DROP POLICY IF EXISTS "Managers publish extensions" ON public.extensions;
DROP POLICY IF EXISTS "Managers update extensions" ON public.extensions;
DROP POLICY IF EXISTS "Managers remove extensions" ON public.extensions;

-- Managers see everything they sent; staff see what is addressed to them
CREATE POLICY "Members read notifications meant for them"
    ON public.notifications FOR SELECT TO authenticated
    USING (
        team_id = public.current_team_id()
        AND (
            public.is_team_manager()
            OR audience = 'ALL'
            OR (audience = 'STAFF' AND audience_staff_id = auth.uid()::text)
            OR (audience = 'SHIFT' AND audience_shift = public.current_shift_code())
        )
    );

CREATE POLICY "Managers send notifications"
    ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (team_id = public.current_team_id() AND public.is_team_manager());

CREATE POLICY "Managers delete notifications"
    ON public.notifications FOR DELETE TO authenticated
    USING (team_id = public.current_team_id() AND public.is_team_manager());

CREATE POLICY "Members read their own read marks"
    ON public.notification_reads FOR SELECT TO authenticated
    USING (staff_id = auth.uid()::text);

-- Only for notifications the member can see (the subquery runs under their RLS)
CREATE POLICY "Members mark notifications read"
    ON public.notification_reads FOR INSERT TO authenticated
    WITH CHECK (
        staff_id = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = notification_id)
    );

CREATE POLICY "Members read team extensions"
    ON public.extensions FOR SELECT TO authenticated
    USING (team_id = public.current_team_id());

CREATE POLICY "Managers publish extensions"
    ON public.extensions FOR INSERT TO authenticated
    WITH CHECK (team_id = public.current_team_id() AND public.is_team_manager());

CREATE POLICY "Managers update extensions"
    ON public.extensions FOR UPDATE TO authenticated
    USING (team_id = public.current_team_id() AND public.is_team_manager())
    WITH CHECK (team_id = public.current_team_id() AND public.is_team_manager());

CREATE POLICY "Managers remove extensions"
    ON public.extensions FOR DELETE TO authenticated
    USING (team_id = public.current_team_id() AND public.is_team_manager());

-- Sender / publisher, team and time come from the session, never the client
CREATE OR REPLACE FUNCTION public.stamp_sender()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    me RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT id, display_name, team_id INTO me
    FROM public.staff_profiles WHERE id = auth.uid()::text AND is_active;
    IF me.id IS NULL THEN
        RAISE EXCEPTION 'Your account is not active in any team' USING ERRCODE = '42501';
    END IF;
    NEW.team_id := me.team_id;
    IF TG_TABLE_NAME = 'notifications' THEN
        NEW.sender_id := me.id;
        NEW.sender_name := me.display_name;
        NEW.created_at := NOW();
    ELSE
        NEW.published_by := me.id;
        NEW.publisher_name := me.display_name;
        NEW.published_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_stamp_sender ON public.notifications;
CREATE TRIGGER notifications_stamp_sender
    BEFORE INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.stamp_sender();

DROP TRIGGER IF EXISTS extensions_stamp_publisher ON public.extensions;
CREATE TRIGGER extensions_stamp_publisher
    BEFORE INSERT ON public.extensions
    FOR EACH ROW EXECUTE FUNCTION public.stamp_sender();

REVOKE ALL ON public.notifications, public.notification_reads, public.extensions FROM anon;
GRANT SELECT, INSERT, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.notification_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extensions TO authenticated;
REVOKE ALL ON FUNCTION public.current_shift_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_shift_code() TO authenticated;

-- Private storage bucket for extension files: <team_id>/<file>, 50 MB each
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('extensions', 'extensions', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Team downloads its extension files" ON storage.objects;
DROP POLICY IF EXISTS "Managers upload extension files" ON storage.objects;
DROP POLICY IF EXISTS "Managers remove extension files" ON storage.objects;

CREATE POLICY "Team downloads its extension files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'extensions' AND (storage.foldername(name))[1] = public.current_team_id());

CREATE POLICY "Managers upload extension files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'extensions'
        AND (storage.foldername(name))[1] = public.current_team_id()
        AND public.is_team_manager()
    );

CREATE POLICY "Managers remove extension files"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'extensions'
        AND (storage.foldername(name))[1] = public.current_team_id()
        AND public.is_team_manager()
    );

-- Notifications arrive live
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7C. OFFICE LOCATION (one office per team; read later by a check-in function)
-- ------------------------------------------------------------------------------
-- All office columns null = not configured. Members read them through the teams
-- SELECT policy; nobody writes teams directly, only through the functions below.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_lat DOUBLE PRECISION;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_lng DOUBLE PRECISION;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_radius_m INTEGER;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_updated_at TIMESTAMPTZ;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Coordinates and radius in range, and either all three set or all three null
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_office_location_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_office_location_check CHECK (
    (office_lat IS NULL AND office_lng IS NULL AND office_radius_m IS NULL)
    OR (
        office_lat IS NOT NULL AND office_lng IS NOT NULL AND office_radius_m IS NOT NULL
        AND office_lat BETWEEN -90 AND 90
        AND office_lng BETWEEN -180 AND 180
        AND office_radius_m BETWEEN 30 AND 1000
    )
);

-- Manager pins the team's office; who and when come from the session
CREATE OR REPLACE FUNCTION public.set_office_location(p_name TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_m INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team TEXT := public.current_team_id();
    v_name TEXT := trim(coalesce(p_name, ''));
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can set the office location' USING ERRCODE = '42501';
    END IF;
    IF length(v_name) = 0 THEN
        RAISE EXCEPTION 'Office name is required';
    END IF;
    IF length(v_name) > 80 THEN
        RAISE EXCEPTION 'Office name can be at most 80 characters';
    END IF;
    IF p_lat IS NULL OR p_lng IS NULL OR p_radius_m IS NULL THEN
        RAISE EXCEPTION 'Latitude, longitude and radius are all required';
    END IF;
    -- 'NaN' sorts above every number in Postgres, so it fails the range checks too
    IF p_lat = 'NaN' OR p_lat < -90 OR p_lat > 90 THEN
        RAISE EXCEPTION 'Latitude must be between -90 and 90';
    END IF;
    IF p_lng = 'NaN' OR p_lng < -180 OR p_lng > 180 THEN
        RAISE EXCEPTION 'Longitude must be between -180 and 180';
    END IF;
    IF p_radius_m < 30 OR p_radius_m > 1000 THEN
        RAISE EXCEPTION 'Radius must be between 30 and 1000 meters';
    END IF;

    UPDATE public.teams
    SET office_name = v_name,
        office_lat = p_lat,
        office_lng = p_lng,
        office_radius_m = p_radius_m,
        office_updated_at = NOW(),
        office_updated_by = auth.uid(),
        updated_at = NOW()
    WHERE id = v_team;
END;
$$;

-- Manager removes the office (back to "not configured")
CREATE OR REPLACE FUNCTION public.clear_office_location()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can remove the office location' USING ERRCODE = '42501';
    END IF;
    UPDATE public.teams
    SET office_name = NULL,
        office_lat = NULL,
        office_lng = NULL,
        office_radius_m = NULL,
        office_updated_at = NULL,
        office_updated_by = NULL,
        updated_at = NOW()
    WHERE id = public.current_team_id();
END;
$$;

-- Great-circle distance in meters (haversine, mean Earth radius). For the future check-in.
CREATE OR REPLACE FUNCTION public.cb_distance_m(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT 2 * 6371008.8 * asin(least(1, sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )))
$$;

REVOKE ALL ON FUNCTION public.set_office_location(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_office_location() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cb_distance_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_office_location(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_office_location() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cb_distance_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7D. ATTENDANCE (phone check-in / check-out) AND PHONE PUSH SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
-- Staff check in and out on their phone. The time, shift, distance to the office
-- and lateness are decided here from the session and the server clock, never by
-- the phone. Outside the office radius the check-in / check-out is refused.
-- A check-in more than late_after_min minutes after the shift starts is late.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS late_after_min INTEGER NOT NULL DEFAULT 15;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_late_after_min_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_late_after_min_check CHECK (late_after_min BETWEEN 0 AND 240);

-- Start / end instants of one run of a shift (work day = the Tashkent date it starts)
CREATE OR REPLACE FUNCTION public.cb_shift_run(p_team TEXT, p_shift TEXT, p_day DATE)
RETURNS TABLE (starts TIMESTAMPTZ, ends TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT (p_day + make_interval(mins => h.start_min)) AT TIME ZONE 'Asia/Tashkent',
           (p_day + make_interval(mins => h.end_min)
                  + CASE WHEN h.end_min <= h.start_min THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Tashkent'
    FROM public.cb_shift_hours(p_team, p_shift, p_day) h
$$;

-- One row per person per shift run. Names are snapshotted like activities.
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY DEFAULT ('att-' || replace(gen_random_uuid()::text, '-', '')),
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    staff_id TEXT REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    staff_name_snapshot TEXT NOT NULL DEFAULT '',
    shift_code TEXT NOT NULL CHECK (shift_code IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    shift_date DATE NOT NULL,                  -- work day (Tashkent date the run starts)
    shift_start TIMESTAMPTZ NOT NULL,          -- scheduled run, as it was at check-in
    shift_end TIMESTAMPTZ NOT NULL,
    check_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_in_lat DOUBLE PRECISION NOT NULL,
    check_in_lng DOUBLE PRECISION NOT NULL,
    check_in_accuracy_m DOUBLE PRECISION,
    check_in_distance_m DOUBLE PRECISION NOT NULL,
    check_out_at TIMESTAMPTZ,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    check_out_accuracy_m DOUBLE PRECISION,
    check_out_distance_m DOUBLE PRECISION,
    late_min INTEGER NOT NULL DEFAULT 0,       -- minutes after the scheduled start (0 = on time or early)
    late_after_min INTEGER NOT NULL DEFAULT 15, -- the team's rule when they checked in
    is_late BOOLEAN NOT NULL DEFAULT false,    -- late_min > late_after_min
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (staff_id, shift_date, shift_code)
);
CREATE INDEX IF NOT EXISTS attendance_team_date_idx ON public.attendance (team_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS attendance_open_idx ON public.attendance (staff_id) WHERE check_out_at IS NULL;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read own attendance, managers read team" ON public.attendance;
CREATE POLICY "Staff read own attendance, managers read team"
    ON public.attendance FOR SELECT TO authenticated
    USING (
        team_id = public.current_team_id()
        AND (staff_id = auth.uid()::text OR public.is_team_manager())
    );
-- No INSERT / UPDATE / DELETE policies: rows are written only by check_in / check_out.

-- Internal: distance from the office, or a clear refusal (no office, bad fix, too far)
CREATE OR REPLACE FUNCTION public._cb_office_distance(p_team TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    t RECORD;
    v_dist DOUBLE PRECISION;
BEGIN
    IF p_lat IS NULL OR p_lng IS NULL OR p_lat = 'NaN' OR p_lng = 'NaN'
       OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
        RAISE EXCEPTION 'Your location could not be read. Turn on location and try again.';
    END IF;
    SELECT office_name, office_lat, office_lng, office_radius_m INTO t FROM public.teams WHERE id = p_team;
    IF t.office_lat IS NULL THEN
        RAISE EXCEPTION 'Your manager has not set the office location yet.';
    END IF;
    v_dist := public.cb_distance_m(p_lat, p_lng, t.office_lat, t.office_lng);
    IF v_dist > t.office_radius_m THEN
        RAISE EXCEPTION 'You are % m from %. You need to be within % m.',
            round(v_dist)::int, coalesce(nullif(t.office_name, ''), 'the office'), t.office_radius_m;
    END IF;
    RETURN v_dist;
END;
$$;

-- Internal: the caller's open check-in (no check-out yet, shift not long over)
CREATE OR REPLACE FUNCTION public._cb_open_attendance(p_staff TEXT)
RETURNS public.attendance
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT * FROM public.attendance
    WHERE staff_id = p_staff AND check_out_at IS NULL AND shift_end + interval '8 hours' > NOW()
    ORDER BY check_in_at DESC
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.check_in(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_accuracy_m DOUBLE PRECISION DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    me RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_code TEXT;
    v_day DATE;
    v_starts TIMESTAMPTZ;
    v_ends TIMESTAMPTZ;
    v_dist DOUBLE PRECISION;
    v_late INT;
    v_grace INT;
    v_row public.attendance;
BEGIN
    SELECT id, display_name, team_id, shift_code INTO me
    FROM public.staff_profiles WHERE id = auth.uid()::text AND is_active;
    IF me.id IS NULL THEN
        RAISE EXCEPTION 'Your account is not active in any team' USING ERRCODE = '42501';
    END IF;
    IF me.shift_code IS NULL THEN
        RAISE EXCEPTION 'You are not on a shift yet. Ask your manager to add you to one.';
    END IF;
    IF (public._cb_open_attendance(me.id)).id IS NOT NULL THEN
        RAISE EXCEPTION 'You are already checked in. Check out first.';
    END IF;

    -- The run of your shift this belongs to (same rule as activities), and its hours
    SELECT s.shift_code, s.shift_date INTO v_code, v_day FROM public.cb_shift_of(v_now, me.shift_code, me.team_id) s;
    SELECT r.starts, r.ends INTO v_starts, v_ends FROM public.cb_shift_run(me.team_id, v_code, v_day) r;
    IF v_now < v_starts - interval '2 hours' THEN
        RAISE EXCEPTION 'Your shift starts at % (Tashkent). You can check in from %.',
            to_char(v_starts AT TIME ZONE 'Asia/Tashkent', 'HH24:MI'),
            to_char((v_starts - interval '2 hours') AT TIME ZONE 'Asia/Tashkent', 'HH24:MI');
    END IF;
    IF v_now >= v_ends THEN
        RAISE EXCEPTION 'Your shift ended at % (Tashkent).', to_char(v_ends AT TIME ZONE 'Asia/Tashkent', 'HH24:MI');
    END IF;
    IF EXISTS (SELECT 1 FROM public.attendance WHERE staff_id = me.id AND shift_date = v_day AND shift_code = v_code) THEN
        RAISE EXCEPTION 'You already checked in and out of this shift.';
    END IF;

    v_dist := public._cb_office_distance(me.team_id, p_lat, p_lng);
    SELECT late_after_min INTO v_grace FROM public.teams WHERE id = me.team_id;
    v_late := greatest(0, floor(extract(epoch FROM (v_now - v_starts)) / 60))::int;

    INSERT INTO public.attendance (
        team_id, staff_id, staff_name_snapshot, shift_code, shift_date, shift_start, shift_end,
        check_in_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m,
        late_min, late_after_min, is_late
    ) VALUES (
        me.team_id, me.id, me.display_name, v_code, v_day, v_starts, v_ends,
        v_now, p_lat, p_lng, p_accuracy_m, v_dist,
        v_late, v_grace, v_late > v_grace
    )
    RETURNING * INTO v_row;
    RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_out(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_accuracy_m DOUBLE PRECISION DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    me RECORD;
    v_open public.attendance;
    v_dist DOUBLE PRECISION;
    v_row public.attendance;
BEGIN
    SELECT id, team_id INTO me FROM public.staff_profiles WHERE id = auth.uid()::text AND is_active;
    IF me.id IS NULL THEN
        RAISE EXCEPTION 'Your account is not active in any team' USING ERRCODE = '42501';
    END IF;
    v_open := public._cb_open_attendance(me.id);
    IF v_open.id IS NULL THEN
        RAISE EXCEPTION 'You are not checked in.';
    END IF;
    v_dist := public._cb_office_distance(me.team_id, p_lat, p_lng);

    UPDATE public.attendance
    SET check_out_at = NOW(),
        check_out_lat = p_lat,
        check_out_lng = p_lng,
        check_out_accuracy_m = p_accuracy_m,
        check_out_distance_m = v_dist
    WHERE id = v_open.id AND check_out_at IS NULL
    RETURNING * INTO v_row;
    RETURN row_to_json(v_row);
END;
$$;

-- Manager sets how many minutes after the shift start a check-in counts as late
CREATE OR REPLACE FUNCTION public.set_attendance_rules(p_late_after_min INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can change the attendance rules' USING ERRCODE = '42501';
    END IF;
    IF p_late_after_min IS NULL OR p_late_after_min < 0 OR p_late_after_min > 240 THEN
        RAISE EXCEPTION 'Late after must be between 0 and 240 minutes';
    END IF;
    UPDATE public.teams SET late_after_min = p_late_after_min, updated_at = NOW()
    WHERE id = public.current_team_id();
END;
$$;

-- Phones that receive push alerts. One row per browser subscription; the
-- send-push Edge Function reads it with the service role.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_team_idx ON public.push_subscriptions (team_id, staff_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Members read their own push subscriptions"
    ON public.push_subscriptions FOR SELECT TO authenticated
    USING (staff_id = auth.uid()::text);

-- Save this browser for the signed-in member (a shared phone moves to whoever signs in)
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT DEFAULT '')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    me RECORD;
BEGIN
    SELECT id, team_id INTO me FROM public.staff_profiles WHERE id = auth.uid()::text AND is_active;
    IF me.id IS NULL THEN
        RAISE EXCEPTION 'Your account is not active in any team' USING ERRCODE = '42501';
    END IF;
    IF coalesce(p_endpoint, '') !~ '^https://' OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = '' THEN
        RAISE EXCEPTION 'Invalid push subscription';
    END IF;
    INSERT INTO public.push_subscriptions (endpoint, staff_id, team_id, p256dh, auth, user_agent)
    VALUES (p_endpoint, me.id, me.team_id, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
    ON CONFLICT (endpoint) DO UPDATE
    SET staff_id = EXCLUDED.staff_id, team_id = EXCLUDED.team_id, p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND staff_id = auth.uid()::text
$$;

REVOKE ALL ON public.attendance, public.push_subscriptions FROM anon;
GRANT SELECT ON public.attendance, public.push_subscriptions TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.attendance, public.push_subscriptions FROM authenticated;
REVOKE ALL ON FUNCTION public.cb_shift_run(TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cb_office_distance(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cb_open_attendance(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_in(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_out(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_attendance_rules(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_push_subscription(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_attendance_rules(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(TEXT) TO authenticated;

-- Managers see check-ins arrive live
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7E. CHECK-IN / CHECK-OUT REMINDERS (phone alert 2 minutes before a shift starts / ends)
-- ------------------------------------------------------------------------------
-- Every minute pg_cron calls the shift-reminders Edge Function, which asks
-- claim_shift_reminders() who is due and sends them a push alert. A manager turns
-- reminders on or off for the whole team (set_shift_reminders). Who gets one:
--   * check-in: an active member on a shift who has not checked in to that run yet
--   * check-out: an active member who is checked in to that run and not out yet
-- Each reminder is sent once (shift_reminders_sent). One-time setup: see
-- setup_shift_reminders below and the README.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS shift_reminders_enabled BOOLEAN NOT NULL DEFAULT true;

-- Reminders already sent (kept two days, enough to never repeat one)
CREATE TABLE IF NOT EXISTS public.shift_reminders_sent (
    staff_id TEXT NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('CHECK_IN', 'CHECK_OUT')),
    event_at TIMESTAMPTZ NOT NULL,             -- the shift start (check-in) or end (check-out)
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (staff_id, kind, event_at)
);
ALTER TABLE public.shift_reminders_sent ENABLE ROW LEVEL SECURITY;
-- No policies: only the Edge Function (service role) and the functions below use it

-- Where pg_cron sends its call, and the secret the Edge Function checks.
-- One row; written by setup_shift_reminders, never readable by app users.
CREATE TABLE IF NOT EXISTS public.cb_cron_config (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    project_url TEXT NOT NULL,
    secret TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.cb_cron_config ENABLE ROW LEVEL SECURITY;

-- Manager turns the team's reminders on or off
CREATE OR REPLACE FUNCTION public.set_shift_reminders(p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_team_manager() THEN
        RAISE EXCEPTION 'Only managers can change shift reminders' USING ERRCODE = '42501';
    END IF;
    IF p_enabled IS NULL THEN
        RAISE EXCEPTION 'Choose on or off';
    END IF;
    UPDATE public.teams SET shift_reminders_enabled = p_enabled, updated_at = NOW()
    WHERE id = public.current_team_id();
END;
$$;

-- Reminders due now (the event is less than p_lead_min minutes away), each
-- returned once: the call records them as sent. Called by the Edge Function only.
CREATE OR REPLACE FUNCTION public.claim_shift_reminders(p_lead_min INT DEFAULT 2)
RETURNS TABLE (staff_id TEXT, team_id TEXT, kind TEXT, shift_code TEXT, shift_date DATE, event_at TIMESTAMPTZ)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    DELETE FROM public.shift_reminders_sent WHERE event_at < NOW() - interval '2 days';

    WITH due AS (
        SELECT p.id AS staff_id, p.team_id, e.kind, p.shift_code, d.day AS shift_date, e.event_at
        FROM public.staff_profiles p
        JOIN public.teams t ON t.id = p.team_id AND t.shift_reminders_enabled
        -- Runs that start yesterday, today or tomorrow (Tashkent): covers night shifts and midnight
        CROSS JOIN LATERAL (VALUES
            ((NOW() AT TIME ZONE 'Asia/Tashkent')::date - 1),
            ((NOW() AT TIME ZONE 'Asia/Tashkent')::date),
            ((NOW() AT TIME ZONE 'Asia/Tashkent')::date + 1)
        ) AS d(day)
        CROSS JOIN LATERAL public.cb_shift_run(p.team_id, p.shift_code, d.day) AS r
        CROSS JOIN LATERAL (VALUES ('CHECK_IN', r.starts), ('CHECK_OUT', r.ends)) AS e(kind, event_at)
        WHERE p.is_active
          AND p.shift_code IS NOT NULL
          AND NOW() >= e.event_at - make_interval(mins => greatest(1, least(coalesce(p_lead_min, 2), 30)))
          AND NOW() < e.event_at
          AND CASE e.kind
                  WHEN 'CHECK_IN' THEN NOT EXISTS (
                      SELECT 1 FROM public.attendance a
                      WHERE a.staff_id = p.id AND a.shift_date = d.day AND a.shift_code = p.shift_code)
                  ELSE EXISTS (
                      SELECT 1 FROM public.attendance a
                      WHERE a.staff_id = p.id AND a.shift_date = d.day AND a.shift_code = p.shift_code
                        AND a.check_out_at IS NULL)
              END
    ), claimed AS (
        INSERT INTO public.shift_reminders_sent AS s (staff_id, kind, event_at)
        SELECT due.staff_id, due.kind, due.event_at FROM due
        ON CONFLICT DO NOTHING
        RETURNING s.staff_id, s.kind, s.event_at
    )
    SELECT due.staff_id, due.team_id, due.kind, due.shift_code, due.shift_date, due.event_at
    FROM claimed
    JOIN due ON due.staff_id = claimed.staff_id AND due.kind = claimed.kind AND due.event_at = claimed.event_at
$$;

-- One-time setup, run by you in the SQL Editor after deploying the shift-reminders
-- function (safe to run again, e.g. with a new project URL):
--     SELECT public.setup_shift_reminders('https://your-project-ref.supabase.co');
-- Turns on pg_cron + pg_net, stores the URL and a fresh secret, and schedules the
-- every-minute call. To stop the schedule: SELECT cron.unschedule('cb-shift-reminders');
CREATE OR REPLACE FUNCTION public.setup_shift_reminders(p_project_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_url TEXT := rtrim(trim(coalesce(p_project_url, '')), '/');
BEGIN
    IF v_url !~ '^https://[^/]+$' THEN
        RAISE EXCEPTION 'Pass the project URL, e.g. https://your-project-ref.supabase.co';
    END IF;
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;

    INSERT INTO public.cb_cron_config (id, project_url, secret, updated_at)
    VALUES (1, v_url, encode(gen_random_bytes(32), 'hex'), NOW())
    ON CONFLICT (id) DO UPDATE
    SET project_url = EXCLUDED.project_url, secret = EXCLUDED.secret, updated_at = NOW();

    -- Same name again replaces the job
    PERFORM cron.schedule('cb-shift-reminders', '* * * * *', $job$
        SELECT net.http_post(
            url := (SELECT project_url FROM public.cb_cron_config WHERE id = 1) || '/functions/v1/shift-reminders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-cron-secret', (SELECT secret FROM public.cb_cron_config WHERE id = 1)),
            body := '{}'::jsonb,
            timeout_milliseconds := 30000
        )
    $job$);
    RETURN 'Shift reminders scheduled every minute: ' || v_url || '/functions/v1/shift-reminders';
END;
$$;

REVOKE ALL ON public.shift_reminders_sent, public.cb_cron_config FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_shift_reminders(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_shift_reminders(BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_shift_reminders(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shift_reminders(INT) TO service_role;
REVOKE ALL ON FUNCTION public.setup_shift_reminders(TEXT) FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cb_cron_config TO service_role;
GRANT SELECT, INSERT, DELETE ON public.shift_reminders_sent TO service_role;

-- ------------------------------------------------------------------------------
-- 8. CLAIM THE LEGACY FLEET (run by you in the SQL editor, never from the app)
-- ------------------------------------------------------------------------------
-- Moves every company, driver and activity that still belongs to the unclaimed
-- legacy team ('team-1') into the team of the given manager.
CREATE OR REPLACE FUNCTION public.claim_legacy_fleet(p_manager_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_team TEXT;
    n_comp INT;
    n_drv INT;
    n_act INT;
BEGIN
    SELECT team_id INTO v_team FROM public.staff_profiles
    WHERE lower(username) = lower(trim(p_manager_username)) AND role = 'manager' AND is_active;
    IF v_team IS NULL THEN
        RAISE EXCEPTION 'No active manager with username %', p_manager_username;
    END IF;
    IF v_team = 'team-1' THEN
        RAISE EXCEPTION 'That manager already owns the legacy team';
    END IF;

    UPDATE public.companies SET team_id = v_team, updated_at = NOW() WHERE team_id = 'team-1';
    GET DIAGNOSTICS n_comp = ROW_COUNT;
    UPDATE public.drivers SET team_id = v_team, updated_at = NOW() WHERE team_id = 'team-1';
    GET DIAGNOSTICS n_drv = ROW_COUNT;
    UPDATE public.activities SET team_id = v_team WHERE team_id = 'team-1';
    GET DIAGNOSTICS n_act = ROW_COUNT;

    RETURN format('Moved %s companies, %s drivers and %s activity records into team %s', n_comp, n_drv, n_act, v_team);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_legacy_fleet(TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 9. AFTER RUNNING THIS SCRIPT
-- ------------------------------------------------------------------------------
-- a) Authentication -> Sign In / Providers: turn OFF "Allow new users to sign up".
-- b) Open the app, click "Create a Team" and create your manager account.
-- c) Back here, move your existing fleet into that team (use your username):
--
--      SELECT public.claim_legacy_fleet('your-username');
--
-- PostgREST: refresh the API schema cache so the new functions are visible
NOTIFY pgrst, 'reload schema';
