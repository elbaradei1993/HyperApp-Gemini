import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Profile, SafeZone, Location } from '../types';
import { TrashIcon, PlusCircleIcon, LocationMarkerIcon } from '../components/ui/Icons';
import { useLocation as useReactRouterLocation } from 'react-router-dom';
import { ActivityCard, ActivityItem } from '../components/activity/ActivityCard';


const Account: React.FC = () => {
  const auth = useContext(AuthContext);
  const { vibes, sos, events, loading: dataLoading, error: dataError } = useData();
  const navigate = useNavigate();
  const reactRouterLocation = useReactRouterLocation();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(1);
  const [newZoneLocation, setNewZoneLocation] = useState<Location | null>(null);

  // --- Global Community Activity Feed Logic ---
  const sortedActivityFeed = useMemo(() => {
        const combined: ActivityItem[] = [
            ...vibes.map(v => ({ ...v, itemType: 'vibe' as const })),
            ...sos.map(s => ({ ...s, itemType: 'sos' as const })),
            ...events.map(e => ({ ...e, itemType: 'event' as const })),
        ];

        return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [vibes, sos, events]);


  useEffect(() => {
    const getProfile = async () => {
      if (!auth?.user) return;
      setLoading(true);
      try {
        const { data, error, status } = await supabase
          .from('profiles')
          .select(`username, full_name, avatar_url`)
          .eq('id', auth.user.id)
          .single();
        if (error && status !== 406) throw error;
        if (data) {
          setProfile(data as Profile);
          setUsername(data.username || '');
          setFullName(data.full_name || '');
        }
      } catch (error: any) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    };
    getProfile();
  }, [auth?.user]);
  
  useEffect(() => {
    if (reactRouterLocation.state?.newZoneLocation) {
        setNewZoneLocation(reactRouterLocation.state.newZoneLocation);
        setIsAddingZone(true);
        window.history.replaceState({}, document.title);
    }
  }, [reactRouterLocation.state]);

  const fetchSafeZones = async () => {
    if (!auth?.user) return;
    const { data, error } = await supabase
      .from('safe_zones')
      .select('*')
      .eq('user_id', auth.user.id);

    if (error) {
      alert(error.message);
    } else if (data) {
      setSafeZones(data);
    }
  };

  useEffect(() => {
    fetchSafeZones();
  }, [auth?.user]);


  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.user) return;
    setLoading(true);
    try {
      const updates = {
        id: auth.user.id,
        username,
        full_name: fullName,
        updated_at: new Date(),
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      alert('Profile updated!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddSafeZone = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!auth?.user || !newZoneName || !newZoneRadius || !newZoneLocation) {
          alert("Please provide a name, radius, and location for your safe zone.");
          return;
      }
      
      const locationPayload = `SRID=4326;POINT(${newZoneLocation.lng} ${newZoneLocation.lat})`;
      
      const { data, error } = await supabase.from('safe_zones').insert({
          user_id: auth.user.id,
          name: newZoneName,
          radius_km: newZoneRadius,
          location: locationPayload
      }).select().single();
      
      if (error) {
          alert(error.message);
      } else if (data) {
          setSafeZones(prev => [...prev, data]);
          setIsAddingZone(false);
          setNewZoneName('');
          setNewZoneRadius(1);
          setNewZoneLocation(null);
      }
  };
  
  const handleDeleteSafeZone = async (zoneId: number) => {
      if (window.confirm("Are you sure you want to delete this safe zone?")) {
          const { error } = await supabase.from('safe_zones').delete().eq('id', zoneId);
          if (error) {
              alert(error.message);
          } else {
              setSafeZones(prev => prev.filter(z => z.id !== zoneId));
          }
      }
  }


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    } else {
      navigate('/login', { replace: true });
    }
  };

  if (loading) return <div className="p-4 text-white text-center">Loading profile...</div>;

  return (
    <div className="p-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="text-gray-400">Manage your profile and settings.</p>
      </div>
      
       <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Community Activity Feed</h2>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {dataLoading ? <p className="text-center py-8 text-gray-400">Loading activity...</p>
            : dataError ? <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{dataError}</p>
            : sortedActivityFeed.length === 0 ? (
                <p className="text-center py-8 text-gray-400">No recent activity in the community.</p>
            )
            : (
                <div className="space-y-4">
                    {sortedActivityFeed.map(item => (
                        <ActivityCard key={`${item.itemType}-${item.id}`} item={item} />
                    ))}
                </div>
            )}
        </div>
      </div>
      
      <form onSubmit={updateProfile} className="bg-brand-secondary p-4 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Your Profile</h2>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-400">Email</label>
          <input id="email" type="text" value={auth?.user?.email} disabled className="mt-1 block w-full bg-gray-800 border-gray-600 rounded-md shadow-sm text-gray-400" />
        </div>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-400">Username</label>
          <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" />
        </div>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-400">Full Name</label>
          <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50">
          {loading ? 'Saving...' : 'Update Profile'}
        </button>
      </form>
      
      <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Your Safe Zones</h2>
        <p className="text-sm text-gray-400">Get notifications for critical alerts in these areas.</p>
        <div className="space-y-2">
            {safeZones.map(zone => (
                <div key={zone.id} className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
                    <p className="font-medium">{zone.name}</p>
                    <button onClick={() => handleDeleteSafeZone(zone.id)} className="text-gray-400 hover:text-red-400 p-1"><TrashIcon className="w-5 h-5"/></button>
                </div>
            ))}
            {safeZones.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No safe zones created yet.</p>}
        </div>
        
        {isAddingZone ? (
             <form onSubmit={handleAddSafeZone} className="pt-4 border-t border-gray-700 space-y-3">
                <p className="text-sm font-bold text-brand-accent">New Safe Zone</p>
                <div>
                    <label htmlFor="zoneName" className="block text-xs font-medium text-gray-400">Zone Name</label>
                    <input id="zoneName" type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-sm" />
                </div>
                <div>
                     <label htmlFor="zoneRadius" className="block text-xs font-medium text-gray-400">Radius (km): {newZoneRadius}</label>
                     <input id="zoneRadius" type="range" min="0.5" max="10" step="0.5" value={newZoneRadius} onChange={e => setNewZoneRadius(parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300 bg-gray-800 p-2 rounded-md">
                    <LocationMarkerIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>Location set on map.</span>
                </div>
                <div className="flex space-x-2">
                    <button type="submit" className="flex-1 bg-brand-accent text-white font-bold py-2 px-4 rounded-md text-sm">Save Zone</button>
                    <button type="button" onClick={() => setIsAddingZone(false)} className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-md text-sm">Cancel</button>
                </div>
             </form>
        ) : (
            <button onClick={() => navigate('/', { state: { settingZone: true } })} className="w-full mt-2 flex items-center justify-center space-x-2 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500">
                <PlusCircleIcon className="w-5 h-5" />
                <span>Add Safe Zone</span>
            </button>
        )}
      </div>

      <button onClick={handleSignOut} className="w-full bg-red-600/80 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700">
        Sign Out
      </button>
    </div>
  );
};

export default Account;