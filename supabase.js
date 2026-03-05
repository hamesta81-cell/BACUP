import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing. Database operations will fail.');
}

// Client for general public operations (anon)
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Client for administrative operations (service role) - Bypass RLS
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || supabaseKey || '');
