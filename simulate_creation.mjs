import { supabaseAdmin } from './supabase.js';

async function simulateEventCreation() {
    const name = "Debug Event " + Date.now();
    const date = "2026-03-05";
    const location = "Debug Field";
    const squadCount = 8;

    console.log(`[Sim] Creating event: ${name} with ${squadCount} squads`);

    try {
        // 1. 대회 생성
        const { data: event, error: eventError } = await supabaseAdmin.from('events').insert({ name, date, location }).select().single();
        if (eventError) {
            console.error('[Sim] Event insert error:', eventError);
            return;
        }

        const eventId = event.id;
        console.log('[Sim] Event created:', eventId);

        // 2. 조(Squads) 자동 생성
        const squads = [];
        for (let i = 1; i <= squadCount; i++) {
            squads.push({ event_id: eventId, squad_num: i, name: `${i}조` });
        }
        const { error: squadError } = await supabaseAdmin.from('event_squads').insert(squads);
        if (squadError) {
            console.error('[Sim] Squads insert error:', squadError);
            return;
        }
        console.log('[Sim] Squads created');

        // 3. Round Robin 기반 경기 일정(Matches) 자동 생성
        const matches = [];
        const teams = Array.from({ length: squadCount }, (_, i) => i + 1);
        if (squadCount % 2 !== 0) teams.push(null);

        const numTeams = teams.length;
        const rounds = numTeams - 1;
        const half = numTeams / 2;

        for (let round = 0; round < rounds; round++) {
            for (let i = 0; i < half; i++) {
                const team1 = teams[i];
                const team2 = teams[numTeams - 1 - i];

                if (team1 !== null && team2 !== null) {
                    matches.push({
                        event_id: eventId,
                        red_squad_num: team1,
                        blue_squad_num: team2,
                        red_score: 0,
                        blue_score: 0,
                        winning_squad_num: null,
                        match_order: matches.length + 1
                    });
                }
            }
            teams.splice(1, 0, teams.pop());
        }

        console.log(`[Sim] Generated ${matches.length} matches`);

        if (matches.length > 0) {
            const { error: matchError } = await supabaseAdmin.from('event_matches').insert(matches);
            if (matchError) {
                console.error('[Sim] Matches insert error:', matchError);
            } else {
                console.log('[Sim] Matches inserted successfully');
            }
        }
    } catch (e) {
        console.error('[Sim] Unexpected error:', e);
    }
}

simulateEventCreation();
