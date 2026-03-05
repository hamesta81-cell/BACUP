import { supabaseAdmin } from './supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initSupabase() {
    console.log('Starting Supabase initialization...');

    // Read the SQL schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'supabase_schema.sql'), 'utf8');

    // Split SQL by semicolons, but be careful with multi-line statements.
    // For simplicity and robustness, we can use a simpler approach or execute it as a single block if the client supports it (it doesn't directly for massive DDL).
    // However, Supabase client doesn't have a direct "execute arbitrary SQL" unless we use a RPC.

    console.log('Note: Direct SQL execution via JS client is limited.');
    console.log('I will attempt to verify table existence or seed basic data.');

    // We can't easily run the WHOLE DDL via the JS client without an RPC (db_exec).
    // So I will instead instruct the user to run it in the SQL Editor and I will seed some basic data.

    try {
        const { data: slots, error } = await supabaseAdmin.from('timeslots').select('id').limit(1);
        if (error) {
            console.log('Table "timeslots" not found. The user needs to run the SQL schema in the Supabase Dashboard.');
            process.exit(1);
        } else {
            console.log('Database schema verified.');

            // Seed mock data if empty
            if (slots.length === 0) {
                console.log('Seeding mock data...');
                await supabaseAdmin.from('timeslots').insert([
                    { date: '3월 1일 (일)', time_start: '10:00', time_end: '12:00', price: 25000, capacity: 20, booked: 5, location: '김포 메인 게이트 B', price_youth: 20000, price_child: 15000 },
                    { date: '3월 1일 (일)', time_start: '14:00', time_end: '16:00', price: 25000, capacity: 20, booked: 18, location: '서울 고스트 존 A', price_youth: 20000, price_child: 15000 },
                    { date: '3월 1일 (일)', time_start: '18:00', time_end: '20:30', price: 20000, capacity: 32, booked: 2, location: '하남 필드 C', price_youth: 15000, price_child: 10000 }
                ]);

                await supabaseAdmin.from('rankings').insert([
                    { category: 'individual', name: '김마스터', score: 12, rank_info: '1위' },
                    { category: 'team', name: '델타 포스', score: 4500, rank_info: '최강팀' }
                ]);

                await supabaseAdmin.from('coupons').insert([
                    { code: 'WELCOME2026', reward_xp: 1000 },
                    { code: 'LASERTAG_PRO', reward_xp: 500 }
                ]);

                console.log('Seeding completed.');
            } else {
                console.log('Data already exists, skipping seed.');
            }
        }
    } catch (e) {
        console.error('Initialization error:', e.message);
    }
}

initSupabase();
