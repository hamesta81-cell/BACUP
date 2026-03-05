import { supabaseAdmin } from './supabase.js';

async function testUpdate() {
    console.log('--- Supabase Update Test ---');
    try {
        // Try to update user with ID 1
        const testUserId = 4; // User from the screenshot
        const testType = 'ELITE';
        const testExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        console.log(`Updating User ${testUserId} to ${testType}...`);

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                membership_type: testType,
                membership_expiry: testExpiry
            })
            .eq('id', testUserId)
            .select();

        if (error) {
            console.error('Update failed:', error);
        } else {
            console.log('Update successful:', data);
        }

        // Check columns
        const { data: cols, error: colError } = await supabaseAdmin
            .from('users')
            .select('*')
            .limit(1);

        if (colError) {
            console.error('Select failed:', colError);
        } else if (cols && cols.length > 0) {
            console.log('Current User record keys:', Object.keys(cols[0]));
        } else {
            console.log('No users found to check columns.');
        }

    } catch (err) {
        console.error('Runtime error:', err);
    }
}

testUpdate();
