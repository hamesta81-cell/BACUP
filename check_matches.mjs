import { supabaseAdmin } from './supabase.js';

async function checkMatches() {
    console.log('--- Checking latest event and its matches ---');
    try {
        const { data: events, error: eventError } = await supabaseAdmin
            .from('events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (eventError) {
            console.error('Error fetching events:', eventError);
            return;
        }

        if (!events || events.length === 0) {
            console.log('No events found.');
            return;
        }

        const latestEvent = events[0];
        console.log('Latest Event ID:', latestEvent.id, 'Title:', latestEvent.title);

        const { data: matches, error: matchError } = await supabaseAdmin
            .from('event_matches')
            .select('*')
            .eq('event_id', latestEvent.id)
            .order('match_order', { ascending: true });

        if (matchError) {
            console.error('Error fetching matches:', matchError);
        } else {
            console.log(`Matches found for event ${latestEvent.id}:`, matches.length);
            if (matches.length > 0) {
                console.log('First match sample:', JSON.stringify(matches[0], null, 2));
            } else {
                console.log('No matches found for this event.');
            }
        }
    } catch (e) {
        console.error('Script error:', e);
    }
}

checkMatches();
