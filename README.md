# HyperAPP - Community Safety

A mobile-first progressive web app for community safety, allowing users to report local "vibes", send SOS alerts, create events, and view live neighborhood activity on a map. The app leverages Supabase for the backend and the Google Gemini API for AI-powered insights.

## Project Structure

```
/
├── components/
├── contexts/
├── pages/
├── services/
├── supabase/      <-- Contains required SQL setup file
│   └── schema.sql
├── utils/
├── App.tsx
├── index.html
├── index.tsx
└── README.md
```

## Setup Instructions

Follow these steps carefully to get your own instance of HyperAPP running.

### 1. Supabase Project Credentials

1.  Go to [supabase.com](https://supabase.com) and create a new project.
2.  In your Supabase project dashboard, navigate to **Project Settings** > **API**.
3.  Find your **Project URL** and **`anon` public key**.
4.  Open `services/supabaseClient.ts` in your code editor.
5.  Replace the placeholder values for `supabaseUrl` and `supabaseAnonKey` with your own credentials.

### 2. CORS Configuration (Important for "Failed to Fetch" Errors)

If the app shows a "Connection Error" or you see `TypeError: Failed to fetch` in the console, you **must** configure CORS in your Supabase project. This tells Supabase it's safe to accept requests from the app.

1.  In your Supabase project dashboard, go to **Project Settings** > **API**.
2.  Scroll down to the **CORS Configuration** section.
3.  The default settings might not work for this development environment. The simplest solution is to allow all origins.
4.  Enter `*` (a single asterisk) into the text box and click **Save**. This will allow the app to connect from any URL.

### 3. Database Setup

This is the most critical step. The project **will not work** without a correctly configured database.

1.  **Enable PostGIS Extension (Crucial First Step):**
    *   In your Supabase project dashboard, go to **Database** > **Extensions**.
    *   Use the search bar to find `postgis`.
    *   Click to highlight it, then click **Enable**. If it's already enabled, you can proceed.

2.  **Run SQL Schema Script:**
    *   Go to the **SQL Editor** in your Supabase dashboard (icon looks like a page with `SQL` on it).
    *   Click **New query**.
    *   Open the `supabase/schema.sql` file from your project.
    *   Copy its entire content.
    *   Paste it into the Supabase SQL Editor and click **Run**. Wait for the "Success. No rows returned" message.

3.  **Enable Real-Time Broadcasting (CRITICAL FOR LIVE UPDATES):**
    *   For the map and other features to update in real-time, you must tell Supabase which tables to broadcast changes from.
    *   In your Supabase project dashboard, go to **Database** > **Replication**.
    *   Under the "Source" section, you will likely see text that says "0 tables". Click on it.
    *   A dialog will appear. Check the boxes for the `vibes`, `sos`, `events`, and `safe_zones` tables.
    *   Click **Save**. The text should now say "4 tables", and real-time updates will be enabled.

After running these steps successfully, your database will be fully configured.

### 4. Google Gemini API Key

The AI features (Smart Vibe Explanation, Trending Insights, etc.) are powered by the Google Gemini API.

1.  Go to [Google AI Studio](https://aistudio.google.com/) and create an API key.
2.  This project expects the API key to be available as an environment variable named `API_KEY`. You will need to configure this in your deployment environment for the AI features to work.

## Troubleshooting

-   **"Connection Error" / "TypeError: Failed to fetch"**: Your browser is blocking requests to Supabase.
    -   **Solution**: Follow the instructions in the **"CORS Configuration"** section above. This is the most common setup issue. Also, try disabling any ad-blockers or privacy extensions, as they can sometimes interfere with requests.

-   **Map / Data doesn't update after reporting a vibe**: This means the real-time connection is not working.
    -   **Solution**: You have likely missed step **3.3: Enable Real-Time Broadcasting**. Follow those instructions to enable replication on your tables.

-   **"An internal error occurred" / Map is empty**: This is almost always a sign of a problem with the database setup. It means the app connected to Supabase, but the query failed, likely due to a missing table or incorrect Row Level Security (RLS) policies.
    -   **Solution**: Double-check that you have enabled the `postgis` extension. Then, carefully re-run the `supabase/schema.sql` script. This will reset your tables and security policies to the correct state.
