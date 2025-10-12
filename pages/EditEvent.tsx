import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { LocationMarkerIcon } from '../components/ui/Icons';
import type { Event as CommunityEvent, Location } from '../types';

// Helper to parse location, as it might be in different formats in the database
const parseLocationFromDb = (loc: any): Location | null => {
    if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return loc;
    }
    if (typeof loc === 'string' && loc.includes('POINT')) {
        const coordsMatch = loc.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
        if (coordsMatch && coordsMatch.length === 3) {
            return { lng: parseFloat(coordsMatch[1]), lat: parseFloat(coordsMatch[2]) };
        }
    }
    return null;
}

const EditEvent: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [location, setLocation] = useState<Location | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingAddress, setIsFetchingAddress] = useState(false);
    
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const auth = useContext(AuthContext);

    useEffect(() => {
        const fetchEvent = async () => {
            if (!id || !auth?.user) {
                navigate('/events');
                return;
            }
            const { data, error: fetchError } = await supabase.from('events').select('*').eq('id', id).single();
            
            if (fetchError || !data) {
                setError("Event not found.");
                setLoading(false);
                return;
            }
            if (data.user_id !== auth.user.id) {
                setError("You are not authorized to edit this event.");
                setLoading(false);
                return;
            }

            const parsedLocation = parseLocationFromDb(data.location);
            
            if (parsedLocation) {
                 setLocation(parsedLocation);
            }
            
            setTitle(data.title);
            setDescription(data.description);
            // Format for datetime-local input, handling potential timezone issues
            const eventDate = new Date(data.event_time);
            const timezoneOffset = eventDate.getTimezoneOffset() * 60000;
            const localISOTime = new Date(eventDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
            setEventTime(localISOTime);
            setLoading(false);
        };
        // Wait for auth to be resolved before fetching
        if (!auth?.loading) {
            fetchEvent();
        }
    }, [id, auth?.user, auth?.loading, navigate]);

     useEffect(() => {
        if (routerLocation.state?.newEventLocation) {
            const { lat, lng } = routerLocation.state.newEventLocation;
            setLocation({ lat, lng });
            window.history.replaceState({}, document.title);
        }
    }, [routerLocation.state]);

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
        if (!title || !description || !eventTime || !location || !id) {
            setError("All fields are required.");
            return;
        }

        setSubmitting(true);
        setError(null);
        
        const locationPayload = `SRID=4326;POINT(${location.lng} ${location.lat})`;

        const { error: updateError } = await supabase.from('events').update({
            title,
            description,
            event_time: new Date(eventTime).toISOString(),
            location: locationPayload,
        }).eq('id', id);

        if (updateError) {
            setError(updateError.message);
        } else {
            alert("Event updated successfully!");
            // The DataContext will handle the realtime update, so we can just navigate.
            navigate('/events');
        }
        setSubmitting(false);
    };
    
    const handleSelectOnMap = () => navigate('/', { state: { settingEvent: true } });

    if (loading) return <div className="p-4 text-white text-center">Loading event...</div>;

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-6">Edit Community Event</h1>
            
            {error ? (
                <div className="bg-red-500/20 text-red-400 p-3 rounded-md text-center">{error}</div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-brand-secondary p-4 rounded-lg space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-400">Event Title</label>
                        <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-400">Description</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={4} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" />
                    </div>

                    <div>
                        <label htmlFor="eventTime" className="block text-sm font-medium text-gray-400">Date and Time</label>
                        <input id="eventTime" type="datetime-local" value={eventTime} onChange={e => setEventTime(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Location</label>
                        <button type="button" onClick={handleSelectOnMap} disabled={isFetchingAddress} className="mt-1 w-full flex items-center justify-center space-x-2 text-left p-2 bg-gray-700 border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50">
                            <LocationMarkerIcon className="w-5 h-5 text-brand-accent" />
                            <span className="truncate">{isFetchingAddress ? 'Fetching address...' : address || 'Location selected. Click to change.'}</span>
                        </button>
                    </div>

                    <button type="submit" disabled={submitting} className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait">
                        {submitting ? 'Updating...' : 'Update Event'}
                    </button>
                    <button type="button" onClick={() => navigate(-1)} className="w-full mt-2 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500">
                        Cancel
                    </button>
                </form>
            )}
        </div>
    );
};

export default EditEvent;
