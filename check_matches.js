const { supabaseAdmin } = require('./supabase.js');

async function checkMatches() {
    console.log('--- Checking latest event and its matches ---');

    // 1. Get the latest event
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

    // 2. Check squads
    const { data: squads, error: squadError } = await supabaseAdmin
        .from('event_squads')
        .select('*')
        .eq('event_id', latestEvent.id);

    console.log(`Squads found for event ${latestEvent.id}:`, squads ? squads.length : 0);

    // 3. Check matches
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
            console.log('First match sample:', matches[0]);
        } else {
            console.log('No matches found for this event. This means creation failed to insert matches.');
        }
    }
}

checkMatches();
