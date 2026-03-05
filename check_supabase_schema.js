
import { supabaseAdmin } from './supabase.js';

async function checkSupabase() {
    console.log('--- Checking timeslots table ---');
    const { data, error } = await supabaseAdmin.from('timeslots').select('*').limit(1);

    if (error) {
        console.error('Error fetching timeslots:', error.message);
        console.error('Hint: The table might be missing or columns like "label" might not exist yet.');
    } else {
        console.log('Timeslot columns:', Object.keys(data[0] || {}));
    }

    console.log('\n--- Checking users table ---');
    const { data: userData, error: userError } = await supabaseAdmin.from('users').select('*').limit(1);
    if (userError) {
        console.error('Error fetching users:', userError.message);
    } else {
        console.log('User columns:', Object.keys(userData[0] || {}));
    }
}

checkSupabase();
