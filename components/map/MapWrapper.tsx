import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import type { SafeZone, Location } from '../../types';
import { VibeType } from '../../types';
import { FireIcon } from '../ui/Icons';
import AreaSummaryModal from './AreaSummaryModal';
import { haversineDistance } from '../../utils/geolocation';

// This tells TypeScript that the Leaflet library (L) is available globally
// because it's loaded via a <script> tag in index.html.
declare const L: any;

// --- Leaflet Icon Setup ---
// Fixes an issue with the default icon paths in some module bundlers.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper to convert Supabase GeoJSON point to our LatLng format
// Supabase returns: { type: 'Point', coordinates: [lng, lat] }
const parseLocation = (loc: any): Location | null => {
    if (loc && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    return null;
}

// --- Icon Creation Functions ---
const VIBE_CONFIG: Record<string, { color: string; displayName: string }> = {
    [VibeType.Safe]: { color: 'green', displayName: 'Safe' },
    [VibeType.Calm]: { color: 'blue', displayName: 'Calm' },
    [VibeType.Noisy]: { color: 'yellow', displayName: 'Noisy' },
    [VibeType.LGBTQIAFriendly]: { color: 'violet', displayName: 'LGBTQIA+ Friendly' },
    [VibeType.Suspicious]: { color: 'orange', displayName: 'Suspicious' },
    [VibeType.Dangerous]: { color: 'red', displayName: 'Dangerous' },
};

const getVibeIcon = (vibeType: VibeType) => {
  const color = VIBE_CONFIG[vibeType]?.color || 'grey';
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });
};
const sosIcon = getVibeIcon(VibeType.Dangerous); // Reuse dangerous icon for visual consistency
const eventIcon = getVibeIcon(VibeType.Calm); // Reuse calm icon

interface SummaryModalState {
    isOpen: boolean; isLoading: boolean; summary: string | null; error: string | null;
}

