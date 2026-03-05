import { supabaseAdmin } from './supabase.js';

async function checkEntireTable() {
    console.log('--- Checking event_matches table status ---');
    try {
        const { count, error } = await supabaseAdmin
            .from('event_matches')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error counting matches:', error);
        } else {
            console.log('Total matches in table:', count);
        }

        const { data: latestMatches, error: matchError } = await supabaseAdmin
            .from('event_matches')
            .select('*, events(name)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (matchError) {
            console.error('Error fetching latest matches:', matchError);
        } else {
            console.log('Latest 5 matches:', JSON.stringify(latestMatches, null, 2));
        }
    } catch (e) {
        console.error('Script error:', e);
    }
}

checkEntireTable();
