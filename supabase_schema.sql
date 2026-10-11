-- ==============================================================================
-- CHECKINGBOARD SUPABASE SCHEMA & FLEET SEED
-- ==============================================================================
-- Copy and run this script in your Supabase Dashboard -> SQL Editor
-- This creates tables, configures Realtime replication, and seeds the fleet roster.
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

-- 4. Enable Realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;

-- 5. Seed Companies (10 Carrier Groups)
INSERT INTO public.companies (id, name, note, order_index) VALUES
    ('comp-1', 'INFINITY LOGISTEX LLC', '', 1),
    ('comp-2', 'RUZBEK LOGISTICS INC', '', 2),
    ('comp-3', 'AK CARRIER LLC', 'FACTOR', 3),
    ('comp-4', 'AK CARRIER LLC', 'LEADER', 4),
    ('comp-5', 'UMAR INC LLC', 'TT ELD', 5),
    ('comp-6', 'UZB TRUCKING LLC', 'LEADER ELD', 6),
    ('comp-7', 'UZB TRUCKING LLC', 'FACTOR ELD', 7),
    ('comp-8', 'CARGO KINGS INC', '', 8),
    ('comp-9', 'BIG LIFE LOGISTICS', '', 9),
    ('comp-10', 'MKM GLOBAL INC', '', 10)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    note = EXCLUDED.note,
    order_index = EXCLUDED.order_index;

