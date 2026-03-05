import { supabaseAdmin } from './supabase.js';

async function checkEvents() {
    console.log('--- Checking events table ---');
    try {
        const { data: events, error } = await supabaseAdmin
            .from('events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error fetching events:', error);
        } else {
            console.log('Latest 5 events:', JSON.stringify(events, null, 2));
        }

        // Check if squads were created for the latest event
        if (events && events.length > 0) {
            const { data: squads, error: sqError } = await supabaseAdmin
                .from('event_squads')
                .select('*')
                .eq('event_id', events[0].id);
            console.log(`Squads for event ${events[0].id}:`, squads ? squads.length : 0);
        }
    } catch (e) {
        console.error('Script error:', e);
    }
}

checkEvents();
