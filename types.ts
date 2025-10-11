
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  updated_at: string;
  username: string;
  full_name: string;
  avatar_url: string;
  dark_mode: boolean;
}

export enum VibeType {
  Safe = 'safe',
  Uncertain = 'uncertain',
  Tense = 'tense',
  Unsafe = 'unsafe'
}

export interface Vibe {
  id: number;
  created_at: string;
  user_id: string;
  vibe_type: VibeType;
  location: { lat: number, lng: number };
  upvotes: number;
  profiles: { username: string };
}

export interface SOS {
  id: number;
  created_at: string;
  user_id: string;
  location: { lat: number, lng: number };
  details: string;
  resolved: boolean;
  profiles: { username: string };
}

export interface Event {
  id: number;
  created_at: string;
  user_id: string;
  location: { lat: number, lng: number };
  title: string;
  description: string;
  event_time: string;
  profiles: { username: string };
}
