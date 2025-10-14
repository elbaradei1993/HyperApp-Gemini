import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Vibe, SOS, Event, Location, EventAttendee, AiEvent, LiveBriefing, WeatherInfo, NewsItem, UserSettings } from '../types';
import { AuthContext } from './AuthContext';
import { GoogleGenAI } from '@google/genai';

// --- Helper Functions ---
const parseLocationFromGeoJSON = (loc: any): Location | null => {
  if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return loc;
  }
  return null;
};

const processRecord = <T extends { location: any }>(record: T): T | null => {
  const parsedLocation = parseLocationFromGeoJSON(record.location);
  if (!parsedLocation) {
    console.warn("Skipping record due to invalid location data:", record);
    return null;
  }
  return { ...record, location: parsedLocation };
};

const reconstructAiEvents = (data: any): AiEvent[] | null => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const keys = ["eventName", "description", "date", "locationString", "sourceURL"];
    const firstKey = keys[0];
    if (!data[firstKey] || !Array.isArray(data[firstKey])) return null;

    const count = data[firstKey].length;
    const reconstructed: AiEvent[] = [];

    for (let i = 0; i < count; i++) {
        const newItem: Partial<AiEvent> = {};
        let isValid = true;
        for (const key of keys) {
            if (data[key] && typeof data[key][i] !== 'undefined') {
                (newItem as any)[key] = data[key][i];
            } else {
                isValid = false;
                break;
            }
        }
        if (isValid) {
            reconstructed.push(newItem as AiEvent);
        }
    }
    return reconstructed.length > 0 ? reconstructed : null;
};

const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    safeZoneAlerts: true,
    onDangerousVibe: true,
    onSOS: true,
  },
  privacy: {
    anonymousByDefault: false,
  },
  map: {
    defaultView: 'heatmap',
  },
};


