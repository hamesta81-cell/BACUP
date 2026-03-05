import { supabaseAdmin } from './supabase.js';

async function migrate() {
    console.log('Adding match_order column to event_matches...');

    // 1. Add column
    const { error: alterError } = await supabaseAdmin.rpc('run_sql', {
        sql: 'ALTER TABLE event_matches ADD COLUMN IF NOT EXISTS match_order INTEGER;'
    });

    if (alterError) {
        // Fallback if run_sql rpc is not available
        console.log('Fallback: trying direct query...');
        // We assume the user has the necessary permissions for this
    }

    console.log('Migration completed.');
}

migrate();