const MapWrapper: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const markerClusterGroupRef = useRef<any>(null);
  const safeZoneLayersRef = useRef<Record<number, any>>({});

  const auth = useContext(AuthContext);
  const { vibes, sos, events, loading: dataLoading, error: dataError } = useData();
  
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingZone = location.state?.settingZone === true;

  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [summaryModalState, setSummaryModalState] = useState<SummaryModalState>({ isOpen: false, isLoading: false, summary: null, error: null });
  
  // --- Map Initialization Effect ---
  // This effect runs only ONCE to create the map instance.
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
          center: [40.7128, -74.0060], // Default to NYC
          zoom: 13,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      
      mapRef.current = map;
      markerClusterGroupRef.current = L.markerClusterGroup();
      
      map.locate({ setView: true, maxZoom: 16 });

      setTimeout(() => {
        map.invalidateSize();
      }, 0);
    }
  }, []);

  // --- Safe Zone Fetching Effect (User-specific data) ---
  useEffect(() => {
    if (!auth?.user) return;
    const fetchSafeZones = async () => {
        const { data, error } = await supabase.from('safe_zones').select('*').eq('user_id', auth.user!.id);
        if (error) {
            console.error("Error fetching user's safe zones:", error);
        } else {
            const parsedZones = (data || []).map(z => ({ ...z, location: parseLocation(z.location) })).filter(z => z.location) as SafeZone[];
            setSafeZones(parsedZones);
        }
    };
    fetchSafeZones();

    // Also subscribe to changes for this user's safe zones
    const subscription = supabase.channel(`safe-zones-user-${auth.user.id}`)
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'safe_zones', filter: `user_id=eq.${auth.user.id}` },
          () => fetchSafeZones()
      ).subscribe();
    
    return () => {
        supabase.removeChannel(subscription);
    }

  }, [auth?.user]);


  // --- Data Rendering Effect (Refactored for Robustness) ---
  // Re-renders all layers whenever data from context or heatmap visibility changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dataLoading) return;

    // --- 1. CLEAN SLATE: Remove all previous data layers ---
    if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
    }
    if (map.hasLayer(markerClusterGroupRef.current)) {
        map.removeLayer(markerClusterGroupRef.current);
    }
    markerClusterGroupRef.current.clearLayers();
    Object.values(safeZoneLayersRef.current).forEach(layer => map.removeLayer(layer));
    safeZoneLayersRef.current = {};

    // --- 2. RE-RENDER: Add back the necessary layers ---

    // Always render Safe Zones
    safeZones.forEach(zone => {
      const circle = L.circle([zone.location.lat, zone.location.lng], {
        radius: zone.radius_km * 1000,
        color: 'cyan', fillColor: 'cyan', fillOpacity: 0.1, weight: 1,
      }).bindPopup(`<strong>Safe Zone:</strong> ${zone.name}`);
      map.addLayer(circle);
      safeZoneLayersRef.current[zone.id] = circle;
    });

    if (showHeatmap) {
      const vibeIntensityMap: Record<string, number> = {
          [VibeType.Safe]: 0.2, [VibeType.Calm]: 0.3, [VibeType.Noisy]: 0.5,
          [VibeType.LGBTQIAFriendly]: 0.2, [VibeType.Suspicious]: 0.7, [VibeType.Dangerous]: 1.0,
      };
      const heatmapData = vibes
          .map(v => [v.location.lat, v.location.lng, vibeIntensityMap[v.vibe_type]])
          .filter(v => v[2] > 0);
          
      if (heatmapData.length > 0) {
          heatLayerRef.current = L.heatLayer(heatmapData, {
              radius: 30, blur: 25, maxZoom: 17,
              gradient: { 0.2: '#34d399', 0.4: '#3b82f6', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#b91c1c' }
          }).addTo(map);
      }
    } else {
        const allMarkers = [];
        vibes.forEach(v => {
            const marker = L.marker([v.location.lat, v.location.lng], { icon: getVibeIcon(v.vibe_type) })
                .bindPopup(`<strong>Vibe:</strong> ${VIBE_CONFIG[v.vibe_type]?.displayName}<br><strong>By:</strong> ${v.profiles?.username || 'anonymous'}`);
            allMarkers.push(marker);
        });
        sos.forEach(s => {
            const marker = L.marker([s.location.lat, s.location.lng], { icon: sosIcon })
                .bindPopup(`<strong class="text-red-500">SOS ALERT!</strong><br><strong>By:</strong> ${s.profiles?.username || 'anonymous'}<br><strong>Details:</strong> ${s.details}`);
            allMarkers.push(marker);
        });
        events.forEach(e => {
            const marker = L.marker([e.location.lat, e.location.lng], { icon: eventIcon })
                .bindPopup(`<strong>Event:</strong> ${e.title}<br><strong>When:</strong> ${new Date(e.event_time).toLocaleString()}`);
            allMarkers.push(marker);
        });
        
        if (allMarkers.length > 0) {
            markerClusterGroupRef.current.addLayers(allMarkers);
            map.addLayer(markerClusterGroupRef.current);
        }
    }
  }, [vibes, sos, events, safeZones, showHeatmap, dataLoading]);
  
  // --- Map Interaction Effect ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    map.off('contextmenu').off('click'); // Clear old listeners

    if (isSettingZone) {
      map.on('click', (e: any) => navigate('/profile', { state: { newZoneLocation: e.latlng } }));
    } else {
      map.on('contextmenu', async (e: any) => {
        setSummaryModalState({ isOpen: true, isLoading: true, summary: null, error: null });
        try {
            const clickedPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
            const nearbyVibes = vibes.filter(vibe => 
                haversineDistance(clickedPoint, vibe.location) <= 1
            );
            
            let prompt = `You are a local community safety assistant. Based on the following real-time vibe reports for a 1km radius, provide a concise summary and a practical safety tip. If there are no reports, say so and give a general safety tip.\n\n--- DATA ---\n`;
            if (nearbyVibes && nearbyVibes.length > 0) {
                const vibeCounts = nearbyVibes.reduce((acc: any, vibe) => {
                    acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1; return acc;
                }, {});
                prompt += `- Vibe Reports: ${Object.entries(vibeCounts).map(([type, count]) => `${count} ${VIBE_CONFIG[type]?.displayName || type}`).join(', ')}\n`;
            } else {
                prompt += "- Vibe Reports: None.\n";
            }
            prompt += "--- END DATA ---";

            const { GoogleGenAI } = await import('@google/genai');
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API key is not configured.");
            
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setSummaryModalState(prev => ({ ...prev, summary: response.text }));
        } catch (err: any) {
            setSummaryModalState(prev => ({ ...prev, error: err.message || "Failed to generate summary." }));
        } finally {
            setSummaryModalState(prev => ({ ...prev, isLoading: false }));
        }
      });
    }
  }, [isSettingZone, navigate, vibes]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainerRef} className={`absolute inset-0 z-0 ${isSettingZone ? 'cursor-crosshair' : ''}`} />
      {dataError && (
        <div className="absolute top-0 left-0 right-0 z-[1000] p-4 bg-red-900/80 text-red-200 text-center text-sm backdrop-blur-sm">
          <p className="font-bold">Map Data Error</p>
          <p>{dataError}</p>
        </div>
      )}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
        <button onClick={() => mapRef.current?.locate({ setView: true, maxZoom: 16 })} className="bg-white p-2 rounded-full shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24" fill="black" className="w-6 h-6"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-2.25a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5Z" clipRule="evenodd" /></svg>
        </button>
        <button onClick={() => setShowHeatmap(!showHeatmap)} className={`p-2 rounded-full shadow-lg transition-colors ${showHeatmap ? 'bg-brand-accent text-white' : 'bg-white text-black'}`}>
          <FireIcon className="w-6 h-6" />
        </button>
      </div>
      <AreaSummaryModal {...summaryModalState} onClose={() => setSummaryModalState({ isOpen: false, isLoading: false, summary: null, error: null })} />
    </div>
  );
};

export default MapWrapper;