// --- Context Definition ---
interface DataContextType {
  vibes: Vibe[];
  sos: SOS[];
  events: Event[];
  attendees: EventAttendee[];
  loading: boolean;
  error: string | null;
  addLocalVibe: (vibe: Vibe) => void;
  addLocalSOS: (sos: SOS) => void;
  addLocalEvent: (event: Event) => void;
  updateEvent: (event: Event) => Promise<void>;
  deleteEvent: (eventId: number) => Promise<void>;
  attendEvent: (eventId: number) => Promise<void>;
  unattendEvent: (eventId: number) => Promise<void>;
  deleteVibe: (vibeId: number) => Promise<void>;
  deleteSOS: (sosId: number) => Promise<void>;
  // User location and cached AI data
  currentLocation: Location | null;
  currentAddress: string | null;
  liveBriefing: LiveBriefing | null;
  liveBriefingLoading: boolean;
  liveBriefingError: string | null;
  fetchLiveBriefing: (forceRefresh?: boolean) => Promise<void>;
  aiEvents: AiEvent[];
  aiEventsLoading: boolean;
  aiEventsError: string | null;
  fetchAiEvents: (forceRefresh?: boolean) => Promise<void>;
  clearAiCache: () => void;
  // New user settings management
  userSettings: UserSettings;
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- Caching Configuration ---
const BRIEFING_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const EVENTS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const BRIEFING_CACHE_KEY = 'hyperapp-briefing-cache';
const EVENTS_CACHE_KEY = 'hyperapp-events-cache';


export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session, user } = useContext(AuthContext) || {};

  // Supabase data
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [sos, setSos] = useState<SOS[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User location
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);

  // Cached AI data
  const [liveBriefing, setLiveBriefing] = useState<LiveBriefing | null>(null);
  const [liveBriefingLoading, setLiveBriefingLoading] = useState(false);
  const [liveBriefingError, setLiveBriefingError] = useState<string | null>(null);

  const [aiEvents, setAiEvents] = useState<AiEvent[]>([]);
  const [aiEventsLoading, setAiEventsLoading] = useState(false);
  const [aiEventsError, setAiEventsError] = useState<string | null>(null);
  
  // User settings
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  
  // --- Persistent Cache Hydration ---
  useEffect(() => {
    try {
      const briefingCacheRaw = localStorage.getItem(BRIEFING_CACHE_KEY);
      if (briefingCacheRaw) {
        const { data } = JSON.parse(briefingCacheRaw);
        if (data) setLiveBriefing(data);
      }
      const eventsCacheRaw = localStorage.getItem(EVENTS_CACHE_KEY);
      if (eventsCacheRaw) {
        const { data } = JSON.parse(eventsCacheRaw);
        if (data) setAiEvents(data);
      }
    } catch (e) {
      console.error("Failed to hydrate from persistent cache:", e);
      localStorage.removeItem(BRIEFING_CACHE_KEY);
      localStorage.removeItem(EVENTS_CACHE_KEY);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_all_public_data');
      if (rpcError) throw rpcError;

      // Defensive check: Only update state if data is not null.
      // This prevents wiping out the UI if the RPC returns an empty success response.
      if (data) {
        setError(null); // Clear previous errors on a successful fetch
        const responseData = data || {};
        setVibes((responseData.vibes || []).map(processRecord).filter(Boolean) as Vibe[]);
        setSos((responseData.sos || []).map(processRecord).filter(Boolean) as SOS[]);
        setEvents((responseData.events || []).map(processRecord).filter(Boolean) as Event[]);
        setAttendees(responseData.attendees || []);
      } else {
        console.warn("Received null data from get_all_public_data RPC. Keeping existing data.");
      }
    } catch (err: any) {
      // Don't clear data on error, just show the error message.
      setError(`Error fetching data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const fetchUserSettings = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('user_settings').select('settings').eq('user_id', userId).single();
    if (data && data.settings) {
        const mergedSettings = {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            notifications: { ...DEFAULT_SETTINGS.notifications, ...data.settings.notifications },
            privacy: { ...DEFAULT_SETTINGS.privacy, ...data.settings.privacy },
            map: { ...DEFAULT_SETTINGS.map, ...data.settings.map },
        };
        setUserSettings(mergedSettings);
    } else if (error && error.code !== 'PGRST116') {
        console.error("Error fetching user settings:", error.message);
    }
  }, []);

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
      if (!user) return;
      const updatedSettings = { ...userSettings, ...newSettings };
      setUserSettings(updatedSettings);
      const { error } = await supabase.from('user_settings').upsert({
          user_id: user.id,
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
      });
      if (error) console.error("Could not save user settings:", error.message);
  };
  
  useEffect(() => {
    if (user) {
        fetchUserSettings(user.id);
    }
  }, [user, fetchUserSettings]);

  useEffect(() => {
    if (!session) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        try {
            const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                setCurrentAddress(geoData.display_name || 'Address not found');
            }
        } catch (e) {
            setCurrentAddress('Could not fetch address');
        }
    }, (err) => {
        console.error("Could not get location:", err);
        setCurrentAddress("Location permission denied.");
    });
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, fetchData]);

  useEffect(() => {
    const changesChannel = supabase.channel('public-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(changesChannel);
    };
  }, [fetchData]);
  
  const fetchLiveBriefing = useCallback(async (forceRefresh = false) => {
    const cacheRaw = localStorage.getItem(BRIEFING_CACHE_KEY);
    const cachedTimestamp = cacheRaw ? JSON.parse(cacheRaw).timestamp : 0;
    const isCacheValid = !forceRefresh && cachedTimestamp && (Date.now() - cachedTimestamp < BRIEFING_CACHE_DURATION);
    
    if (isCacheValid || liveBriefingLoading) return;
    if (!currentLocation) {
        if (!liveBriefing) setLiveBriefingError("Cannot fetch briefing without user location.");
        return;
    }
    setLiveBriefingLoading(true);
    setLiveBriefingError(null);
    try {
        let city = 'the current city', country = 'country';
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLocation.lat}&lon=${currentLocation.lng}&zoom=10`);
        if (geoResponse.ok) {
            const data = await geoResponse.json();
            city = data.address.city || data.address.town || data.address.county || 'the area';
            country = data.address.country || '';
        }

        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API key not configured.");
        const ai = new GoogleGenAI({ apiKey });
        const timeOfDay = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const prompt = `Act as a local safety reporter for ${city}, ${country} at ${timeOfDay}.
1. Your first line MUST be a weather report prefixed with "WEATHER: ". The format MUST be a JSON-like string: {"temperature": "15°C", "condition": "Cloudy", "icon_keyword": "cloudy"}. The icon_keyword must be one of: sunny, cloudy, rainy, stormy, snowy.
2. After the weather line, you MUST provide a valid JSON array of 3-5 objects. Each object represents a significant trending news item and MUST have these exact keys: "headline", "summary", and "sourceURL". The sourceURL MUST be the direct URL to the original article.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 } }
        });

        let rawText = response.text.trim();
        const lines = rawText.split('\n');
        let weatherData: WeatherInfo | undefined;
        let newsItems: NewsItem[] = [];

        if (lines[0].startsWith('WEATHER:')) {
            const weatherLine = lines[0].substring('WEATHER:'.length).trim();
            try {
                const parsedWeather = JSON.parse(weatherLine);
                weatherData = { text: `${parsedWeather.temperature}, ${parsedWeather.condition}`, icon: parsedWeather.icon_keyword || 'cloudy' };
            } catch (e) { console.warn("Could not parse structured weather line:", weatherLine); }
        }

        // FIX: Make JSON parsing more robust to handle markdown code blocks and other text.
        let jsonString = rawText;
        if (jsonString.includes('```json')) {
            jsonString = jsonString.split('```json')[1];
        }
        if (jsonString.includes('```')) {
            jsonString = jsonString.split('```')[0];
        }
        jsonString = jsonString.trim();
        
        const jsonStartIndex = jsonString.indexOf('[');
        const jsonEndIndex = jsonString.lastIndexOf(']');

        if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            const finalJsonString = jsonString.substring(jsonStartIndex, jsonEndIndex + 1);
            try {
                newsItems = JSON.parse(finalJsonString);
            } catch (e) { throw new Error("The AI returned a malformed news list."); }
        } else {
            throw new Error("The AI did not return a valid news list.");
        }
        
        const newBriefing = { news: newsItems, weather: weatherData };
        setLiveBriefing(newBriefing);
        localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify({ data: newBriefing, timestamp: Date.now() }));
        
    } catch (err: any) {
        setLiveBriefingError(`Failed to generate briefing: ${err.message}`);
    } finally {
        setLiveBriefingLoading(false);
    }
  }, [currentLocation, liveBriefingLoading, liveBriefing]);

  const fetchAiEvents = useCallback(async (forceRefresh = false) => {
    const cacheRaw = localStorage.getItem(EVENTS_CACHE_KEY);
    const cachedTimestamp = cacheRaw ? JSON.parse(cacheRaw).timestamp : 0;
    const isCacheValid = !forceRefresh && cachedTimestamp && (Date.now() - cachedTimestamp < EVENTS_CACHE_DURATION);

    if (isCacheValid || aiEventsLoading) return;
    if (!currentLocation) {
        if (aiEvents.length === 0) setAiEventsError("Cannot fetch events without user location.");
        return;
    }
    setAiEventsLoading(true);
    setAiEventsError(null);
    try {
        let locationQuery = "the user's current city";
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLocation.lat}&lon=${currentLocation.lng}&zoom=10`);
        if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            const city = geoData.address.city || geoData.address.town || geoData.address.county;
            const country = geoData.address.country;
            if (city && country) locationQuery = `${city}, ${country}`;
        }
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API key not configured.");
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Find a maximum of 20 public, community-focused events in ${locationQuery} happening in the next 7 days. You MUST respond with ONLY a valid JSON array of objects, like this: [{"eventName": "Event Name", "description": "A cool event", "date": "YYYY-MM-DD", "locationString": "123 Main St", "sourceURL": "https://example.com/event"}]. You MUST include the sourceURL for every event. If none, return an empty array [].`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 } }
        });

        let jsonStr = response.text.trim().replace(/^```json|```$/g, '').trim();
        const parsedData = JSON.parse(jsonStr);
        let eventsArray = Array.isArray(parsedData) ? parsedData : reconstructAiEvents(parsedData);
        if (eventsArray) {
            setAiEvents(eventsArray);
            localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ data: eventsArray, timestamp: Date.now() }));
            if (eventsArray.length === 0) setAiEventsError("No community events were found in your area.");
        } else {
            throw new Error("Response was not a valid or reconstructible event list.");
        }
    } catch (err: any) {
        setAiEventsError(err.message || "Failed to discover events.");
    } finally {
        setAiEventsLoading(false);
    }
  }, [currentLocation, aiEventsLoading, aiEvents]);
  
  const clearAiCache = () => {
    setLiveBriefing(null);
    setAiEvents([]);
    localStorage.removeItem(BRIEFING_CACHE_KEY);
    localStorage.removeItem(EVENTS_CACHE_KEY);
  };
  
  const addLocalVibe = (vibe: Vibe) => setVibes(prev => [vibe, ...prev]);
  const addLocalSOS = (sosItem: SOS) => setSos(prev => [sosItem, ...prev]);
  const addLocalEvent = (event: Event) => setEvents(prev => [...prev, event].sort((a,b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()));
  
  const deleteVibe = async (vibeId: number) => {
    const originalVibes = vibes;
    setVibes(prev => prev.filter(v => v.id !== vibeId));
    const { error } = await supabase.from('vibes').delete().eq('id', vibeId);
    if (error) setVibes(originalVibes);
  };
  
  const deleteSOS = async (sosId: number) => {
    const originalSOS = sos;
    setSos(prev => prev.filter(s => s.id !== sosId));
    const { error } = await supabase.from('sos').delete().eq('id', sosId);
    if (error) setSos(originalSOS);
  };

  const deleteEvent = async (eventId: number) => {
    const originalEvents = events;
    setEvents(prev => prev.filter(e => e.id !== eventId));
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) setEvents(originalEvents);
  };

  const updateEvent = async (updatedEvent: Event) => {
      const originalEvents = events;
      setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
      const { error } = await supabase.from('events').update({
          title: updatedEvent.title, description: updatedEvent.description, event_time: updatedEvent.event_time, end_time: updatedEvent.end_time
      }).eq('id', updatedEvent.id);
      if (error) setEvents(originalEvents);
  };
  
  const attendEvent = async (eventId: number) => {
      const userId = session?.user?.id; if (!userId) return;
      const originalEvents = events, originalAttendees = attendees;
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e));
      setAttendees(prev => [...prev, { id: -1, event_id: eventId, user_id: userId, created_at: new Date().toISOString() }]);
      const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userId });
      if (error) { setEvents(originalEvents); setAttendees(originalAttendees); }
  };

  const unattendEvent = async (eventId: number) => {
    const userId = session?.user?.id; if (!userId) return;
    const originalEvents = events, originalAttendees = attendees;
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, attendee_count: Math.max(0, (e.attendee_count || 1) - 1) } : e));
    setAttendees(prev => prev.filter(a => !(a.event_id === eventId && a.user_id === userId)));
    const { error } = await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userId);
    if (error) { setEvents(originalEvents); setAttendees(originalAttendees); }
  };

  const value = {
    vibes, sos, events, attendees, loading, error,
    addLocalVibe, addLocalSOS, addLocalEvent, updateEvent, deleteEvent, attendEvent, unattendEvent,
    deleteVibe, deleteSOS,
    currentLocation, currentAddress,
    liveBriefing, liveBriefingLoading, liveBriefingError, fetchLiveBriefing,
    aiEvents, aiEventsLoading, aiEventsError, fetchAiEvents, clearAiCache,
    userSettings, updateUserSettings
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};
