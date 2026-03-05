import { supabaseAdmin } from './supabase.js';

async function checkEvent13() {
    console.log('--- Checking event 13 matches ---');
    try {
        const { data: matches, error } = await supabaseAdmin
            .from('event_matches')
            .select('*')
            .eq('event_id', 13);

        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Matches for event 13:', matches.length);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkEvent13();
