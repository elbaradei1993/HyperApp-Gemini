import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Vibe, SOS, Event, Location, EventAttendee } from '../types';
import { AuthContext } from './AuthContext';

// Helper to parse location from GeoJSON format, which the RPC guarantees
const parseLocationFromGeoJSON = (loc: any): Location | null => {
  if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
    // GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }
  // Add a fallback for simple {lat, lng} just in case
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return loc;
  }
  return null;
};

// Data processing function for records coming from the RPC
const processRecord = <T extends { location: any }>(record: T): T | null => {
  const parsedLocation = parseLocationFromGeoJSON(record.location);
  if (!parsedLocation) {
    console.warn("Skipping record due to invalid location data:", record);
    return null;
  }
  return { ...record, location: parsedLocation };
};


interface DataContextType {
  vibes: Vibe[];
  sos: SOS[];
  events: Event[];
  attendees: EventAttendee[];
  loading: boolean;
  error: string | null;
  addLocalVibe: (vibe: Vibe) => void;
  addLocalEvent: (event: Event) => void;
  updateEvent: (event: Event) => Promise<void>;
  deleteEvent: (eventId: number) => Promise<void>;
  attendEvent: (eventId: number) => Promise<void>;
  unattendEvent: (eventId: number) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session } = useContext(AuthContext) || {};

  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [sos, setSos] = useState<SOS[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_all_public_data');
      
      // Harden against null data responses from the RPC call
      if (rpcError) throw rpcError;
      const responseData = data || {};

      setVibes((responseData.vibes || []).map(processRecord).filter(Boolean) as Vibe[]);
      setSos((responseData.sos || []).map(processRecord).filter(Boolean) as SOS[]);
      setEvents((responseData.events || []).map(processRecord).filter(Boolean) as Event[]);
      setAttendees(responseData.attendees || []);

    } catch (err: any) {
      setError(`Error fetching initial data: ${err.message}`);
      console.error("Data fetching error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) { // Only fetch data if user is logged in
      fetchData();
    }
  }, [session, fetchData]);

  useEffect(() => {
    const handleRealtimeUpdate = (payload: any) => {
      // Use a more robust but simpler real-time strategy: refetch on any change.
      // This avoids complex state management and race conditions.
      console.log("Real-time change detected, refetching all data.", payload);
      fetchData();
    };

    const changesChannel = supabase.channel('public-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
      .subscribe();
    
    return () => {
      supabase.removeChannel(changesChannel);
    };
  }, [fetchData]);
  
  // Optimistic UI update functions
  const addLocalVibe = (vibe: Vibe) => setVibes(prev => [vibe, ...prev]);
  const addLocalEvent = (event: Event) => setEvents(prev => [...prev, event].sort((a,b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()));
  
  // Robust optimistic update/delete functions
  const deleteEvent = async (eventId: number) => {
    const originalEvents = events;
    setEvents(prev => prev.filter(e => e.id !== eventId)); // Optimistic delete
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
        console.error("Failed to delete event:", error);
        setEvents(originalEvents); // Revert on error
    }
  };

  const updateEvent = async (updatedEvent: Event) => {
      const originalEvents = events;
      setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
      const { error } = await supabase.from('events').update({
          title: updatedEvent.title,
          description: updatedEvent.description,
          event_time: updatedEvent.event_time
      }).eq('id', updatedEvent.id);
      if (error) {
          console.error("Failed to update event:", error);
          setEvents(originalEvents);
      }
  };
  
  const attendEvent = async (eventId: number) => {
      const userId = session?.user?.id;
      if (!userId) return;
      
      const originalEvents = events;
      const originalAttendees = attendees;

      // Optimistic update
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
      setAttendees(prev => [...prev, { id: -1, event_id: eventId, user_id: userId, created_at: new Date().toISOString() }]);

      const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userId });
      if (error) {
          console.error("Failed to attend event:", error);
          setEvents(originalEvents); // Revert
          setAttendees(originalAttendees);
      }
  };

  const unattendEvent = async (eventId: number) => {
    const userId = session?.user?.id;
    if (!userId) return;

    const originalEvents = events;
    const originalAttendees = attendees;

    // Optimistic update
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, attendee_count: Math.max(0, (e.attendee_count || 1) - 1) } : e));
    setAttendees(prev => prev.filter(a => !(a.event_id === eventId && a.user_id === userId)));

    const { error } = await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userId);
    if (error) {
        console.error("Failed to unattend event:", error);
        setEvents(originalEvents); // Revert
        setAttendees(originalAttendees);
    }
  };

  const value = {
    vibes,
    sos,
    events,
    attendees,
    loading,
    error,
    addLocalVibe,
    addLocalEvent,
    updateEvent,
    deleteEvent,
    attendEvent,
    unattendEvent,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};