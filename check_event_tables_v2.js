import { supabaseAdmin } from './supabase.js';

async function checkEventTables() {
    const tables = ['events', 'event_squads', 'event_matches', 'bookings'];

    for (const table of tables) {
        const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table [${table}]: ERROR - ${error.message}`);
        } else {
            console.log(`Table [${table}]: OK`);
            if (data.length > 0) {
                console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
            } else {
                // Try to get columns even if empty
                const { data: cols, error: colErr } = await supabaseAdmin.from(table).select('*').limit(0);
                // Supabase doesn't easily show columns for empty tables without data
                console.log(`  (Empty table)`);
            }
        }
    }
}

checkEventTables();