-- 6. Seed Drivers (194 Active Fleet Drivers)
INSERT INTO public.drivers (id, company_id, unit, name, sign, status, notes, highlight_color, order_index) VALUES
    ('drv-1', 'comp-1', '', 'Pervez Adnan', 'SIGNED', 'READY', '', '', 1),
    ('drv-2', 'comp-1', '', 'Shamirzaev Shohmirzo', 'SIGNED', 'READY', '', '', 2),
    ('drv-3', 'comp-1', '', 'Nisbett Jakirth Anthony', 'SIGNED', 'READY', '', '', 3),
    ('drv-4', 'comp-1', '', 'SHIRULLAH ZAMRAI', 'SIGNED', 'READY', '', '', 4),
    ('drv-5', 'comp-1', '', 'Parmanov Rinat', 'SIGNED', 'READY', '', '', 5),
    ('drv-6', 'comp-1', '', 'Ikromjon Shodiyorov', 'SIGNED', 'READY', '', '', 6),
    ('drv-7', 'comp-1', '', 'Waliullah Waladeen/ Ghaizullah Karwan', 'SIGNED', 'READY', '', '', 7),
    ('drv-8', 'comp-2', '', 'Khurshid Abdullaev', 'SIGNED', 'READY', '', '', 8),
    ('drv-9', 'comp-2', '', 'Farkhod Usmonov', 'SIGNED', 'READY', '', '', 9),
    ('drv-10', 'comp-2', '', 'Ibrokhim Bozorov', 'SIGNED', 'READY', '', '', 10),
    ('drv-11', 'comp-2', '', 'Khujaev Ruzimboy', 'SIGNED', 'READY', '', '', 11),
    ('drv-12', 'comp-3', '', 'Ikhtiyor Sharipov', 'SIGNED', 'READY', '', '', 12),
    ('drv-13', 'comp-3', '', 'Daniel Ndayisba', 'SIGNED', 'READY', '', '', 13),
    ('drv-14', 'comp-3', '', 'MUNGUIKO FREDERICK GAFARANGA', 'SIGNED', 'READY', '', '', 14),
    ('drv-15', 'comp-3', '', 'JOKHONGIR SAFAROV', 'SIGNED', 'READY', '', '', 15),
    ('drv-16', 'comp-3', '', 'Ezekiel Nkezabera', 'SIGNED', 'READY', '', '', 16),
    ('drv-17', 'comp-3', '', 'Siroj Nazarkosimov', 'SIGNED', 'READY', '', '', 17),
    ('drv-18', 'comp-3', '', 'GAFISHI EMMANUEL', 'SIGNED', 'READY', '', '', 18),
    ('drv-19', 'comp-3', '', 'MUGISHA EMILE', 'SIGNED', 'READY', '', '', 19),
    ('drv-20', 'comp-4', '', 'RONALD ARCHILLE', 'SIGNED', 'READY', '', '', 20),
    ('drv-21', 'comp-4', '', 'INNOCENT RUBONEZA', 'SIGNED', 'READY', '', '', 21),
    ('drv-22', 'comp-4', '', 'Elie Nkikabahizi', 'SIGNED', 'READY', '', '', 22),
    ('drv-23', 'comp-4', '', 'Jean Wilbens Bouquette', 'SIGNED', 'READY', '', '', 23),
    ('drv-24', 'comp-4', '', 'Erkinov Asilbek/ Sindarov Olimjon', 'SIGNED', 'READY', '', '', 24),
    ('drv-25', 'comp-4', '', 'Joshara Jashaunae Joneria Harris', 'SIGNED', 'READY', '', '', 25),
    ('drv-26', 'comp-4', '', 'Johnson Daquan Markel', 'SIGNED', 'READY', '', '', 26),
    ('drv-27', 'comp-4', '', 'BROWN DE'' VUNTEA DARNELL', 'SIGNED', 'READY', '', '', 27),
    ('drv-28', 'comp-4', '', 'Dameus Augunste Jean Wilner', 'SIGNED', 'READY', '', '', 28),
    ('drv-29', 'comp-4', '', 'Simon Jean Eddy', 'SIGNED', 'READY', '', '', 29),
    ('drv-30', 'comp-4', '', 'SHEKHROZ SHAMSIEV', 'SIGNED', 'READY', '', '', 30),
    ('drv-31', 'comp-4', '', 'UMRZOK ALLAEROV', 'SIGNED', 'READY', '', '', 31),
    ('drv-32', 'comp-4', '', 'NORBOYEV ZOKHIDJON', 'SIGNED', 'READY', '', '', 32),
    ('drv-33', 'comp-4', '', 'CLEMENT BABONAMPOZE', 'SIGNED', 'READY', '', '', 33),
    ('drv-34', 'comp-4', '', 'AYDRUS MOHAMED AHMED', 'SIGNED', 'READY', '', '', 34),
    ('drv-35', 'comp-4', '', 'WIDLOR EDOUARD', 'SIGNED', 'READY', '', '', 35),
    ('drv-36', 'comp-4', '', 'SALLAM HESHAM', 'SIGNED', 'READY', '', '', 36),
    ('drv-37', 'comp-4', '', 'Kikinadze Kamil Y', 'SIGNED', 'READY', '', '', 37),
    ('drv-38', 'comp-4', '', 'KHOLBUTOEV SHOKHRUKH', 'SIGNED', 'READY', '', '', 38),
    ('drv-39', 'comp-4', '', 'MAZARD RELPH', 'SIGNED', 'READY', '', '', 39),
    ('drv-40', 'comp-4', '', 'SALAH ZERROUALI', 'SIGNED', 'READY', '', '', 40),
    ('drv-41', 'comp-4', '', 'YVENS BAZILE', 'SIGNED', 'READY', '', '', 41),
    ('drv-42', 'comp-4', '', 'NNAEMEKA CHARLES AMUNEKE', 'SIGNED', 'READY', '', '', 42),
    ('drv-43', 'comp-4', '', 'Teweldemehin Temesgen G', 'SIGNED', 'READY', '', '', 43),
    ('drv-44', 'comp-4', '', 'OLIVIER MUGISHA', 'SIGNED', 'READY', '', '', 44),
    ('drv-45', 'comp-4', '', 'Innocent Mfitumukiza', 'SIGNED', 'READY', '', '', 45),
    ('drv-46', 'comp-4', '', 'Baby Charles', 'SIGNED', 'READY', '', '', 46),
    ('drv-47', 'comp-4', '', 'Wallace Bradford Brian', 'SIGNED', 'READY', '', '', 47),
    ('drv-48', 'comp-4', '', 'Milord Olguine', 'SIGNED', 'READY', '', '', 48),
    ('drv-49', 'comp-4', '', 'Jamshidjon Rakhmonov', 'SIGNED', 'READY', '', '', 49),
    ('drv-50', 'comp-4', '', 'Sanders Quadir-almalik Monroe', 'SIGNED', 'READY', '', '', 50),
    ('drv-51', 'comp-4', '', 'Hakizimana Promise', 'SIGNED', 'READY', '', '', 51),
    ('drv-52', 'comp-4', '', 'Jonathan Edwards', 'SIGNED', 'READY', '', '', 52),
    ('drv-53', 'comp-4', '', 'Tuyisenge Patrick Bajoje', 'SIGNED', 'READY', '', '', 53),
    ('drv-54', 'comp-4', '', 'Rukaza Jean Bosco', 'SIGNED', 'READY', '', '', 54),
    ('drv-55', 'comp-4', '', 'Sejour Jasnel', 'SIGNED', 'READY', '', '', 55),
    ('drv-56', 'comp-4', '', 'Manzi Ibrahim Dalas', 'SIGNED', 'READY', '', '', 56),
    ('drv-57', 'comp-4', '', 'Bizimungu Kalihungu/Kabose Dasan', 'SIGNED', 'READY', '', '', 57),
    ('drv-58', 'comp-4', '', 'Joshua  Lee Wells', 'SIGNED', 'READY', '', '', 58),
    ('drv-59', 'comp-4', '', 'Islombek Tirkashev', 'SIGNED', 'READY', '', '', 59),
    ('drv-60', 'comp-4', '', 'Esengo Kanyoni', 'SIGNED', 'READY', '', '', 60),
    ('drv-61', 'comp-4', '', 'Jackson Letarvis William Demel', 'SIGNED', 'READY', '', '', 61),
    ('drv-62', 'comp-4', '', 'Prince Ngoga', 'SIGNED', 'READY', '', '', 62),
    ('drv-63', 'comp-4', '', 'Jeremy Zapata', 'SIGNED', 'READY', '', '', 63),
    ('drv-64', 'comp-4', '', 'SANJAR GAYBULLAEV/ Islombek Tirkashev', 'SIGNED', 'READY', '', '', 64),
    ('drv-65', 'comp-4', '', 'BALDE THIERNO DAOUDA', 'SIGNED', 'READY', '', '', 65),
    ('drv-66', 'comp-4', '', 'Gallardo Salomon', 'SIGNED', 'READY', '', '', 66),
    ('drv-67', 'comp-5', '', 'Rostyslav Vorontsov', 'SIGNED', 'READY', 'boxtruck', '', 67),
    ('drv-68', 'comp-5', '', 'ALLAEV BAKHTIYOR', 'SIGNED', 'READY', 'SHIFT inform tashlela !', '', 68),
    ('drv-69', 'comp-5', '', 'Ilyosbek Sobirov', 'SIGNED', 'READY', '', '', 69),
    ('drv-70', 'comp-5', '', 'Farhad Fattahli', 'SIGNED', 'READY', '', '', 70),
    ('drv-71', 'comp-5', '', 'Yorkin Erkinovich Ishanov', 'SIGNED', 'READY', '', '', 71),
    ('drv-72', 'comp-5', '', 'Omonov Musurmonkul', 'SIGNED', 'READY', '', '', 72),
    ('drv-73', 'comp-5', '', 'SALOMOV BOBIR', 'SIGNED', 'READY', '', '', 73),
    ('drv-74', 'comp-5', '', 'Abdujabbor Abdurakhmanov', 'SIGNED', 'READY', '', '', 74),
    ('drv-75', 'comp-5', '', 'MAMATKULOV ISKANDAR', 'SIGNED', 'READY', '', '', 75),
    ('drv-76', 'comp-5', '', 'MIRZAMURODOV SALIM', 'SIGNED', 'READY', '', '', 76),
    ('drv-77', 'comp-5', '', 'Shuhrat Eshonqulov', 'SIGNED', 'READY', '', '', 77),
    ('drv-78', 'comp-5', '', 'RAKHMONOV DILMUROD', 'SIGNED', 'READY', '', '', 78),
    ('drv-79', 'comp-5', '', 'AKHMEDOV SHAVKAT', 'SIGNED', 'READY', '', '', 79),
    ('drv-80', 'comp-5', '', 'ULMASOV ORZU', 'SIGNED', 'READY', '', '', 80),
    ('drv-81', 'comp-5', '', 'JAMOLIDDINOV ABDURAZZOK', 'SIGNED', 'READY', '', '', 81),
    ('drv-82', 'comp-5', '', 'Najieb Rahimi', 'SIGNED', 'READY', '', '', 82),
    ('drv-83', 'comp-5', '', 'ALEXANDRE WILTON', 'SIGNED', 'READY', '', '', 83),
    ('drv-84', 'comp-5', '', 'Zaynutdinov Uktamjon', 'SIGNED', 'READY', '', '', 84),
    ('drv-85', 'comp-5', '', 'Hakimov Anvarjon', 'SIGNED', 'READY', '', '', 85),
    ('drv-86', 'comp-5', '', 'Dilmurodkhuja', 'SIGNED', 'READY', '', '', 86),
    ('drv-87', 'comp-5', '', 'Sadullaev Sadi', 'SIGNED', 'READY', '', '', 87),
    ('drv-88', 'comp-5', '', 'Khumoyun Valijonov / Mansur Ikramov', 'SIGNED', 'READY', '', '', 88),
    ('drv-89', 'comp-5', '', 'TOKHIRJONOV ANVAR', 'SIGNED', 'READY', 'terpila', '', 89),
    ('drv-90', 'comp-5', '', 'DJAYNAROV DOSTON', 'SIGNED', 'READY', '', '', 90),
    ('drv-91', 'comp-5', '', 'ZUNNUNOV ASQAR', 'SIGNED', 'READY', '', '', 91),
    ('drv-92', 'comp-5', '', 'MOSSADEK YOUNES MARCO', 'SIGNED', 'READY', '', '', 92),
    ('drv-93', 'comp-5', '', 'ILKHOM TUYCHIEV', 'SIGNED', 'READY', '', '', 93),
    ('drv-94', 'comp-5', '', 'BADALBAEV DILMUROD', 'SIGNED', 'READY', '', '', 94),
    ('drv-95', 'comp-5', '', 'KHUSEYNOV FIRDAVS', 'SIGNED', 'READY', '', '', 95),
    ('drv-96', 'comp-5', '', 'KHASANOV MUSINJON', 'SIGNED', 'READY', '', '', 96),
    ('drv-97', 'comp-5', '', 'HERVE ALINDOR', 'SIGNED', 'READY', '', '', 97),
    ('drv-98', 'comp-5', '', 'NKUNZI KUMWIANI', 'SIGNED', 'READY', 'UMAR EX', '', 98),
    ('drv-99', 'comp-5', '', 'ESANOV ULUGBEK', 'SIGNED', 'READY', '', '', 99),
    ('drv-100', 'comp-5', '', 'Jewel Simmons', 'SIGNED', 'READY', '', '', 100),
    ('drv-101', 'comp-5', '', 'ABLAEV NODIR', 'SIGNED', 'READY', '', '', 101),
    ('drv-102', 'comp-5', '', 'BANKS ANTAWAN DAVID', 'SIGNED', 'READY', '', '', 102),
    ('drv-103', 'comp-5', '', 'HAKIMOV ELDOR', 'SIGNED', 'READY', 'SHIFT inform tashlela !', '', 103),
    ('drv-104', 'comp-5', '', 'PARDIEV ABDUKHALIL', 'SIGNED', 'READY', '', '', 104),
    ('drv-105', 'comp-5', '', 'KHALKHODJAEV RUSTAM', 'SIGNED', 'READY', '', '', 105),
    ('drv-106', 'comp-5', '', 'Alisher Abduraimov', 'SIGNED', 'READY', '', '', 106),
    ('drv-107', 'comp-5', '', 'BADALBAEV DILMUROD', 'SIGNED', 'READY', '', '', 107),
    ('drv-108', 'comp-5', '', 'EDWARD GAINES', 'SIGNED', 'READY', '', '', 108),
    ('drv-109', 'comp-5', '', 'Alex Awoke', 'SIGNED', 'READY', '', '', 109),
    ('drv-110', 'comp-6', '', 'Sirojiddin Valiyev', 'SIGNED', 'READY', '', '', 110),
    ('drv-111', 'comp-6', '', 'Johnson Jeremiah Leon', 'SIGNED', 'READY', '', '', 111),
    ('drv-112', 'comp-6', '', 'Brahim Berrehail', 'SIGNED', 'READY', '', '', 112),
    ('drv-113', 'comp-6', '', 'Kodirov Khumoyunbek', 'SIGNED', 'READY', '', '', 113),
    ('drv-114', 'comp-6', '', 'Abduvokhid Ganiev', 'SIGNED', 'READY', '', '', 114),
    ('drv-115', 'comp-6', '', 'Jahlil Levon Blount Wiley Elwood Welch', 'SIGNED', 'READY', '', '', 115),
    ('drv-116', 'comp-6', '', 'GAFFAROV BOBIRBEK', 'SIGNED', 'READY', '', '', 116),
    ('drv-117', 'comp-6', '', 'Fahriddin Bazarbayev', 'SIGNED', 'READY', '', '', 117),
    ('drv-118', 'comp-6', '', 'AHMAD SHATORION BURTON', 'SIGNED', 'READY', '', '', 118),
    ('drv-119', 'comp-6', '', 'Shokhrukh Niyazov', 'SIGNED', 'READY', '', '', 119),
    ('drv-120', 'comp-6', '', 'Pulatov Khojakbarkhon', 'SIGNED', 'READY', '', '', 120),
    ('drv-121', 'comp-6', '', 'Abdulrahman Abdullah Alsalimi', 'SIGNED', 'READY', '', '', 121),
    ('drv-122', 'comp-6', '', 'Barron Destin Rex', 'SIGNED', 'READY', '', '', 122),
    ('drv-123', 'comp-6', '', 'Hirwa Claude', 'SIGNED', 'READY', '', '', 123),
    ('drv-124', 'comp-6', '', 'Zirak Nasib Khan', 'SIGNED', 'READY', '', '', 124),
    ('drv-125', 'comp-6', '', 'Said Iqbal Sadat / Zangi Khan', 'SIGNED', 'READY', '', '', 125),
    ('drv-126', 'comp-6', '', 'Begijon Khakkulov', 'SIGNED', 'READY', '', '', 126),
    ('drv-127', 'comp-6', '', 'Turakhonov Bahodir Asrorjon Oripov', 'SIGNED', 'READY', '', '', 127),
    ('drv-128', 'comp-6', '', 'Irgashev Ulugbek', 'SIGNED', 'READY', '', '', 128),
    ('drv-129', 'comp-6', '', 'Azizov Zokirjon', 'SIGNED', 'READY', '', '', 129),
    ('drv-130', 'comp-6', '', 'MAKHMUDOV JAVOKHIR', 'SIGNED', 'READY', '', '', 130),
    ('drv-131', 'comp-6', '', 'ZOKHIDOV MUKHAMMADALI', 'SIGNED', 'READY', '', '', 131),
    ('drv-132', 'comp-6', '', 'TOSHBOEV MIRSAID', 'SIGNED', 'READY', '', '', 132),
    ('drv-133', 'comp-6', '', 'MIRMUKHSIN KHUDOYBERDIEV', 'SIGNED', 'READY', '', '', 133),
    ('drv-134', 'comp-6', '', 'NEGMATOV GAYBILLO,UGLI', 'SIGNED', 'READY', '', '', 134),
    ('drv-135', 'comp-6', '', 'IBRAGIMOV JAKHONGIR JAFAROVICH', 'SIGNED', 'READY', '', '', 135),
    ('drv-136', 'comp-6', '', 'KHAYITOV JAMSHID', 'SIGNED', 'READY', '', '', 136),
    ('drv-137', 'comp-6', '', 'CASTON JONATHAN LAMAR,JR', 'SIGNED', 'READY', '', '', 137),
    ('drv-138', 'comp-6', '', 'KODIROV ABUBAKR', 'SIGNED', 'READY', '', '', 138),
    ('drv-139', 'comp-6', '', 'KUVONDIKOV AKTAM', 'SIGNED', 'READY', '', '', 139),
    ('drv-140', 'comp-6', '', 'BARATOV MARUF', 'SIGNED', 'READY', '', '', 140),
    ('drv-141', 'comp-6', '', 'TAREK', 'SIGNED', 'READY', '', '', 141),
    ('drv-142', 'comp-6', '', 'PIRMIKULOV SHERZOD', 'SIGNED', 'READY', '', '', 142),
    ('drv-143', 'comp-7', '', 'Akrom Aliev', 'SIGNED', 'READY', '', '', 143),
    ('drv-144', 'comp-7', '', 'Yusupov Dilshodjon', 'SIGNED', 'READY', '', '', 144),
    ('drv-145', 'comp-7', '', 'Jabborov Rashid', 'SIGNED', 'READY', '', '', 145),
    ('drv-146', 'comp-7', '', 'Tuyiramye Reponse', 'SIGNED', 'READY', '', '', 146),
    ('drv-147', 'comp-7', '', 'IRGASHEV ILKHOM', 'SIGNED', 'READY', '', '', 147),
    ('drv-148', 'comp-7', '', 'ASLONOV SHAMSHODJON', 'SIGNED', 'READY', '', '', 148),
    ('drv-149', 'comp-7', '', 'ORIPOV ANVAR', 'SIGNED', 'READY', '', '', 149),
    ('drv-150', 'comp-7', '', 'RAKHMATDJANOV BEKZOD', 'SIGNED', 'READY', '', '', 150),
    ('drv-151', 'comp-7', '', 'KADIROV NODIRJON', 'SIGNED', 'READY', '', '', 151),
    ('drv-152', 'comp-7', '', 'SHAKHZODBEK SAIDOV', 'SIGNED', 'READY', '', '', 152),
    ('drv-153', 'comp-7', '', 'SHAKHZODBEK SAIDOV', 'SIGNED', 'READY', '', '', 153),
    ('drv-154', 'comp-7', '', 'ABDURAHMONOV AHMAD', 'SIGNED', 'READY', '', '', 154),
    ('drv-155', 'comp-7', '', 'TEMUR/RUSLAN', 'SIGNED', 'READY', '', '', 155),
    ('drv-156', 'comp-7', '', 'XOLBOYEV FIRDAVS', 'SIGNED', 'READY', '', '', 156),
    ('drv-157', 'comp-7', '', 'YODGORBEK/AKRAM', 'SIGNED', 'READY', '', '', 157),
    ('drv-158', 'comp-8', '', 'Suhrob Radjabov', 'SIGNED', 'READY', '', '', 158),
    ('drv-159', 'comp-8', '', 'CAMPOS SERGIO', 'SIGNED', 'READY', 'terpila', '', 159),
    ('drv-160', 'comp-8', '', 'Ali Zakariya Ahmed', 'SIGNED', 'READY', '', '', 160),
    ('drv-161', 'comp-8', '', 'Jumabek Nazarov', 'SIGNED', 'READY', '', '', 161),
    ('drv-162', 'comp-8', '', 'Dahal Om Krishna', 'SIGNED', 'READY', '', '', 162),
    ('drv-163', 'comp-8', '', 'Khalilov Azamat Abdukarimovich', 'SIGNED', 'READY', '', '', 163),
    ('drv-164', 'comp-8', '', 'Sattarov Bakhrom', 'SIGNED', 'READY', '', '', 164),
    ('drv-165', 'comp-8', '', 'Yuma Kabala', 'SIGNED', 'READY', '', '', 165),
    ('drv-166', 'comp-8', '', 'Tursunov Ikrom', 'SIGNED', 'READY', '', '', 166),
    ('drv-167', 'comp-8', '', 'Dilshod Zayniev', 'SIGNED', 'READY', '', '', 167),
    ('drv-168', 'comp-8', '', 'Firdavs Allanazarov', 'SIGNED', 'READY', '', '', 168),
    ('drv-169', 'comp-8', '', 'RAKHMANOV SHOKHRUKH', 'SIGNED', 'READY', '', '', 169),
    ('drv-170', 'comp-9', '', 'WILLIAM BREWINGTON', 'SIGNED', 'READY', '', '', 170),
    ('drv-171', 'comp-9', '', 'ANTHONY / CHRISTOPHER', 'SIGNED', 'READY', '', '', 171),
    ('drv-172', 'comp-9', '898', 'JEAN JOACHIM', 'SIGNED', 'READY', '', '', 172),
    ('drv-173', 'comp-9', '', 'KERRY / LuCETTE', 'SIGNED', 'READY', '', '', 173),
    ('drv-174', 'comp-9', '142', 'ROBINSON MALIK / MARCUS', 'SIGNED', 'READY', '', '', 174),
    ('drv-175', 'comp-9', '', 'Michelet Jeanlys', 'SIGNED', 'READY', '', '', 175),
    ('drv-176', 'comp-9', '27092', 'JACQUES BRYAN /  Jasmine Breona Hopson', 'SIGNED', 'READY', '', '', 176),
    ('drv-177', 'comp-9', '143', 'Lazizjon Niyazov/Kodirjon Djuraev', 'SIGNED', 'READY', '', '', 177),
    ('drv-178', 'comp-9', '27127', 'Jerry Raymond', 'SIGNED', 'READY', '', '', 178),
    ('drv-179', 'comp-9', '27162', 'Gaynell C Carter/John Willis Morris', 'SIGNED', 'READY', '', '', 179),
    ('drv-180', 'comp-9', '308', 'Jonathan Koonce/ Bernard Anthony Brooks', 'SIGNED', 'READY', '', '', 180),
    ('drv-181', 'comp-9', '894', 'Jolissaint Pierre/Weston Dieujuste', 'SIGNED', 'READY', '', '', 181),
    ('drv-182', 'comp-9', '27093', 'PETTIS DONYELL / NICHOLAS', 'SIGNED', 'READY', '', '', 182),
    ('drv-183', 'comp-9', '', 'DALLAS UZZIAH', 'SIGNED', 'READY', '', '', 183),
    ('drv-184', 'comp-9', '', 'Gedion Melese', 'SIGNED', 'READY', '', '', 184),
    ('drv-185', 'comp-9', '', 'FRITZNEL JEAN LOUIS', 'SIGNED', 'READY', '', '', 185),
    ('drv-186', 'comp-9', '', 'JEAN GUITHO', 'SIGNED', 'READY', '', '', 186),
    ('drv-187', 'comp-9', '', 'GEORGES WIKSON / PATRICK', 'SIGNED', 'READY', '', '', 187),
    ('drv-188', 'comp-9', '', 'IGOR LUTSIV', 'SIGNED', 'READY', '', '', 188),
    ('drv-189', 'comp-9', '', 'STANLEY DORZIER', 'SIGNED', 'READY', '', '', 189),
    ('drv-190', 'comp-9', '', 'Jean Leferne Ilerzin', 'SIGNED', 'READY', '', '', 190),
    ('drv-191', 'comp-9', '', 'JEAN ODENY DEMOSTHENE', 'SIGNED', 'READY', '', '', 191),
    ('drv-192', 'comp-9', '', 'Andrew George Turnbough Iii', 'SIGNED', 'READY', '', '', 192),
    ('drv-193', 'comp-9', '', 'FISTIN MEDE / NICK', 'SIGNED', 'READY', '', '', 193),
    ('drv-194', 'comp-10', '', 'Khusenov Khafiz', 'SIGNED', 'READY', '', '', 194)
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    unit = EXCLUDED.unit,
    name = EXCLUDED.name,
    sign = EXCLUDED.sign,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    highlight_color = EXCLUDED.highlight_color,
    order_index = EXCLUDED.order_index;
