-- Migration: Add Win/Loss/Draw to Groups and Link Groups to Match Records

-- 1. Add W-L-D columns to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0;

-- 2. Add group references to match_records table
ALTER TABLE match_records ADD COLUMN IF NOT EXISTS red_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE match_records ADD COLUMN IF NOT EXISTS blue_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;

-- 3. Create RPC for atomic increments
CREATE OR REPLACE FUNCTION increment_group_stat(group_id INTEGER, column_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE groups SET %I = %I + 1 WHERE id = $1', column_name, column_name)
    USING group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
