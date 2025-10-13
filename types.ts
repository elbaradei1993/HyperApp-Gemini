// types.ts
export interface Location {
  lat: number;
  lng: number;
}

export enum VibeType {
  Safe = 'safe',
  Calm = 'calm',
  Noisy = 'noisy',
  LGBTQIAFriendly = 'lgbtqia_friendly',
  Suspicious = 'suspicious',
  Dangerous = 'dangerous',
}

export interface Profile {
  id: string;
  updated_at: string;
  username: string;
  full_name: string;
  avatar_url: string;
}

export interface BaseRecord {
  id: number;
  created_at: string;
  user_id: string;
  location: Location;
  profiles?: {
    username: string;
  };
}

export interface Vibe extends BaseRecord {
  vibe_type: VibeType;
}

export interface SOS extends BaseRecord {
  details: string;
  resolved?: boolean;
}

// Re-architected Event type for new features
export interface Event extends BaseRecord {
  title: string;
  description: string;
  event_time: string;
  end_time?: string | null; // Added for smart archiving
  attendee_count?: number;
}

// New type for AI-discovered events
export interface AiEvent {
  eventName: string;
  description: string;
  date: string;
  locationString: string;
}

// --- New types for cached AI data ---

// New type for the Live Briefing news items
export interface NewsItem {
  headline: string;
  summary: string;
}

// New type for the structured Weather information
export interface WeatherInfo { 
  text: string; 
  icon: string; 
}

// New type for the entire Live Briefing payload
export interface LiveBriefing { 
  weather?: WeatherInfo; 
  news: NewsItem[]; 
}

export interface EventAttendee {
    id: number;
    event_id: number;
    user_id: string;
    created_at: string;
}

export interface SafeZone {
  id: number;
  user_id: string;
  name: string;
  location: Location;
  radius_km: number;
}

// New type for user-specific settings
export interface UserSettings {
  notifications: {
    safeZoneAlerts: boolean;
    onDangerousVibe: boolean;
    onSOS: boolean;
  };
  privacy: {
    anonymousByDefault: boolean;
  };
  map: {
    defaultView: 'heatmap' | 'markers';
  };
}

// From Ticketmaster API
export interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string; // Time is optional
    };
  };
  _embedded?: {
    venues: {
      name: string;
      location?: {
        latitude: string;
        longitude: string;
      };
    }[];
  };
}