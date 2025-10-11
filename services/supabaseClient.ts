import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqwejzbayquzsvcodunl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2VqemJheXF1enN2Y29kdW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTA0MjAsImV4cCI6MjA3Mzk2NjQyMH0.01yifC-tfEbBHD5u315fpb_nZrqMZCbma_UrMacMb78';

function showError(message: string): never {
    console.error(message);
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; color: #f87171; background-color: #1a202c; height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;"><div><h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Configuration Error</h1><p>${message}</p><p style="margin-top: 1rem; font-size: 0.875rem; color: #9ca3af;">Please refer to the setup instructions to configure your environment variables.</p></div></div>`;
    }
    throw new Error(message);
}

if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
  showError("Supabase URL is not set. Please set the SUPABASE_URL environment variable.");
}

if (!supabaseAnonKey || supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')) {
  showError("Supabase Anon Key is not set. Please set the SUPABASE_ANON_KEY environment variable.");
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);