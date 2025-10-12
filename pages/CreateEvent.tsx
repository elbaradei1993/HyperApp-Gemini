import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LocationMarkerIcon } from '../components/ui/Icons';
import { GoogleGenAI } from '@google/genai';
import type { Event as CommunityEvent } from '../types';

const CreateEvent: React.FC = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [endTime, setEndTime] = useState(''); // New state for end time
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingAddress, setIsFetchingAddress] = useState(false);
    const [isAiEnhancing, setIsAiEnhancing] = useState(false);

    const routerLocation = useLocation();
    const navigate = useNavigate();
    const auth = useContext(AuthContext);
    const { addLocalEvent } = useData();

    useEffect(() => {
        if (routerLocation.state?.newEventLocation) {
            const { lat, lng } = routerLocation.state.newEventLocation;
            setLocation({ lat, lng });
            window.history.replaceState({}, document.title);
        } else {
            navigate('/', { state: { settingEvent: true } });
        }
    }, [routerLocation.state, navigate]);

    useEffect(() => {
        if (location) {
            const fetchAddress = async () => {
                setIsFetchingAddress(true);
                setAddress(null);
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`);
                    if (!response.ok) throw new Error('Failed to fetch from Nominatim');
                    const data = await response.json();
                    setAddress(data.display_name || 'Address not found');
                } catch (err: any) {
                    setAddress('Could not fetch address');
                } finally {
                    setIsFetchingAddress(false);
                }
            };
            fetchAddress();
        }
    }, [location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!title || !description || !eventTime || !location || !auth?.user) {
            setError("All fields are required and you must be logged in.");
            return;
        }

        if (endTime && new Date(endTime) <= new Date(eventTime)) {
            setError("End time must be after the start time.");
            return;
        }

        setLoading(true);
        const locationPayload = `SRID=4326;POINT(${location.lng} ${location.lat})`;
        const newEventData = {
            user_id: auth.user.id,
            title,
            description,
            event_time: new Date(eventTime).toISOString(),
            end_time: endTime ? new Date(endTime).toISOString() : null, // Include end_time
            location: locationPayload,
        };

        const { data, error: insertError } = await supabase.from('events').insert(newEventData).select().single();

        if (insertError) {
            setError(insertError.message);
        } else if (data) {
            const optimisticEvent: CommunityEvent = {
              id: data.id,
              created_at: data.created_at,
              user_id: auth.user.id,
              title,
              description,
              event_time: new Date(eventTime).toISOString(),
              end_time: endTime ? new Date(endTime).toISOString() : null,
              location,
              profiles: { username: 'You' },
              attendee_count: 0,
            };
            addLocalEvent(optimisticEvent);
            alert("Event created successfully!");
            navigate('/events');
        }
        setLoading(false);
    };
    
    const handleAiEnhance = async () => {
        if (!description.trim()) {
            setError("Please write a basic description first.");
            return;
        }
        setIsAiEnhancing(true);
        setError(null);
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API key not configured.");
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `Enhance the following event description to make it more inviting and clear. Keep it concise (2-3 sentences). Original description: "${description}"`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setDescription(response.text);
        } catch (err: any) {
            setError(`AI enhancement failed: ${err.message}`);
        } finally {
            setIsAiEnhancing(false);
        }
    };

    const handleSelectOnMap = () => navigate('/', { state: { settingEvent: true } });

    useEffect(() => {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
        const defaultDateTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setEventTime(defaultDateTime);
    }, []);

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-6">Create Community Event</h1>
            <form onSubmit={handleSubmit} className="bg-brand-secondary p-4 rounded-lg space-y-4">
                {error && <p className="bg-red-500/20 text-red-400 p-3 rounded-md text-center">{error}</p>}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-400">Event Title</label>
                    <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-400">Description</label>
                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={4} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                    <button type="button" onClick={handleAiEnhance} disabled={isAiEnhancing} className="text-xs text-brand-accent hover:text-blue-400 mt-1 disabled:opacity-50">
                        {isAiEnhancing ? 'Enhancing...' : 'Make it better with AI ✨'}
                    </button>
                </div>
                <div>
                    <label htmlFor="eventTime" className="block text-sm font-medium text-gray-400">Start Date and Time</label>
                    <input id="eventTime" type="datetime-local" value={eventTime} onChange={e => setEventTime(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-gray-400">End Date and Time (Optional)</label>
                    <input id="endTime" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400">Location</label>
                    <button type="button" onClick={handleSelectOnMap} disabled={isFetchingAddress} className="mt-1 w-full flex items-center justify-center space-x-2 text-left p-2 bg-gray-700 border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50">
                        <LocationMarkerIcon className="w-5 h-5 text-brand-accent" />
                        <span className="truncate">{isFetchingAddress ? 'Fetching address...' : address || 'Location selected. Click to change.'}</span>
                    </button>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait">
                    {loading ? 'Creating...' : 'Create Event'}
                </button>
                <button type="button" onClick={() => navigate(-1)} className="w-full mt-2 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500">
                    Cancel
                </button>
            </form>
        </div>
    );
};

export default CreateEvent;