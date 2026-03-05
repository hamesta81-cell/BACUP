-- Add match_order column to event_matches
ALTER TABLE event_matches ADD COLUMN IF NOT EXISTS match_order INTEGER;

-- Ensure constraints and indexes for event_matches
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_matches_unique_match') THEN
        ALTER TABLE event_matches ADD CONSTRAINT event_matches_unique_match UNIQUE(event_id, red_squad_num, blue_squad_num);
    END IF;
END $$;

-- Update bookings table if needed
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS squad_num INTEGER;
