-- ==============================================================================
-- CHECKINGBOARD SUPABASE SCHEMA & INITIAL SEED
-- ==============================================================================
-- Copy and run this script in your Supabase Dashboard -> SQL Editor
-- This creates the tables, sets up real-time replication, and seeds sample data.
-- ==============================================================================

-- 1. Create Companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT DEFAULT '',
    order_index INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Drivers table
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    unit TEXT DEFAULT '',
    name TEXT NOT NULL,
    sign TEXT DEFAULT 'SIGNED',
    status TEXT DEFAULT 'READY',
    notes TEXT DEFAULT '',
    highlight_color TEXT DEFAULT '',
    order_index INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) and permit public read/write for dispatchers
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Allow public access (can be restricted with Supabase Auth if user accounts are added)
CREATE POLICY "Allow public read access to companies"
    ON public.companies FOR SELECT USING (true);

CREATE POLICY "Allow public insert to companies"
    ON public.companies FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to companies"
    ON public.companies FOR UPDATE USING (true);

CREATE POLICY "Allow public delete to companies"
    ON public.companies FOR DELETE USING (true);

CREATE POLICY "Allow public read access to drivers"
    ON public.drivers FOR SELECT USING (true);

CREATE POLICY "Allow public insert to drivers"
    ON public.drivers FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to drivers"
    ON public.drivers FOR UPDATE USING (true);

CREATE POLICY "Allow public delete to drivers"
    ON public.drivers FOR DELETE USING (true);

-- 4. Enable Realtime on both tables (so dispatchers see live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;

-- 5. Seed Initial Fleet Data from SAFETY_BOARD_dynamic.xlsx
INSERT INTO public.companies (id, name, note, order_index) VALUES
    ('comp-1', 'EVO ELD WENZE LLC', 'Fleet 1', 1),
    ('comp-2', 'AK carrier', 'FACTOR', 2),
    ('comp-3', 'AK carrier', 'LEADER', 3),
    ('comp-4', 'UZB TRUCKING', '', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.drivers (id, company_id, unit, name, sign, status, notes, highlight_color, order_index) VALUES
    ('drv-1', 'comp-1', '3447', 'BRUTUS STANLEY', 'NO SIGN', 'AT PU', '', '', 1),
    ('drv-2', 'comp-1', '1860', 'LUNAN KEDIAN', 'SIGNED', 'AT PU', '', '', 2),
    ('drv-3', 'comp-1', '101', 'SARDOR SODIK', 'SIGNED', 'AT PU', 'no RC number on profile', '#FEF08A', 3),
    ('drv-4', 'comp-1', '102', 'MOUZ TEDLA', 'SIGNED', 'AT PU', '', '', 4),
    ('drv-5', 'comp-1', '103', 'THIAM EL HADJI', 'SIGNED', 'AT PU', '', '', 5),
    ('drv-6', 'comp-1', '104', 'KAMOLIDDIN SHARIPOV', 'SIGNED', 'AT PU', 'Urgent check', '', 6),
    ('drv-7', 'comp-1', '105', 'WILLETT JOSEPH RAYKWON BARTLEY', 'SIGNED', 'AT DEL', '', '', 7),
    ('drv-8', 'comp-1', '106', 'ABDUNABIEV JAKHONGIR', 'NO SIGN', 'AT PU', '', '', 8),
    ('drv-9', 'comp-1', '107', 'DIENG OUMAR DAOUDA', 'SIGNED', 'AT PU', '', '', 9),
    ('drv-10', 'comp-1', '108', 'JEAN WALKENS', 'SIGNED', 'AT PU', 'Checked profile', '', 10),
    ('drv-11', 'comp-1', '109', 'UROZOLI TAJIBOEV', 'SIGNED', 'AT PU', '', '', 11),
    ('drv-12', 'comp-1', '110', 'ALI KAMAL JAMAL', 'SIGNED', 'AT PU', '', '', 12),
    ('drv-13', 'comp-1', '111', 'RALPH MICHEL', 'SIGNED', 'READY', '', '', 13),
    ('drv-14', 'comp-1', '112', 'NOEL EVENS', 'SIGNED', 'COVERED', '', '', 14),
    ('drv-15', 'comp-1', '113', 'ARTHUR JEAN RONY / AUGUSTE DOULENTZ', 'SIGNED', 'GOING DEL', '', '', 15),
    ('drv-16', 'comp-2', '122', 'MOUZ TEDLA', 'SIGNED', 'AT PU', '', '', 16),
    ('drv-17', 'comp-2', '123', 'MOUZ TEDLA', 'SIGNED', 'AT DEL', 'will leave in 1hour', '', 17),
    ('drv-18', 'comp-3', '124', 'MOUZ TEDLA', 'SIGNED', 'GOING DEL', '', '', 18),
    ('drv-19', 'comp-3', '125', 'MOUZ TEDLA', 'SIGNED', 'SHOP', 'def issue, will be ready tmrw', '#FED7AA', 19),
    ('drv-20', 'comp-4', '126', 'MOUZ TEDLA', 'SIGNED', 'READY', '', '', 20)
ON CONFLICT (id) DO NOTHING;
