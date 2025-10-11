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

const showErrorScreen = (title: string, message: string, details?: string) => {
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; color: #f87171; background-color: #1a202c; height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;"><div><h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${title}</h1><p>${message}</p>${details ? `<p style="margin-top: 1rem; font-size: 0.8rem; color: #9ca3af;">(Original error: ${details})</p>` : ''}</div></div>`;
    }
};


// --- App Startup Health Checks ---
(async () => {
    // 1. Connection Health Check (CORS)
    const { error: connectionError } = await supabase.from('profiles').select('id').limit(1);
    if (connectionError && connectionError.message.includes('Failed to fetch')) {
        const message = "Could not connect to Supabase. This is usually a CORS issue. Please check the new 'CORS Configuration' section in the README.md file and ensure your Supabase project allows requests from this origin.";
        showErrorScreen('Connection Error', message, 'TypeError: Failed to fetch');
        console.error(message, connectionError);
        return; // Stop further checks if we can't connect
    }

    // 2. Schema Health Check (for a common specific error)
    // Supabase error code 'PGRST200' means the column was not found.
    const { error: schemaError } = await supabase.from('vibes').select('vibe_type').limit(1);
    if (schemaError && schemaError.code === 'PGRST200') {
        const message = "Database schema mismatch. The 'vibe_type' column is missing from the 'vibes' table. This means an old or incomplete schema script was run. Please run the latest `supabase/schema.sql` file in your Supabase SQL Editor to fix this issue.";
        showErrorScreen('Database Schema Error', message, "Column 'vibe_type' not found");
        console.error(message, schemaError);
    }
})();
