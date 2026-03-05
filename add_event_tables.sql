-- 1. Events Table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT,
    location TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Event Squads Table
CREATE TABLE IF NOT EXISTS event_squads (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    squad_num INTEGER NOT NULL,
    name TEXT,
    group_id INTEGER, -- Optional link to permanent group
    UNIQUE(event_id, squad_num)
);

-- 3. Event Matches Table (Results)
CREATE TABLE IF NOT EXISTS event_matches (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    red_squad_num INTEGER NOT NULL,
    blue_squad_num INTEGER NOT NULL,
    red_score INTEGER DEFAULT 0,
    blue_score INTEGER DEFAULT 0,
    winning_squad_num INTEGER, -- 0 for draw, or squad_num
    mvp_user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add event_id to Bookings to link participants
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS squad_num INTEGER;

-- 5. Optional Indexing
CREATE INDEX IF NOT EXISTS idx_matches_event ON event_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id);
