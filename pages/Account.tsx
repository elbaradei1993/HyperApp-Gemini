

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation as useReactRouterLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import type { Profile as ProfileType, Vibe, SOS, SafeZone, Location } from '../types';
import { VibeType } from '../types';
import { TrashIcon, LocationMarkerIcon } from '../components/ui/Icons';

// Helper to convert Supabase GeoJSON point to our LatLng format
// Made robust to handle both new (GeoJSON) and old ({lat,lng}) formats.
const parseLocation = (loc: any): Location | null => {
    if (loc && loc.coordinates && loc.coordinates.length === 2) {
        // New GeoJSON format from PostGIS: { type: 'Point', coordinates: [lng, lat] }
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        // Old format from JSONB: { lat: number, lng: number }
        return loc;
    }
    return null;
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [reports, setReports] = useState<(Vibe | SOS)[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const auth = useContext(AuthContext);

  // State for Safe Zones feature
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(1);
  const [newZoneLocation, setNewZoneLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isFetchingDefaultLocation, setIsFetchingDefaultLocation] = useState(false);
  const [newZoneAddress, setNewZoneAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  const navigate = useNavigate();
  const location = useReactRouterLocation();

  // Effect to receive location from map page
  useEffect(() => {
    if (location.state?.newZoneLocation) {
      setNewZoneLocation(location.state.newZoneLocation);
      setIsAddingZone(true);
      // Clean up router state
      window.history.replaceState({}, document.title)
    }
  }, [location.state]);

  // Effect to automatically fetch current location when adding a new zone
  useEffect(() => {
    if (isAddingZone && !location.state?.newZoneLocation) { // Only fetch if not coming from map
      setIsFetchingDefaultLocation(true);
      setNewZoneLocation(null); // Clear previous selection

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setNewZoneLocation({ lat: latitude, lng: longitude });
          setIsFetchingDefaultLocation(false);
        },
        (error) => {
          console.warn("Could not get default location:", error.message);
          setIsFetchingDefaultLocation(false);
        },
        { timeout: 10000 }
      );
    }
  }, [isAddingZone, location.state]);

  // Effect to perform reverse geocoding whenever the location changes
  useEffect(() => {
    if (newZoneLocation) {
      const fetchAddress = async () => {
        setIsFetchingAddress(true);
        setNewZoneAddress(null);
        try {
          const { lat, lng } = newZoneLocation;
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          if (!response.ok) throw new Error('Failed to fetch from Nominatim');
          const data = await response.json();
          setNewZoneAddress(data.display_name || 'Address not found');
        } catch (error: any) {
          console.error("Failed to fetch address:", error.message);
          setNewZoneAddress('Could not fetch address');
        } finally {
          setIsFetchingAddress(false);
        }
      };
      fetchAddress();
    } else {
      setNewZoneAddress(null);
    }
  }, [newZoneLocation]);


  const fetchProfileData = async () => {
    if (!auth?.user) return;
    setProfileLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
    if (error) console.error('Error fetching profile:', error.message);
    else if (data) {
      setProfile(data);
      setUsername(data.username);
      setFullName(data.full_name);
    }
    setProfileLoading(false);
  };

  const fetchActivity = async () => {
    if (!auth?.user) return;
    setActivityLoading(true);
    const { data: vibesData } = await supabase.from('vibes').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false });
    const { data: sosData } = await supabase.from('sos').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false });
    
    const allVibes = (vibesData || []).map(v => ({ ...v, location: parseLocation(v.location) }));
    const allSos = (sosData || []).map(s => ({ ...s, location: parseLocation(s.location) }));

    const validVibeTypes = new Set(Object.values(VibeType));
    const validVibes = allVibes.filter(v => v.vibe_type && validVibeTypes.has(v.vibe_type as VibeType) && v.location);
    
    const combined = [...validVibes, ...allSos.filter(s => s.location)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReports(combined as (Vibe | SOS)[]);
    setActivityLoading(false);
  };

  const fetchSafeZones = async () => {
    if (!auth?.user) return;
    setZonesLoading(true);
    const { data, error } = await supabase.from('safe_zones').select('*').eq('user_id', auth.user.id).order('created_at');
    if (error) {
        console.error('Error fetching safe zones:', error.message);
    } else {
        const parsedZones = (data || []).map(z => ({...z, location: parseLocation(z.location)})).filter(z => z.location);
        setSafeZones(parsedZones as SafeZone[]);
    }
    setZonesLoading(false);
  };

  useEffect(() => {
    fetchProfileData();
    fetchActivity();
    fetchSafeZones();
  }, [auth?.user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.user) return;
    const updates = { id: auth.user.id, username, full_name: fullName, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) alert(error.message);
    else alert('Profile updated!');
  };
  
  const handleSelectOnMap = () => navigate('/', { state: { settingZone: true } });

  const handleSaveZone = async () => {
    if (!auth?.user || !newZoneName || !newZoneRadius || !newZoneLocation) {
      alert("Please provide a name, radius, and select a location on the map.");
      return;
    }
    // FIX: Use SRID=4326;POINT(lng lat) format for PostGIS geography type.
    const locationPayload = `SRID=4326;POINT(${newZoneLocation.lng} ${newZoneLocation.lat})`;
    const { error } = await supabase.from('safe_zones').insert({
        user_id: auth.user.id,
        name: newZoneName,
        radius_km: newZoneRadius,
        location: locationPayload
    });

    if (error) alert(`Error saving zone: ${error.message}`);
    else {
        await fetchSafeZones(); // Refresh the list
        setIsAddingZone(false);
        setNewZoneName('');
        setNewZoneRadius(1);
        setNewZoneLocation(null);
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    if (window.confirm("Are you sure you want to delete this safe zone?")) {
        const { error } = await supabase.from('safe_zones').delete().eq('id', zoneId);
        if (error) alert(`Error deleting zone: ${error.message}`);
        else await fetchSafeZones(); // Refresh the list
    }
  };

  const handleLogout = async () => await supabase.auth.signOut();
  
  const VIBE_CONFIG: Record<string, { emoji: string; textClass: string; displayName: string }> = {
    [VibeType.Safe]: { emoji: '😊', textClass: 'text-green-300', displayName: 'Safe' },
    [VibeType.Calm]: { emoji: '😌', textClass: 'text-blue-300', displayName: 'Calm' },
    [VibeType.Noisy]: { emoji: '🔊', textClass: 'text-yellow-300', displayName: 'Noisy' },
    [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', textClass: 'text-purple-300', displayName: 'LGBTQIA+ Friendly' },
    [VibeType.Suspicious]: { emoji: '🤨', textClass: 'text-orange-300', displayName: 'Suspicious' },
    [VibeType.Dangerous]: { emoji: '😠', textClass: 'text-red-300', displayName: 'Dangerous' },
  };

  const renderActivity = () => {
    if (activityLoading) return <p>Loading activity...</p>;
    if (reports.length === 0) return <p className="text-gray-400">No activity yet.</p>;

    return (
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {reports.map((report) => {
          const isVibe = 'vibe_type' in report;
          const date = new Date(report.created_at).toLocaleString();
          
          if (isVibe) {
            const vibe = report as Vibe;
            const config = VIBE_CONFIG[vibe.vibe_type];
            if (!config) return null; // Should not happen with filtering, but good for safety
            return (
              <div key={`vibe-${vibe.id}`} className="flex items-center space-x-3 text-sm">
                <span className="text-xl">{config.emoji}</span>
                <div className="flex-grow">
                  <p className="font-semibold">Reported a "{config.displayName}" vibe</p>
                  <p className="text-xs text-gray-500">{date}</p>
                </div>
              </div>
            );
          } else {
            const sos = report as SOS;
            return (
              <div key={`sos-${sos.id}`} className="flex items-center space-x-3 text-sm">
                 <span className="text-xl">🚨</span>
                 <div className="flex-grow">
                    <p className="font-semibold text-red-300">Sent an SOS Alert</p>
                    <p className="text-xs text-gray-500">{date}</p>
                 </div>
              </div>
            );
          }
        })}
      </div>
    );
  };
  
  if (profileLoading) return <div className="p-4">Loading profile...</div>;

  return (
    <div className="p-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>
        <form onSubmit={handleUpdateProfile} className="bg-brand-secondary p-4 rounded-lg space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400">Email</label>
            <input id="email" type="text" value={auth?.user?.email ?? ''} disabled className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-gray-400"/>
          </div>
           <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-400">Username</label>
            <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent"/>
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-400">Full Name</label>
            <input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent"/>
          </div>
          <div>
              <button type="submit" className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600">Update Profile</button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">My Safe Zones</h2>
        <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
          {zonesLoading ? <p>Loading zones...</p> : safeZones.map(zone => (
            <div key={zone.id} className="flex justify-between items-center bg-brand-primary p-3 rounded-md">
              <div>
                <p className="font-semibold">{zone.name}</p>
                <p className="text-xs text-gray-400">{zone.radius_km} km radius</p>
              </div>
              <button onClick={() => handleDeleteZone(zone.id)} className="text-gray-400 hover:text-red-400">
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
          {safeZones.length === 0 && !isAddingZone && <p className="text-gray-400 text-center py-2">No safe zones defined yet.</p>}
          
          {isAddingZone ? (
            <div className="pt-4 border-t border-gray-700 space-y-4">
                <h3 className="font-semibold text-lg">Add New Safe Zone</h3>
                <div>
                    <label htmlFor="zoneName" className="block text-sm font-medium text-gray-400">Zone Name</label>
                    <input id="zoneName" type="text" placeholder="e.g., Home, Work" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent"/>
                </div>
                 <div>
                    <label htmlFor="zoneRadius" className="block text-sm font-medium text-gray-400">Radius (km)</label>
                    <input id="zoneRadius" type="number" step="0.5" min="0.5" value={newZoneRadius} onChange={e => setNewZoneRadius(parseFloat(e.target.value))} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400">Location</label>
                    <button onClick={handleSelectOnMap} disabled={isFetchingDefaultLocation || isFetchingAddress} className="mt-1 w-full flex items-center justify-center space-x-2 text-left p-2 bg-gray-700 border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait">
                      <LocationMarkerIcon className="w-5 h-5 text-brand-accent" />
                       <span className="truncate">
                          {isFetchingDefaultLocation 
                            ? 'Fetching current location...' 
                            : isFetchingAddress
                            ? 'Fetching address...'
                            : newZoneAddress && !newZoneAddress.startsWith('Could not')
                            ? `${newZoneAddress} (Click to change)`
                            : newZoneLocation 
                              ? `Lat: ${newZoneLocation.lat.toFixed(3)}, Lng: ${newZoneLocation.lng.toFixed(3)} (Click to change)` 
                              : 'Select on Map'
                          }
                        </span>
                    </button>
                </div>
                <div className="flex space-x-2">
                    <button onClick={handleSaveZone} className="flex-1 bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600">Save Zone</button>
                    <button onClick={() => setIsAddingZone(false)} className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500">Cancel</button>
                </div>
            </div>
          ) : (
            <button onClick={() => setIsAddingZone(true)} className="w-full bg-brand-accent/30 text-brand-accent font-bold py-2 px-4 rounded-md hover:bg-brand-accent/50">Add New Safe Zone</button>
          )}
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">My Activity</h2>
        <div className="bg-brand-secondary p-4 rounded-lg">
          {renderActivity()}
        </div>
      </div>
      <div className="mt-2">
        <button onClick={handleLogout} className="w-full bg-red-600/50 text-red-200 font-bold py-2 px-4 rounded-md hover:bg-red-700 transition-colors">Logout</button>
      </div>

    </div>
  );
};

export default Profile;