// types.ts

export enum VibeType {
  Safe = 'safe',
  Calm = 'calm',
  Noisy = 'noisy',
  LGBTQIAFriendly = 'lgbtqia_friendly',
  Suspicious = 'suspicious',
  Dangerous = 'dangerous',
}

export interface Location {
  lat: number;
  lng: number;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  updated_at?: string;
}

export interface Vibe {
  id: number;
  created_at: string;
  user_id: string;
  vibe_type: VibeType;
  location: Location;
  profiles?: { username: string }; // From map query
  username?: string; // From trending query
}

export interface SOS {
  id: number;
  created_at: string;
  user_id: string;
  details: string;
  location: Location;
  resolved: boolean;
  profiles?: { username: string };
}

export interface Event {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  description: string;
  event_time: string;
  location: Location;
  profiles?: { username:string };
}

export interface SafeZone {
    id: number;
    created_at: string;
    user_id: string;
    name: string;
    radius_km: number;
    location: Location;
}

export interface TrendingVibe {
    vibe_type: VibeType;
    vibe_count: number;
    latest_report: string;
}

// Reverted to Ticketmaster API data type
export interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  images: { url: string; }[];
  dates: {
    start: {
      localDate: string;
      localTime?: string;
    };
  };
  _embedded?: {
    venues: {
      name: string;
      city: { name: string; };
      address: { line1: string; };
    }[];
  };
  // Optional field for our AI-generated content
  safetyVibe?: string;
}
