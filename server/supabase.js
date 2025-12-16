require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'public-anon-key';

// Mock client if keys are missing to prevent crash during dev without keys
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) 
  ? createClient(supabaseUrl, supabaseKey)
  : {
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: [], error: null }),
        update: () => ({ data: [], error: null }),
        delete: () => ({ data: [], error: null }),
      })
    };

if (!process.env.SUPABASE_URL) {
  console.warn('⚠️  Supabase keys not found in .env. Using mock client.');
}

module.exports = supabase;
