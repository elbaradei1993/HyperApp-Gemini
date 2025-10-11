import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace with your Supabase project's URL and Anon Key.
// You can find these in your Supabase project settings -> API.
const supabaseUrl = 'https://nqwejzbayquzsvcodunl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2VqemJheXF1enN2Y29kdW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTA0MjAsImV4cCI6MjA3Mzk2NjQyMH0.01yifC-tfEbBHD5u315fpb_nZrqMZCbma_UrMacMb78';


if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = "Supabase URL or Anon Key is missing. Please update your credentials in services/supabaseClient.ts";
  const root = document.getElementById('root');
  if (root) {
      root.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; color: #f87171; background-color: #1a202c; height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;"><div><h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Configuration Error</h1><p>${errorMessage}</p></div></div>`;
  }
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Connection Health Check ---
// We run a quick check on startup to see if we can connect to Supabase.
// A "TypeError: Failed to fetch" is almost always a CORS (Cross-Origin Resource Sharing) issue.
// This check provides a user-friendly error message instead of failing silently in the console.
(async () => {
    // We try to fetch one row from a table that should always exist.
    // The actual data doesn't matter, only the success or failure of the request.
    const { error } = await supabase.from('profiles').select('id').limit(1);

    if (error && error.message.includes('Failed to fetch')) {
        const errorMessage = "Could not connect to Supabase. This is usually a CORS issue. Please check the new 'CORS Configuration' section in the README.md file and ensure your Supabase project allows requests from this origin.";
        const root = document.getElementById('root');
        if (root) {
            root.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; color: #f87171; background-color: #1a202c; height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;"><div><h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Connection Error</h1><p>${errorMessage}</p><p style="margin-top: 1rem; font-size: 0.8rem; color: #9ca3af;">(The original error was: TypeError: Failed to fetch)</p></div></div>`;
        }
        // Log the full error for debugging, but show the helpful message to the user.
        console.error(errorMessage, error);
    }
})();
