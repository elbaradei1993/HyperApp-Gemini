import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Vibe, SOS, Event, Location, Profile } from '../types';
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
  
  // A cache to hold user profile info (id -> username) for enriching real-time data.
  const [profileMap, setProfileMap] = useState<Map<string, { username: string }>>(new Map());

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

      const newProfileMap = new Map<string, { username: string }>();
      const processAndCacheProfiles = (item: any) => {
        if (item.profiles && item.user_id) {
          newProfileMap.set(item.user_id, item.profiles);
        }
        return item;
      };

      const allVibes = (vibesRes.data || []).map(processAndCacheProfiles);
      const allSos = (sosRes.data || []).map(processAndCacheProfiles);
      const allEvents = (eventsRes.data || []).map(processAndCacheProfiles);
      
      setProfileMap(newProfileMap);

      setVibes(allVibes.map(v => ({ ...v, location: parseLocation(v.location) })).filter(v => v.location && validVibeTypes.has(v.vibe_type)) as Vibe[]);
      setSos(allSos.map(s => ({ ...s, location: parseLocation(s.location) })).filter(s => s.location) as SOS[]);
      setEvents(allEvents.map(e => ({ ...e, location: parseLocation(e.location) })).filter(e => e.location) as Event[]);
      
      setLoading(false);
    };

    fetchAllData();

    const handleRealtimeUpdate = (payload: any) => {
        const { eventType, table, new: newRecord, old: oldRecord } = payload;
        
        const updateState = <T extends { id: number | string, user_id: string }>(
            setter: React.Dispatch<React.SetStateAction<T[]>>,
            parser: (record: any) => T | null
        ) => {
            const id = newRecord?.id || oldRecord?.id;
            if (!id) return;
            
            // Enrich the incoming record with cached profile data before parsing
            const profile = profileMap.get(newRecord.user_id);
            const enrichedRecord = { ...newRecord, profiles: profile };

            setter(currentData => {
                if (eventType === 'INSERT') {
                    const parsed = parser(enrichedRecord);
                    if (!parsed || currentData.some(item => item.id === parsed.id)) return currentData;
                    return [...currentData, parsed];
                }
                if (eventType === 'UPDATE') {
                    const parsed = parser(enrichedRecord);
                    if (!parsed) return currentData;
                    return currentData.map(item => (item.id === parsed.id ? parsed : item));
                }
                if (eventType === 'DELETE') {
                    return currentData.filter(item => item.id !== id);
                }
                return currentData;
            });
        };
        
        if (table === 'vibes') {
            updateState<Vibe>(setVibes, (record) => {
                const parsed = { ...record, location: parseLocation(record.location) } as Vibe;
                return parsed.location && validVibeTypes.has(parsed.vibe_type) ? parsed : null;
            });
        } else if (table === 'sos') {
            updateState<SOS>(setSos, (record) => {
                const parsed = { ...record, location: parseLocation(record.location) } as SOS;
                if (eventType === 'UPDATE' && parsed.resolved) {
                    setSos(current => current.filter(s => s.id !== parsed.id));
                    return null;
                }
                return parsed.location ? parsed : null;
            });
        } else if (table === 'events') {
            updateState<Event>(setEvents, (record) => {
                const parsed = { ...record, location: parseLocation(record.location) } as Event;
                return parsed.location ? parsed : null;
            });
        }
    };


    const subscription = supabase.channel('public-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
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
