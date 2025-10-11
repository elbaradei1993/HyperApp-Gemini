import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Vibe, SOS, Event, Location } from '../types';
import { VibeType } from '../types';

// Helper to convert Supabase GeoJSON point to our LatLng format
const parseLocation = (loc: any): Location | null => {
    if (loc && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    return null;
}

const validVibeTypes = new Set(Object.values(VibeType));

interface DataContextType {
  vibes: Vibe[];
  sos: SOS[];
  events: Event[];
  loading: boolean;
  error: string | null;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [sos, setSos] = useState<SOS[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      setError(null);
      
      const vibesPromise = supabase.from('vibes').select('*, profiles(username)');
      const sosPromise = supabase.from('sos').select('*, profiles(username)').eq('resolved', false);
      const eventsPromise = supabase.from('events').select('*, profiles(username)');
      
      const [vibesRes, sosRes, eventsRes] = await Promise.all([vibesPromise, sosPromise, eventsPromise]);
      
      const responses = { vibes: vibesRes, sos: sosRes, events: eventsRes };
      let hadError = false;
      for (const [key, res] of Object.entries(responses)) {
        if (res.error) {
            console.error(`Error fetching ${key}:`, res.error);
            setError(`Failed to load map data. An "internal error" often means a database setup issue. Please verify your table schemas and Row Level Security policies in Supabase. (Failed on: ${key})`);
            hadError = true;
        }
      }
      if (hadError) {
          setLoading(false);
          return;
      }

      setVibes((vibesRes.data || []).map(v => ({ ...v, location: parseLocation(v.location) })).filter(v => v.location && validVibeTypes.has(v.vibe_type)) as Vibe[]);
      setSos((sosRes.data || []).map(s => ({ ...s, location: parseLocation(s.location) })).filter(s => s.location) as SOS[]);
      setEvents((eventsRes.data || []).map(e => ({ ...e, location: parseLocation(e.location) })).filter(e => e.location) as Event[]);
      
      setLoading(false);
    };

    fetchAllData();

    const subscription = supabase.channel('public-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Real-time change received!', payload);
        fetchAllData(); // Re-fetch all data on any change
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const value = {
    vibes,
    sos,
    events,
    loading,
    error,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// Custom hook for easy consumption of the context
export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
