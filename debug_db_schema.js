const { supabaseAdmin } = require('./supabase.js');

async function check() {
    console.log('--- Checking event_matches schema ---');
    const { data, error } = await supabaseAdmin
        .from('event_matches')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching event_matches:', error);
    } else if (data && data.length > 0) {
        console.log('Sample match data:', data[0]);
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No matches found in table.');
        // Try to insert a dummy match to see if it fails
        console.log('Attempting dummy insert...');
        const { error: insError } = await supabaseAdmin
            .from('event_matches')
            .insert({
                event_id: 1, // Assume exists or will fail with FK
                red_squad_num: 1,
                blue_squad_num: 2,
                match_order: 1
            });
        if (insError) {
            console.error('Insert failed:', insError.message);
            if (insError.message.includes('match_order')) {
                console.log('CONFIRMED: match_order column is missing.');
            }
        } else {
            console.log('Insert succeeded. match_order exists.');
        }
    }
}

check();
