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

-- Everyone in the team reads and edits companies / drivers;
-- only managers add or remove them.
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

CREATE POLICY "Managers add drivers"
    ON public.drivers FOR INSERT TO authenticated
    WITH CHECK (
        team_id = public.current_team_id()
        AND public.is_team_manager()
        AND EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_id AND c.team_id = public.current_team_id()
        )
    );

CREATE POLICY "Managers remove drivers"
    ON public.drivers FOR DELETE TO authenticated
    USING (team_id = public.current_team_id() AND public.is_team_manager());

-- Staff read only their own records; managers read the whole team
CREATE POLICY "Staff read own activities, managers read team"
    ON public.activities FOR SELECT TO authenticated
    USING (
        team_id = public.current_team_id()
        AND (staff_user_id = auth.uid()::text OR public.is_team_manager())
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
-- Shifts run on Tashkent time (UTC+5, no daylight saving):
--   MORNING 07:00-15:00, AFTERNOON 13:00-23:00, NIGHT 23:00-07:00
-- An action is credited to the shift its author is assigned to; someone with no
-- assigned shift is placed by the clock (the 13:00-15:00 overlap counts as MORNING).
-- The work day is the Tashkent date the shift starts on, so a NIGHT shift that
-- runs past midnight still belongs to the day it began.
CREATE OR REPLACE FUNCTION public.cb_shift_of(p_at TIMESTAMPTZ, p_assigned TEXT DEFAULT NULL)
RETURNS TABLE (shift_code TEXT, shift_date DATE)
LANGUAGE sql STABLE
AS $$
    WITH t AS (
        SELECT p_at AT TIME ZONE 'Asia/Tashkent' AS local_ts,
               extract(hour FROM p_at AT TIME ZONE 'Asia/Tashkent')::int AS h
    ), s AS (
        SELECT local_ts, h,
               coalesce(p_assigned, CASE
                   WHEN h >= 7 AND h < 15 THEN 'MORNING'
                   WHEN h >= 15 AND h < 23 THEN 'AFTERNOON'
                   ELSE 'NIGHT'
               END) AS code
        FROM t
    )
    SELECT code, local_ts::date - CASE WHEN code = 'NIGHT' AND h < 12 THEN 1 ELSE 0 END
    FROM s
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
            FROM public.cb_shift_of(coalesce(NEW.action_at, NOW())) s;
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
    FROM public.cb_shift_of(NOW(), me.shift_code) s;
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

-- Records from before shifts existed: place them by the clock
UPDATE public.activities a
SET (shift_code, shift_date) = (SELECT s.shift_code, s.shift_date FROM public.cb_shift_of(a.action_at) s)
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
    UPDATE public.staff_profiles SET is_active = p_active, updated_at = NOW() WHERE id = p_staff_id;
    -- Block (or unblock) the login itself; history is never touched
    UPDATE auth.users
    SET banned_until = CASE WHEN p_active THEN NULL ELSE NOW() + INTERVAL '100 years' END,
        updated_at = NOW()
    WHERE id::text = p_staff_id;
    IF NOT p_active THEN
        DELETE FROM auth.sessions WHERE user_id::text = p_staff_id;
    END IF;
END;
$$;

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
-- At most 2 people per shift, one shift per person; anyone left out is unassigned.
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
        IF cardinality(v_ids) > 2 THEN
            RAISE EXCEPTION 'Each shift can have at most 2 staff';
        END IF;
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
