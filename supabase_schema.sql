-- K-Survival Sports Club Supabase Schema (PostgreSQL)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    kakao_id BIGINT UNIQUE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'USER', -- ADMIN or USER
    level TEXT DEFAULT 'Scout',
    xp INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    mvp_count INTEGER DEFAULT 0,
    membership_type TEXT DEFAULT 'STANDARD',
    membership_expiry TIMESTAMP WITH TIME ZONE,
    titles TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Timeslots Table
CREATE TABLE IF NOT EXISTS timeslots (
    id SERIAL PRIMARY KEY,
    date TEXT,
    time_start TEXT,
    time_end TEXT,
    label TEXT,
    price INTEGER,
    capacity INTEGER,
    booked INTEGER DEFAULT 0,
    location TEXT,
    price_youth INTEGER,
    price_child INTEGER
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES timeslots(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING', -- PENDING, PAID, REFUNDED, NOSHOW
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    team_id TEXT, -- RED, BLUE
    squad_num INTEGER, -- 1 to 8
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missions Table
CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    title TEXT,
    xp_reward INTEGER,
    status TEXT
);

-- Rankings Table
CREATE TABLE IF NOT EXISTS rankings (
    id SERIAL PRIMARY KEY,
    category TEXT,
    name TEXT,
    score INTEGER,
    rank_info TEXT
);

);

-- Groups Table (Teams, Families, Dojos)
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- team, family, taekwondo
    score INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0, 
    draws INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members Table
CREATE TABLE IF NOT EXISTS group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- master, member
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Match Records Table (기록실)
CREATE TABLE IF NOT EXISTS match_records (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES timeslots(id) ON DELETE CASCADE,
    winning_team TEXT, -- RED, BLUE, DRAW
    red_score INTEGER DEFAULT 0,
    blue_score INTEGER DEFAULT 0,
    red_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    blue_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    mvp_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    photo_urls TEXT[], -- Array of image URLs
    match_report TEXT, -- Detailed notes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE,
    reward_xp INTEGER,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial Mock Data (Optional - run these manually in SQL Editor)
-- INSERT INTO users (name, level, xp, referrals) VALUES ('플레이어_원', '정찰병', 650, 2);
-- INSERT INTO timeslots (date, time_start, time_end, price, capacity, booked, location, price_youth, price_child)
-- VALUES 
-- ('3월 1일 (일)', '10:00', '12:00', 25000, 20, 5, '김포 메인 게이트 B', 20000, 15000),
-- ('3월 1일 (일)', '14:00', '16:00', 25000, 20, 18, '서울 고스트 존 A', 20000, 15000),
-- ('3월 1일 (일)', '18:00', '20:30', 20000, 32, 2, '하남 필드 C', 15000, 10000);
