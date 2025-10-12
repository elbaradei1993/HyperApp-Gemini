// contexts/DataContext.tsx
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
    // Add a fallback for any other potential formats, though RPC should prevent this.
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return loc;
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

      if (rpcError) throw rpcError;
      const allData = data || {};

      const parsedVibes = (allData.vibes || []).map((v: any) => ({ ...v, location: parseLocation(v.location) })).filter((v: any) => v.location) as Vibe[];
      const parsedSos = (allData.sos || []).map((s: any) => ({ ...s, location: parseLocation(s.location) })).filter((s: any) => s.location) as SOS[];
      const parsedEvents = (allData.events || []).map((e: any) => ({ ...e, location: parseLocation(e.location) })).filter((e: any) => e.location) as Event[];
      const attendees = (allData.attendees || []).filter((a: any) => a.user_id === auth?.user?.id) as EventAttendee[];
      
      setVibes(parsedVibes);
      setSos(parsedSos);
      setEvents(parsedEvents);
      setUserAttendees(attendees);

    } catch (err: any) {
      setError(`Failed to load community data: ${err.message}`);
      console.error("Data fetching error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth?.loading) return;
    setLoading(true);
    fetchData();
  }, [auth?.session, auth?.loading]);


  // Robust Real-time Handler
  useEffect(() => {
    const handleRealtimeUpdate = (payload: any) => {
        const { eventType, table, new: newRecord, old: oldRecord } = payload;
        
        // This function needs to be robust against incomplete data
        const enrichRecord = (record: any) => {
            if (!record) return null;
            const parsed = { ...record, location: parseLocation(record.location) };
            // Simulate the profile join for optimistic updates
            if (record.user_id === auth?.user?.id && !record.profiles) {
                parsed.profiles = { username: 'You' };
            }
            return parsed;
        }

        switch (table) {
            case 'vibes':
                if (eventType === 'INSERT') {
                    const enriched = enrichRecord(newRecord);
                    if (enriched?.location) setVibes(current => [enriched, ...current]);
                }
                break;
            case 'sos':
                 if (eventType === 'INSERT') {
                    const enriched = enrichRecord(newRecord);
                    if (enriched?.location) setSos(current => [enriched, ...current]);
                } else if (eventType === 'UPDATE' && newRecord.resolved) {
                    setSos(current => current.filter(s => s.id !== newRecord.id));
                }
                break;
            case 'events':
                if (eventType === 'INSERT') {
                    const enriched = enrichRecord(newRecord);
                    if (enriched?.location) setEvents(current => [{ ...enriched, attendee_count: 0 }, ...current]);
                } else if (eventType === 'UPDATE') {
                    setEvents(current => current.map(e => e.id === newRecord.id ? { ...e, ...enrichRecord(newRecord) } : e));
                } else if (eventType === 'DELETE') {
                    setEvents(current => current.filter(e => e.id !== oldRecord.id));
                }
                break;
            case 'event_attendees':
                if (eventType === 'INSERT' && newRecord.user_id === auth?.user?.id) {
                    setUserAttendees(current => [...current, newRecord]);
                    setEvents(current => current.map(e => e.id === newRecord.event_id ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
                } else if (eventType === 'DELETE' && oldRecord.user_id === auth?.user?.id) {
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
  }, [auth?.user?.id]);

  const addLocalVibe = (vibe: Vibe) => setVibes(current => [vibe, ...current]);
  const addLocalEvent = (event: Event) => setEvents(current => [event, ...current]);
  const deleteLocalEvent = (eventId: number) => setEvents(current => current.filter(e => e.id !== eventId));
  
  const attendEvent = async (eventId: number) => {
    if (!auth?.user) return;
    const optimisticAttendee = { id: Math.random(), event_id: eventId, user_id: auth.user.id, created_at: new Date().toISOString() };
    setUserAttendees(current => [...current, optimisticAttendee]);
    setEvents(current => current.map(e => e.id === eventId ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
    const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: auth.user.id });
    if (error) { // Revert on error
        setUserAttendees(current => current.filter(a => a.id !== optimisticAttendee.id));
        setEvents(current => current.map(e => e.id === eventId ? { ...e, attendee_count: Math.max(0, (e.attendee_count || 1) - 1) } : e));
    }
  };

  const unattendEvent = async (eventId: number) => {
    if (!auth?.user) return;
    const attendeeToRemove = userAttendees.find(a => a.event_id === eventId && a.user_id === auth.user!.id);
    if (!attendeeToRemove) return;
    setUserAttendees(current => current.filter(a => a.id !== attendeeToRemove.id));
    setEvents(current => current.map(e => e.id === eventId ? { ...e, attendee_count: Math.max(0, (e.attendee_count || 1) - 1) } : e));
    const { error } = await supabase.from('event_attendees').delete().match({ event_id: eventId, user_id: auth.user.id });
    if (error) { // Revert on error
        setUserAttendees(current => [...current, attendeeToRemove]);
        setEvents(current => current.map(e => e.id === eventId ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
    }
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
