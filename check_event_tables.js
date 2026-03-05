import { supabaseAdmin } from './supabase.js';

async function checkEventTables() {
    console.log('--- Checking Event-related Tables ---');

    const tables = ['events', 'event_squads', 'event_matches'];

    for (const table of tables) {
        const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
        if (error) {
            console.error(`[${table}] Error or Table not found:`, error.message);
        } else {
            console.log(`[${table}] OK (found ${data.length} rows or empty table)`);
        }
    }

    // Check bookings columns
    const { data: bookings, error: bErr } = await supabaseAdmin.from('bookings').select('*').limit(1);
    if (!bErr && bookings && bookings.length > 0) {
        console.log('Bookings columns:', Object.keys(bookings[0]));
    } else if (bErr) {
        console.error('Bookings check error:', bErr.message);
    }
}

checkEventTables();
