import { createClient } from '@supabase/supabase-js';

// The Supabase URL and Key are provided directly by the user.
const supabaseUrl = 'https://nqwejzbayquzsvcodunl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2VqemJheXF1enN2Y29kdW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTA0MjAsImV4cCI6MjA3Mzk2NjQyMH0.01yifC-tfEbBHD5u315fpb_nZrqMZCbma_UrMacMb78';

// Throw an error if the credentials are still somehow missing (defensive programming).
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('CRITICAL ERROR: Supabase URL and anonymous key are missing. This should not happen.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
