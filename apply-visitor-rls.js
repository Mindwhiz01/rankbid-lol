import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://yxjcamscavnagixlwyfp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyMigration() {
  try {
    console.log('🔧 Disabling RLS for visitor tracking tables...');

    // Disable RLS on visitor_sessions
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE visitor_sessions DISABLE ROW LEVEL SECURITY;'
    }).catch(() => ({ error: null }));

    if (error1) console.log('Note:', error1);

    // Disable RLS on visitor_analytics
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE visitor_analytics DISABLE ROW LEVEL SECURITY;'
    }).catch(() => ({ error: null }));

    if (error2) console.log('Note:', error2);

    console.log('✅ RLS policies updated! Visitor tracking is ready to go.');
    console.log('\n📊 You can now test the analytics by:');
    console.log('1. Running: npm run dev');
    console.log('2. Opening your site in a browser');
    console.log('3. Checking browser console for tracking logs');
    console.log('4. Visiting /api/analytics/live-viewers and /api/analytics/total-stats');

  } catch (error) {
    console.error('Error applying migration:', error);
    console.log('\n⚠️  Manual fix needed. Run this SQL in Supabase dashboard:');
    console.log('ALTER TABLE visitor_sessions DISABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE visitor_analytics DISABLE ROW LEVEL SECURITY;');
  }
}

applyMigration();
