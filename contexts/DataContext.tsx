import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './AuthContext';
import type { Vibe, SOS, Event, Location, EventAttendee } from '../types';

interface DataContextType {
  vibes: Vibe[];
  sos: SOS[];
  events: Event[];
  userAttendees: EventAttendee[];
  loading: boolean;
  error: string | null;
  addLocalVibe: (vibe: Vibe) => void;
  addLocalEvent: (event: Event) => void;
  deleteLocalEvent: (eventId: number) => void;
  attendEvent: (eventId: number) => void;
  unattendEvent: (eventId: number) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

// The parseLocation function is now simpler as the RPC guarantees GeoJSON format.
const parseLocation = (loc: any): Location | null => {
    if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    return null;
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [sos, setSos] = useState<SOS[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [userAttendees, setUserAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    try {
      // Use the single, powerful RPC call to get all data formatted correctly.
      const { data, error: rpcError } = await supabase.rpc('get_all_public_data');

      // DEFINITIVE CRASH FIX: Add a defensive guard. If the RPC returns an error or null data,
      // default to an empty object to prevent the app from crashing.
      if (rpcError) throw rpcError;
      const allData = data || {};

      // Even with the RPC, we still parse to ensure the final shape is correct.
      // The RPC guarantees the `location` field is valid GeoJSON, so parsing will succeed.
      const parsedVibes = (allData.vibes || []).map((v: any) => ({ ...v, location: parseLocation(v.location) })).filter((v: any) => v.location) as Vibe[];
      const parsedSos = (allData.sos || []).map((s: any) => ({ ...s, location: parseLocation(s.location) })).filter((s: any) => s.location) as SOS[];
      const parsedEvents = (allData.events || []).map((e: any) => ({ ...e, location: parseLocation(e.location) })).filter((e: any) => e.location) as Event[];
      const attendees = (allData.attendees || []) as EventAttendee[];
      
      setVibes(parsedVibes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setSos(parsedSos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setEvents(parsedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setUserAttendees(attendees);

    } catch (err: any) {
      setError(`Failed to load community data: ${err.message}`);
      console.error("Data fetching error:", err);
    } finally {
      setLoading(false);
    }
  };

  // This effect now correctly depends on the user's session.
  // It will run on initial load and again whenever the user logs in or out.
  useEffect(() => {
    // Don't fetch data until the auth state is resolved.
    if (auth?.loading) return;
    
    setLoading(true);
    fetchData();

  }, [auth?.session, auth?.loading]);


  // Robust Real-time Handler
  useEffect(() => {
    const handleRealtimeUpdate = (payload: any) => {
        const { eventType, table, new: newRecord, old: oldRecord } = payload;
        
        switch (table) {
            case 'vibes':
                if (eventType === 'INSERT') {
                    const parsedVibe = { ...newRecord, location: parseLocation(newRecord.location) };
                    if (parsedVibe.location) setVibes(current => [parsedVibe, ...current]);
                }
                break;
            case 'sos':
                 if (eventType === 'INSERT') {
                    const parsedSos = { ...newRecord, location: parseLocation(newRecord.location) };
                    if (parsedSos.location) setSos(current => [parsedSos, ...current]);
                } else if (eventType === 'UPDATE' && newRecord.resolved) {
                    setSos(current => current.filter(s => s.id !== newRecord.id));
                }
                break;
            case 'events':
                if (eventType === 'INSERT') {
                    const parsedEvent = { ...newRecord, location: parseLocation(newRecord.location), attendee_count: 0 };
                    if (parsedEvent.location) setEvents(current => [parsedEvent, ...current]);
                } else if (eventType === 'UPDATE') {
                    const parsedEvent = { ...newRecord, location: parseLocation(newRecord.location) };
                    if(parsedEvent.location) setEvents(current => current.map(e => e.id === parsedEvent.id ? { ...e, ...parsedEvent } : e));
                } else if (eventType === 'DELETE') {
                    setEvents(current => current.filter(e => e.id !== oldRecord.id));
                }
                break;
            case 'event_attendees':
                if (eventType === 'INSERT') {
                    setUserAttendees(current => [...current, newRecord]);
                    setEvents(current => current.map(e => e.id === newRecord.event_id ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
                } else if (eventType === 'DELETE') {
                    setUserAttendees(current => current.filter(a => a.id !== oldRecord.id));
                    setEvents(current => current.map(e => e.id === oldRecord.event_id ? { ...e, attendee_count: Math.max(0, (e.attendee_count || 1) - 1) } : e));
                }
                break;
        }
    };

    const subscription = supabase.channel('public-data-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const addLocalVibe = (vibe: Vibe) => setVibes(current => [vibe, ...current]);
  const addLocalEvent = (event: Event) => setEvents(current => [event, ...current]);
  const deleteLocalEvent = (eventId: number) => setEvents(current => current.filter(e => e.id !== eventId));
  
  const attendEvent = async (eventId: number) => {
    if (!auth?.user) return;
    // Optimistic update
    setUserAttendees(current => [...current, { id: -1, event_id: eventId, user_id: auth.user!.id, created_at: new Date().toISOString() }]);
    setEvents(current => current.map(e => e.id === eventId ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
    // DB operation
    await supabase.from('event_attendees').insert({ event_id: eventId, user_id: auth.user.id });
  };

  const unattendEvent = async (eventId: number) => {
    if (!auth?.user) return;
    // Optimistic update
    setUserAttendees(current => current.filter(a => !(a.event_id === eventId && a.user_id === auth.user!.id)));
    setEvents(current => current.map(e => e.id === eventId ? { ...e, attendee_count: Math.max(0, (e.attendee_count || 1) - 1) } : e));
    // DB operation
    await supabase.from('event_attendees').delete().match({ event_id: eventId, user_id: auth.user.id });
  };
  

  const value = { vibes, sos, events, userAttendees, loading, error, addLocalVibe, addLocalEvent, deleteLocalEvent, attendEvent, unattendEvent };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
