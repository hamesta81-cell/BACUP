-- LaserTag Growth Booking System Schema v1.0

-- 1. 예약 코어 (Booking Core)
CREATE TABLE IF NOT EXISTS Timeslots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER DEFAULT 32,
    price_internal INTEGER DEFAULT 15000,
    price_external INTEGER DEFAULT 25000,
    status TEXT DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS Bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timeslot_id INTEGER NOT NULL,
    qty INTEGER DEFAULT 1,
    member_type TEXT CHECK(member_type IN ('internal', 'external')),
    status TEXT CHECK(status IN ('held', 'paid', 'attended', 'canceled', 'no_show')) DEFAULT 'held',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (timeslot_id) REFERENCES Timeslots(id)
);

-- 2. 게임화 코어 (Gamification Core)
CREATE TABLE IF NOT EXISTS UserStats (
    user_id TEXT PRIMARY KEY,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    referral_success_count INTEGER DEFAULT 0,
    attended_count INTEGER DEFAULT 0,
    last_attended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS XpLedger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    source TEXT NOT NULL, -- 'checkin', 'referral', 'mission'
    ref_type TEXT,
    ref_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PerkWallet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    perk_type TEXT NOT NULL, -- 'priority_booking', 'hold_token'
    qty INTEGER DEFAULT 0,
    expires_at TIMESTAMP
);

-- 3. 전환 코어 (Conversion Core)
CREATE TABLE IF NOT EXISTS Referrals (
    ref_code TEXT PRIMARY KEY,
    inviter_user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ReferralAttribution (
    referred_user_id TEXT PRIMARY KEY,
    inviter_user_id TEXT NOT NULL,
    first_touch_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    qualified_at TIMESTAMP -- check-in 시점
);

-- 초기 데이터 삽입 (테스트용)
INSERT INTO Timeslots (venue_id, date, start_time, end_time, status) VALUES 
('GANGNAM_01', '2026-02-28', '14:00', '16:30', 'OPEN'),
('GANGNAM_01', '2026-02-28', '19:00', '21:30', 'OPEN');

INSERT INTO UserStats (user_id, total_xp, level) VALUES ('PH001', 650, 2);
