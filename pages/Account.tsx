import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useLocation as useReactRouterLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Profile, SafeZone, Location, Vibe, SOS, Event as CommunityEvent } from '../types';
import { TrashIcon, PlusCircleIcon, LocationMarkerIcon, UserGroupIcon, FireIcon, ExclamationTriangleIcon } from '../components/ui/Icons';
import { VIBE_DISPLAY_NAMES } from '../components/activity/ActivityCard';
import { timeAgo } from '../utils/time';

type UserActivityItem =
  | (Vibe & { itemType: 'vibe' })
  | (SOS & { itemType: 'sos' })
  | (CommunityEvent & { itemType: 'event' });

const PersonalActivityCard: React.FC<{ item: UserActivityItem; onDelete: () => void; }> = ({ item, onDelete }) => {
    let icon, title, details;
    const canDelete = item.itemType === 'vibe' || item.itemType === 'sos';

    switch (item.itemType) {
        case 'vibe':
            icon = <FireIcon className="w-5 h-5 text-orange-400" />;
            title = `You reported a "${VIBE_DISPLAY_NAMES[item.vibe_type]}" vibe.`;
            details = timeAgo(item.created_at);
            break;
        case 'sos':
            icon = <ExclamationTriangleIcon className="w-5 h-5 text-brand-danger" />;
            title = `You sent an SOS alert.`;
            details = `"${item.details}" • ${timeAgo(item.created_at)}`;
            break;
        case 'event':
            icon = <UserGroupIcon className="w-5 h-5 text-brand-accent" />;
            title = `You created the event: ${item.title}`;
            details = new Date(item.event_time).toLocaleDateString();
            break;
    }

    return (
        <div className="bg-brand-primary/50 p-3 rounded-lg flex items-center space-x-3">
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-grow">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-text-secondary">{details}</p>
            </div>
            {canDelete && (
                <button onClick={onDelete} className="text-gray-500 hover:text-brand-danger p-1">
                    <TrashIcon className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

const Card: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
    <div className={`bg-brand-secondary/40 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 ${className}`}>
        {children}
    </div>
);


const Account: React.FC = () => {
  const auth = useContext(AuthContext);
  const { vibes, sos, events, attendees, deleteVibe, deleteSOS } = useData();
  const navigate = useNavigate();
  const reactRouterLocation = useReactRouterLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Profile state (both view and edit)
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Page-specific state
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(1);
  const [newZoneLocation, setNewZoneLocation] = useState<Location | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'vibe' | 'sos' | 'event'>('all');
  const [eventsTab, setEventsTab] = useState<'attending' | 'created'>('attending');
  
  // Fetch full profile data
  useEffect(() => {
    const getProfile = async () => {
      if (!auth?.user) return;
      setLoading(true);
      try {
        const { data, error, status } = await supabase
          .from('profiles')
          .select(`username, full_name, avatar_url, bio`)
          .eq('id', auth.user.id)
          .single();
        if (error && status !== 406) throw error;
        if (data) {
          setProfile(data as Profile);
          setUsername(data.username || '');
          setFullName(data.full_name || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatar_url);
        }
      } catch (error: any) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    };
    getProfile();
  }, [auth?.user]);
  
  // Handle location state for new safe zones
  useEffect(() => {
    if (reactRouterLocation.state?.newZoneLocation) {
        setNewZoneLocation(reactRouterLocation.state.newZoneLocation);
        setIsAddingZone(true);
        window.history.replaceState({}, document.title);
    }
  }, [reactRouterLocation.state]);

  // Fetch Safe Zones
  useEffect(() => {
    const fetchSafeZones = async () => {
        if (!auth?.user) return;
        const { data, error } = await supabase.from('safe_zones').select('*').eq('user_id', auth.user.id);
        if (error) { alert(error.message); } else if (data) { setSafeZones(data); }
    };
    fetchSafeZones();
  }, [auth?.user]);

  // Data Memoization for user-specific content
  const myVibes = useMemo(() => vibes.filter(v => v.user_id === auth?.user?.id), [vibes, auth?.user]);
  const mySOS = useMemo(() => sos.filter(s => s.user_id === auth?.user?.id), [sos, auth?.user]);
  const myCreatedEvents = useMemo(() => events.filter(e => e.user_id === auth?.user?.id), [events, auth?.user]);
  
  const attendingEventIds = useMemo(() => new Set(attendees.filter(a => a.user_id === auth?.user?.id).map(a => a.event_id)), [attendees, auth?.user]);
  const myAttendingEvents = useMemo(() => events.filter(e => attendingEventIds.has(e.id)), [events, attendingEventIds]);

  const personalActivityFeed = useMemo(() => {
    const combined: UserActivityItem[] = [
        ...myVibes.map(v => ({ ...v, itemType: 'vibe' as const })),
        ...mySOS.map(s => ({ ...s, itemType: 'sos' as const })),
        ...myCreatedEvents.map(e => ({ ...e, itemType: 'event' as const })),
    ];
    const sorted = combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (activityFilter === 'all') return sorted;
    return sorted.filter(item => item.itemType === activityFilter);
  }, [myVibes, mySOS, myCreatedEvents, activityFilter]);

  // Event Handlers
  const handleEditToggle = (cancel = false) => {
    if (cancel && profile) { // Reset form fields on cancel
        setUsername(profile.username || '');
        setFullName(profile.full_name || '');
        setBio(profile.bio || '');
    }
    setIsEditing(prev => !prev);
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.user) return;
    setLoading(true);
    try {
      const updates = { id: auth.user.id, username, full_name: fullName, bio, updated_at: new Date() };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      // FIX: The object passed to `setProfile` must be a valid `Profile`. The original `updates`
      // object had `updated_at` as a Date object, which caused a type mismatch. This converts
      // it to a string and ensures the update is safe. The ternary also handles the edge
      // case where the previous state might be null.
      setProfile(prev => prev ? { ...prev, ...updates, updated_at: updates.updated_at.toISOString() } : prev);
      alert('Profile updated!');
      setIsEditing(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!auth?.user) return;
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('You must select an image to upload.');
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${auth.user.id}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', auth.user.id);
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteActivity = async (item: UserActivityItem) => {
    if (window.confirm(`Are you sure you want to delete this ${item.itemType}? This cannot be undone.`)) {
        if (item.itemType === 'vibe') await deleteVibe(item.id);
        else if (item.itemType === 'sos') await deleteSOS(item.id);
    }
  }

  const handleAddSafeZone = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!auth?.user || !newZoneName || !newZoneRadius || !newZoneLocation) return alert("Please provide a name, radius, and location.");
      const { data, error } = await supabase.from('safe_zones').insert({ user_id: auth.user.id, name: newZoneName, radius_km: newZoneRadius, location: `SRID=4326;POINT(${newZoneLocation.lng} ${newZoneLocation.lat})` }).select().single();
      if (error) { alert(error.message); } 
      else if (data) { setSafeZones(prev => [...prev, data]); setIsAddingZone(false); setNewZoneName(''); setNewZoneRadius(1); setNewZoneLocation(null); }
  };
  
  const handleDeleteSafeZone = async (zoneId: number) => {
      if (window.confirm("Delete this safe zone?")) {
          const { error } = await supabase.from('safe_zones').delete().eq('id', zoneId);
          if (error) { alert(error.message); } else { setSafeZones(prev => prev.filter(z => z.id !== zoneId)); }
      }
  }

  if (loading) return <div className="p-4 text-text-primary text-center">Loading profile...</div>;

  return (
    <div className="p-4 space-y-6">
        {isEditing ? (
            <Card className="animate-fade-in space-y-4">
                <h2 className="text-xl font-semibold">Edit Profile</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <img src={avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${username}`} alt="Avatar" className="w-20 h-20 rounded-full object-cover bg-gray-700" />
                        <div>
                            <label htmlFor="avatar-upload" className="text-sm font-semibold bg-gray-600 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-500">{uploading ? 'Uploading...' : 'Change Photo'}</label>
                            <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploading} />
                        </div>
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-text-secondary">Username</label>
                      <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="mt-1 block w-full bg-gray-800 border-gray-600 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-text-secondary">Full Name</label>
                      <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 block w-full bg-gray-800 border-gray-600 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label htmlFor="bio" className="block text-sm font-medium text-text-secondary">Bio</label>
                      <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-800 border-gray-600 rounded-md shadow-sm" />
                    </div>
                    <div className="flex space-x-2">
                        <button type="submit" disabled={loading} className="flex-1 bg-brand-accent text-brand-primary font-bold py-2 px-4 rounded-md hover:bg-cyan-400">Save Changes</button>
                        <button type="button" onClick={() => handleEditToggle(true)} className="flex-1 bg-gray-600 text-text-primary font-bold py-2 px-4 rounded-md">Cancel</button>
                    </div>
                </form>
            </Card>
        ) : (
            <>
                <Card>
                    <div className="flex items-center space-x-4">
                        <img src={avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${username}`} alt="Avatar" className="w-20 h-20 rounded-full object-cover bg-gray-700" />
                        <div className="flex-grow">
                            <h1 className="text-2xl font-bold">{fullName || 'New User'}</h1>
                            <p className="text-brand-accent">@{username}</p>
                            <p className="text-sm text-text-secondary mt-1">{bio || 'No bio yet.'}</p>
                        </div>
                        <button onClick={() => handleEditToggle()} className="bg-gray-700 text-sm font-semibold px-4 py-2 rounded-md hover:bg-gray-600">Edit Profile</button>
                    </div>
                </Card>

                <Card className="space-y-3">
                    <h2 className="text-xl font-semibold">Your Contributions</h2>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <button onClick={() => setActivityFilter('vibe')} className={`p-2 rounded-lg text-center transition-colors ${activityFilter === 'vibe' ? 'bg-brand-accent/20' : 'bg-brand-primary/50'}`}>
                            <FireIcon className="w-6 h-6 text-orange-400 mx-auto" />
                            <p className="text-2xl font-bold mt-1">{myVibes.length}</p>
                            <p className="text-xs text-text-secondary">Vibes</p>
                        </button>
                         <button onClick={() => setActivityFilter('sos')} className={`p-2 rounded-lg text-center transition-colors ${activityFilter === 'sos' ? 'bg-brand-accent/20' : 'bg-brand-primary/50'}`}>
                            <ExclamationTriangleIcon className="w-6 h-6 text-brand-danger mx-auto" />
                            <p className="text-2xl font-bold mt-1">{mySOS.length}</p>
                            <p className="text-xs text-text-secondary">SOS Alerts</p>
                        </button>
                         <button onClick={() => setActivityFilter('event')} className={`p-2 rounded-lg text-center transition-colors ${activityFilter === 'event' ? 'bg-brand-accent/20' : 'bg-brand-primary/50'}`}>
                            <UserGroupIcon className="w-6 h-6 text-brand-accent mx-auto" />
                            <p className="text-2xl font-bold mt-1">{myCreatedEvents.length}</p>
                            <p className="text-xs text-text-secondary">Events</p>
                        </button>
                    </div>
                </Card>

                <Card className="space-y-3">
                     <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Your Activity</h2>
                        {activityFilter !== 'all' && (
                            <button onClick={() => setActivityFilter('all')} className="text-xs text-brand-accent font-semibold">Show All</button>
                        )}
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {personalActivityFeed.length > 0 ? (
                            personalActivityFeed.map(item => (
                                <PersonalActivityCard key={`${item.itemType}-${item.id}`} item={item} onDelete={() => handleDeleteActivity(item)} />
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-4">No activity to show for this filter.</p>
                        )}
                    </div>
                </Card>
                
                <Card className="space-y-3">
                    <h2 className="text-xl font-semibold">Your Events</h2>
                    <div className="flex space-x-1 bg-brand-primary p-1 rounded-lg">
                        <button onClick={() => setEventsTab('attending')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${eventsTab === 'attending' ? 'bg-brand-accent text-brand-primary' : ''}`}>Attending ({myAttendingEvents.length})</button>
                        <button onClick={() => setEventsTab('created')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${eventsTab === 'created' ? 'bg-brand-accent text-brand-primary' : ''}`}>Created ({myCreatedEvents.length})</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {(eventsTab === 'attending' ? myAttendingEvents : myCreatedEvents).length > 0 ? (
                            (eventsTab === 'attending' ? myAttendingEvents : myCreatedEvents).map(event => (
                                <div key={event.id} className="bg-brand-primary/50 p-3 rounded-lg">
                                    <p className="font-semibold">{event.title}</p>
                                    <p className="text-xs text-text-secondary">{new Date(event.event_time).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                             <p className="text-center text-gray-500 py-4">No events in this category.</p>
                        )}
                    </div>
                </Card>

                <Card className="space-y-4">
                    <h2 className="text-xl font-semibold">Your Safe Zones</h2>
                    <div className="space-y-2">
                        {safeZones.map(zone => (
                            <div key={zone.id} className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
                                <p className="font-medium">{zone.name}</p>
                                <button onClick={() => handleDeleteSafeZone(zone.id)} className="text-text-secondary hover:text-brand-danger p-1"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                        {safeZones.length === 0 && <p className="text-text-secondary text-sm text-center py-4">No safe zones created.</p>}
                    </div>
                    {isAddingZone ? (
                        <form onSubmit={handleAddSafeZone} className="pt-4 border-t border-gray-700 space-y-3">
                            <input id="zoneName" type="text" placeholder="Zone Name" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} required className="block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-sm" />
                            <input id="zoneRadius" type="range" min="0.5" max="10" step="0.5" value={newZoneRadius} onChange={e => setNewZoneRadius(parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                            <div className="flex space-x-2"><button type="submit" className="flex-1 bg-brand-accent text-sm rounded-md">Save</button><button type="button" onClick={() => setIsAddingZone(false)} className="flex-1 bg-gray-600 text-sm rounded-md">Cancel</button></div>
                        </form>
                    ) : (
                        <button onClick={() => navigate('/', { state: { settingZone: true } })} className="w-full mt-2 flex items-center justify-center space-x-2 bg-gray-600 font-bold py-2 px-4 rounded-md hover:bg-gray-500">
                            <PlusCircleIcon className="w-5 h-5" /><span>Add Safe Zone</span>
                        </button>
                    )}
                </Card>
            </>
        )}
    </div>
  );
};

export default Account;