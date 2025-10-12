import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './AuthContext';
import type { Vibe, SOS, Event, Location, Profile } from '../types';
import { VibeType } from '../types';

// Helper to convert Supabase GeoJSON point to our LatLng format.
// This is now simpler as the RPC call guarantees the GeoJSON format.
const parseLocation = (loc: any): Location | null => {
    if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
        // Standard GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    // Backward compatibility for old format from JSONB: { lat: number, lng: number }
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return loc;
    }
    console.warn("Could not parse location:", loc);
    return null;
}

// Helper to map old vibe types to new ones for backward compatibility
const mapLegacyVibeType = (vibeType: string): VibeType => {
    switch (vibeType) {
        case 'Uncertain':
        case 'Tense':
            return VibeType.Suspicious;
        case 'Unsafe':
            return VibeType.Dangerous;
        default:
            return vibeType as VibeType;
    }
};

const validVibeTypes = new Set(Object.values(VibeType));

interface DataContextType {
  vibes: Vibe[];
  sos: SOS[];
  events: Event[];
  loading: boolean;
  error: string | null;
  addLocalVibe: (vibe: Vibe) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [sos, setSos] = useState<SOS[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [profileMap, setProfileMap] = useState<Map<string, { username: string }>>(new Map());

  const addLocalVibe = (vibe: Vibe) => {
    setVibes(currentVibes => {
      if (currentVibes.some(v => v.id === vibe.id)) {
        return currentVibes;
      }
      return [vibe, ...currentVibes];
    });
  };
  
  // Re-architected to use a single, efficient RPC call for atomic and format-guaranteed data loading.
  const fetchAllData = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_all_public_data');
      
      if (rpcError) {
        throw new Error(`Failed to load community data: ${rpcError.message}. Check DB schema and RLS policies.`);
      }

      if (!data) {
        throw new Error("No data returned from the server. The RPC function might be misconfigured.");
      }

      const newProfileMap = new Map<string, { username: string }>();
      (data.profiles || []).forEach((profile: Profile) => {
          if (profile.id && profile.username) {
              newProfileMap.set(profile.id, { username: profile.username });
          }
      });
      setProfileMap(newProfileMap);

      const enrichedVibes = (data.vibes || []).map((v: any) => {
          const location = parseLocation(v.location);
          if (!location) return null;
          const mappedVibeType = mapLegacyVibeType(v.vibe_type);
          if (!validVibeTypes.has(mappedVibeType)) return null;
          return { ...v, location, vibe_type: mappedVibeType, profiles: newProfileMap.get(v.user_id) } as Vibe;
      }).filter(Boolean) as Vibe[];

      const enrichedSos = (data.sos || []).map((s: any) => {
          const location = parseLocation(s.location);
          if (!location) return null;
          return { ...s, location, profiles: newProfileMap.get(s.user_id) } as SOS;
      }).filter(Boolean) as SOS[];

      const enrichedEvents = (data.events || []).map((e: any) => {
          const location = parseLocation(e.location);
          if (!location) return null;
          return { ...e, location, profiles: newProfileMap.get(e.user_id) } as Event;
      }).filter(Boolean) as Event[];
      
      setVibes(enrichedVibes);
      setSos(enrichedSos);
      setEvents(enrichedEvents);

    } catch (err: any) {
        console.error("Data fetching error:", err);
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (auth?.loading) return;

    fetchAllData();

    const handleRealtimeUpdate = (payload: any) => {
        // For any real-time change, the safest and most robust approach is to refetch all data.
        // This prevents complex state inconsistencies and race conditions that cause crashes.
        console.log('Real-time event received, refetching all data for consistency:', payload.eventType, payload.table);
        fetchAllData();
    };

    const subscription = supabase.channel('public-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [auth?.session, auth?.loading]);

  const value = {
    vibes,
    sos,
    events,
    loading,
    error,
    addLocalVibe,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}