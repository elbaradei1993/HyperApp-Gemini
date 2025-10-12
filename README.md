# HyperAPP - Community Safety Application

HyperAPP is a mobile-first web application designed to enhance community safety. It allows users to report the "vibe" of their surroundings, send SOS alerts in emergencies, discover and create local events, and view a live, interactive map of neighborhood activity.

## 🚀 Getting Started

This application requires a connection to a Supabase backend for data storage and a Google Gemini API key for its AI-powered features.

### 🔑 Environment Setup (CRITICAL)

The application will fail to start if it cannot connect to these services. You must configure the following environment variables (also known as "Secrets") in your development environment.

**Required Variables:**

1.  `SUPABASE_URL`: Your unique URL for your Supabase project.
2.  `SUPABASE_ANON_KEY`: The `anon` (anonymous) public key for your Supabase project.
3.  `API_KEY`: Your API key for Google Gemini.

**How to Configure:**

1.  **Find Your Supabase Credentials:**
    *   Go to your Supabase project dashboard.
    *   Navigate to **Project Settings** (the gear icon).
    *   Click on **API**.
    *   Under "Project API keys", you will find your `anon` `public` key. This is your `SUPABASE_ANON_KEY`.
    *   Under "Configuration", you will find your **Project URL**. This is your `SUPABASE_URL`.

2.  **Find Your Gemini API Key:**
    *   Go to the [Google AI Studio](https://aistudio.google.com/).
    *   Click on **"Get API key"**.
    *   Create or use an existing API key.

3.  **Set the Environment Variables (Secrets):**
    *   In your development environment, find the section for managing "Secrets" or "Environment Variables".
    *   Create three new secrets with the **exact names** listed above and paste in the corresponding values you just copied.
    *   **Important:** After setting the variables, you may need to restart or redeploy the application for the changes to take effect.

---

## Features

*   **Real-time Interactive Map:** View vibes, alerts, and events on a live map with heatmap and clustering capabilities.
*   **Community Vibe Reporting:** Share the feeling of an area with categories like 'Safe', 'Calm', 'Suspicious', or 'Dangerous'.
*   **Emergency SOS:** Send location-based SOS alerts to the community.
*   **Live AI Assistant:** An emergency voice assistant powered by Gemini to help in critical situations.
*   **Community Events Hub:** Discover major local events via the Ticketmaster API or create and manage your own community gatherings.
*   **AI-Powered Insights:** Get smart safety tips, event safety previews, and AI-enhanced descriptions.
*   **Personalized Profiles:** Manage your activity, create custom "Safe Zones" for notifications, and update your profile.

## Backend Setup (Supabase)

For the application to function correctly, your Supabase project must be configured with the correct database schema and security policies.

1.  **Enable PostGIS Extension:**
    *   In your Supabase Dashboard, go to **Database -> Extensions**.
    *   Find `postgis` in the list and enable it.

2.  **Run the Schema Script:**
    *   The `supabase/schema.sql` file in this repository contains all the necessary tables, functions, and security policies.
    *   Go to the **SQL Editor** in your Supabase dashboard.
    *   Paste the entire contents of the `supabase/schema.sql` file into a new query and click **RUN**. This script is safe to run multiple times.

3.  **Enable Real-time Broadcasting:**
    *   The map and activity feeds rely on real-time updates.
    *   Go to **Database -> Replication**.
    *   Under "Source", find your `supabase_realtime` publication. Click the link that says "X tables".
    *   Toggle on broadcasting for the `vibes`, `sos`, `events`, and `event_attendees` tables.
