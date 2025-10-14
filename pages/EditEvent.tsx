import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import type { Event as CommunityEvent } from '../types';

const EditEvent: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const auth = useContext(AuthContext);
    const { updateEvent } = useData();

    const [event, setEvent] = useState<CommunityEvent | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [endTime, setEndTime] = useState(''); // New state for end time
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvent = async () => {
            if (!id) {
                navigate('/events');
                return;
            }

            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('events')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !data) {
                setError("Event not found or an error occurred.");
                setLoading(false);
                return;
            }

            if (data.user_id !== auth?.user?.id) {
                setError("You are not authorized to edit this event.");
                setLoading(false);
                return;
            }

            const eventData = data as CommunityEvent;
            setEvent(eventData);
            setTitle(eventData.title);
            setDescription(eventData.description);
            
            // Format start time for datetime-local input
            const localEventTime = new Date(new Date(eventData.event_time).getTime() - (new Date().getTimezoneOffset() * 60000))
                .toISOString().slice(0, 16);
            setEventTime(localEventTime);

            // Format end time for datetime-local input, if it exists
            if (eventData.end_time) {
                const localEndTime = new Date(new Date(eventData.end_time).getTime() - (new Date().getTimezoneOffset() * 60000))
                    .toISOString().slice(0, 16);
                setEndTime(localEndTime);
            }
            
            setLoading(false);
        };

        if (auth?.user) {
            fetchEvent();
        }
    }, [id, auth?.user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!event) return;

        if (endTime && new Date(endTime) <= new Date(eventTime)) {
            setError("End time must be after the start time.");
            return;
        }

        setSaving(true);
        
        const updatedEventData: CommunityEvent = {
            ...event,
            title,
            description,
            event_time: new Date(eventTime).toISOString(),
            end_time: endTime ? new Date(endTime).toISOString() : null,
        };

        await updateEvent(updatedEventData);
        alert("Event updated successfully!");
        navigate('/events');
        
        setSaving(false);
    };

    if (loading) return <div className="p-4 text-center">Loading event details...</div>;
    if (error) return <div className="p-4 text-center bg-red-500/20 text-red-300 rounded-md">{error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-6">Edit Event</h1>
            <form onSubmit={handleSubmit} className="bg-brand-secondary p-4 rounded-lg space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-400">Event Title</label>
                    <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-400">Description</label>
                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={4} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="eventTime" className="block text-sm font-medium text-gray-400">Start Date and Time</label>
                    <input id="eventTime" type="datetime-local" value={eventTime} onChange={e => setEventTime(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                </div>
                 <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-gray-400">End Date and Time (Optional)</label>
                    <input id="endTime" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm" />
                </div>
                <div className="flex space-x-2">
                    <button type="submit" disabled={saving} className="flex-1 bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center">
                        {saving ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                    <button type="button" onClick={() => navigate('/events')} className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditEvent;