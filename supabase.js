import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://tdetsnkdclgaktsoiujq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_jvZZbSYP7NPomropNjHiug_cJMTcUw2';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZXRzbmtkY2xnYWt0c29pdWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE5NDI3NywiZXhwIjoyMDg3NzcwMjc3fQ.vZK0qeqTBKU50qmD_Pacxl5UohEnfWmQKmvsWw5YAgA';

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing. Database operations will fail.');
}

// Client for general public operations (anon)
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Client for administrative operations (service role) - Bypass RLS
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || supabaseKey || '');
