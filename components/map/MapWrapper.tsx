
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import type { Vibe, SOS, Event } from '../../types';
import { VibeType } from '../../types';
import { FireIcon } from '../ui/Icons';
import AreaSummaryModal from './AreaSummaryModal';
import { haversineDistance } from '../../utils/geolocation';

declare const L: any;

// --- Leaflet Icon Setup ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getVibeIcon = (vibeType: VibeType) => {
  const color = {
    [VibeType.Safe]: 'green',
    [VibeType.Calm]: 'blue',
    [VibeType.Noisy]: 'yellow',
    [VibeType.LGBTQIAFriendly]: 'violet',
    [VibeType.Suspicious]: 'orange',
    [VibeType.Dangerous]: 'red',
  }[vibeType as VibeType] || 'grey'; // Fallback to grey for old/invalid data

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });
};

const vibeDisplayNameMapping: Record<string, string> = {
    [VibeType.Safe]: 'Safe',
    [VibeType.Calm]: 'Calm',
    [VibeType.Noisy]: 'Noisy',
    [VibeType.LGBTQIAFriendly]: 'LGBTQIA+ Friendly',
    [VibeType.Suspicious]: 'Suspicious',
    [VibeType.Dangerous]: 'Dangerous',
};

const sosIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const eventIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

interface SummaryModalState {
    isOpen: boolean;
    isLoading: boolean;
    summary: string | null;
    error: string | null;
}

const MapWrapper: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const markerClusterGroupRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const subscriptionRef = useRef<any>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const isSettingZone = location.state?.settingZone === true;

  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [summaryModalState, setSummaryModalState] = useState<SummaryModalState>({
    isOpen: false,
    isLoading: false,
    summary: null,
    error: null,
  });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation([position.coords.latitude, position.coords.longitude]),
      () => setUserLocation([51.505, -0.09])
    );
  }, []);

  const addOrUpdateMarker = (item: Vibe | SOS | Event, type: 'vibe' | 'sos' | 'event') => {
    if (!item.location || !markerClusterGroupRef.current) return;
    const markerId = `${type}-${item.id}`;
    const existingMarker = markersRef.current[markerId];
    let icon, basePopupContent;

    if (type === 'vibe') {
        const vibe = item as Vibe;
        icon = getVibeIcon(vibe.vibe_type);
        const displayName = vibeDisplayNameMapping[vibe.vibe_type] || vibe.vibe_type;
        basePopupContent = `<strong>Vibe:</strong> ${displayName}<br><strong>By:</strong> ${vibe.profiles?.username || 'anonymous'}`;
    } else if (type === 'sos') {
        const sos = item as SOS;
        if (sos.resolved) { removeMarker(markerId); return; }
        icon = sosIcon;
        basePopupContent = `<strong>SOS:</strong> ${sos.details}<br><strong>By:</strong> ${sos.profiles?.username || 'anonymous'}`;
    } else {
        const event = item as Event;
        icon = eventIcon;
        basePopupContent = `<strong>Event:</strong> ${event.title}<br><strong>By:</strong> ${event.profiles?.username || 'anonymous'}`;
    }
    
    const popupContent = `<div class="space-y-2 max-w-xs"><div>${basePopupContent}</div></div>`;

    if (existingMarker) {
        existingMarker.setLatLng([item.location.lat, item.location.lng]);
        existingMarker.setIcon(icon);
        existingMarker.bindPopup(popupContent);
    } else {
        const newMarker = L.marker([item.location.lat, item.location.lng], { icon }).bindPopup(popupContent);
        markersRef.current[markerId] = newMarker;
        markerClusterGroupRef.current.addLayer(newMarker);
    }
  };

  const removeMarker = (markerId: string) => {
    if (!markerClusterGroupRef.current) return;
    const marker = markersRef.current[markerId];
    if (marker) {
      markerClusterGroupRef.current.removeLayer(marker);
      delete markersRef.current[markerId];
    }
  };

  // Main effect for map initialization and data handling to fix race conditions
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current && userLocation) {
      const map = L.map(mapContainerRef.current, { contextmenu: true }).setView(userLocation, 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);
      
      mapRef.current = map;
      markerClusterGroupRef.current = L.markerClusterGroup();
      map.addLayer(markerClusterGroupRef.current);
      
      // --- DATA FETCHING & SUBSCRIPTIONS ---
      // Now that the map is guaranteed to exist, we can fetch data and subscribe.
      const fetchInitialData = async () => {
        const { data: vibesData } = await supabase.from('vibes').select('*, profiles(username)');
        const { data: sosData } = await supabase.from('sos').select('*, profiles(username)');
        const { data: eventsData } = await supabase.from('events').select('*, profiles(username)');

        if (vibesData) vibesData.forEach(v => addOrUpdateMarker(v as Vibe, 'vibe'));
        if (sosData) sosData.forEach(s => addOrUpdateMarker(s as SOS, 'sos'));
        if (eventsData) eventsData.forEach(e => addOrUpdateMarker(e as Event, 'event'));
        setInitialDataLoaded(true);
      };

      const handleRecordChange = (payload: any) => {
          const table = payload.table;
          let record = payload.new as any;
          const oldRecord = payload.old as any;
          let type: 'vibe' | 'sos' | 'event' | null = null;
          if (table === 'vibes') type = 'vibe';
          else if (table === 'sos') type = 'sos';
          else if (table === 'events') type = 'event';
          if (!type) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              addOrUpdateMarker(record as any, type!);
          } else if (payload.eventType === 'DELETE') {
              removeMarker(`${type}-${oldRecord.id}`);
          }
      };
      
      fetchInitialData();

      if (!subscriptionRef.current) {
        subscriptionRef.current = supabase.channel('public-data-changes')
          .on('postgres_changes', { event: '*', schema: 'public' }, handleRecordChange)
          .subscribe();
      }
    }
    
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [userLocation]);

  // Effect for map interaction handlers
  useEffect(() => {
    const handleMapClickForZone = (e: any) => {
        navigate('/profile', { state: { newZoneLocation: e.latlng } });
    };
    const handleGenerateSummary = async (latlng: { lat: number, lng: number }) => {
        setSummaryModalState({ isOpen: true, isLoading: true, summary: null, error: null });
        try {
            // OPTIMIZED: Use RPC to get nearby data efficiently
            const { data: nearbyVibes, error: vibesError } = await supabase.rpc('get_nearby_vibes', {
                user_lat: latlng.lat,
                user_lng: latlng.lng,
                radius_km: 1
            });
            if (vibesError) throw new Error(`Could not fetch vibes: ${vibesError.message}`);

            // For SOS and Events, client-side filtering is acceptable for now as they are less frequent.
            const allSos = (await supabase.from('sos').select('*').eq('resolved', false)).data || [];
            const nearbySos = allSos.filter(s => s.location && haversineDistance(latlng, s.location) <= 1);
            
            const allEvents = (await supabase.from('events').select('*')).data || [];
            const nearbyEvents = allEvents.filter(e => e.location && haversineDistance(latlng, e.location) <= 1);
    
            let prompt = "You are a local community safety assistant. Based on the following real-time data for a 1km radius, provide a concise and helpful summary for a user. Summarize the current situation in a friendly, easy-to-understand paragraph. Mention the dominant vibe and any important events or alerts. Conclude with a practical tip. If all data fields are empty or contain 'None', state that there are no recent community reports for this area and provide a general, universally applicable safety tip.\n\n--- DATA ---\n";
    
            if (nearbyVibes && nearbyVibes.length > 0) {
                const vibeCounts = nearbyVibes.reduce((acc: any, vibe: Vibe) => {
                    acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
                    return acc;
                }, {});
                const dominantVibe = Object.keys(vibeCounts).reduce((a, b) => vibeCounts[a] > vibeCounts[b] ? a : b);
                prompt += `- Vibe Reports: ${nearbyVibes.length} total. The dominant vibe is "${vibeDisplayNameMapping[dominantVibe] || dominantVibe}".\n`;
            } else {
                prompt += "- Vibe Reports: None in this area.\n";
            }
    
            if (nearbySos.length > 0) { prompt += `- Active SOS Alerts: ${nearbySos.length} active alert(s).\n`; }
            if (nearbyEvents.length > 0) { prompt += `- Upcoming Events: ${nearbyEvents.map(e => `"${e.title}"`).join(', ')}\n`; }
            prompt += "--- END DATA ---";
    
            const { GoogleGenAI } = await import('@google/genai');
            
            let apiKey: string | undefined;
            try {
                apiKey = process.env.API_KEY;
            } catch(e) { /* ignore */ }
    
            if (!apiKey) throw new Error("API key is not configured. Cannot generate summary.");
            const ai = new GoogleGenAI({ apiKey });
            
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash', contents: prompt, config: { thinkingConfig: { thinkingBudget: 0 } },
            });
    
            for await (const chunk of responseStream) {
                setSummaryModalState(prev => ({ ...prev, summary: (prev.summary || '') + chunk.text }));
            }
    
        } catch (err: any) {
            setSummaryModalState(prev => ({ ...prev, error: err.message || "Failed to generate summary." }));
        } finally {
            setSummaryModalState(prev => ({ ...prev, isLoading: false }));
        }
    };
    if (mapRef.current) {
        mapRef.current.off('contextmenu').off('click');
        if (isSettingZone) {
            mapRef.current.on('click', handleMapClickForZone);
        } else {
            mapRef.current.on('contextmenu', (e: any) => handleGenerateSummary(e.latlng));
        }
    }
  }, [isSettingZone, navigate]);
  
    // Effect for handling heatmap toggle
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !initialDataLoaded) return;
        supabase.from('vibes').select('location, vibe_type').then(({ data: vibesData }) => {
            if (!vibesData) return;
            if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
            if (showHeatmap) {
                if (markerClusterGroupRef.current) map.removeLayer(markerClusterGroupRef.current);
                const vibeIntensityMap: Record<string, number> = {
                    [VibeType.Safe]: 0.2,
                    [VibeType.Calm]: 0.3,
                    [VibeType.Noisy]: 0.5,
                    [VibeType.LGBTQIAFriendly]: 0.2,
                    [VibeType.Suspicious]: 0.7,
                    [VibeType.Dangerous]: 1.0,
                };
                const heatmapData = (vibesData as Vibe[]).filter(v => v.location).map(v => 
                    [v.location.lat, v.location.lng, vibeIntensityMap[v.vibe_type] || 0]
                ).filter(v => v[2] > 0);
                if (heatmapData.length > 0) {
                    heatLayerRef.current = L.heatLayer(heatmapData, {
                        radius: 30, blur: 25, maxZoom: 17,
                        gradient: { 0.2: 'green', 0.3: 'blue', 0.5: 'yellow', 0.7: 'orange', 1.0: 'red' }
                    }).addTo(map);
                }
            } else {
                if (markerClusterGroupRef.current) map.addLayer(markerClusterGroupRef.current);
            }
        });
    }, [showHeatmap, initialDataLoaded]);

  const recenterMap = () => {
    navigator.geolocation.getCurrentPosition(p => {
      const newLoc: [number, number] = [p.coords.latitude, p.coords.longitude];
      if (mapRef.current) mapRef.current.flyTo(newLoc, 15);
    });
  };
  
  if (!userLocation) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-brand-secondary text-gray-400">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Locating...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {isSettingZone && (
        <div className="absolute top-0 left-0 right-0 p-3 bg-brand-accent text-center z-[1001] animate-pulse">
          Click on the map to set the center of your new safe zone.
        </div>
      )}
      <div ref={mapContainerRef} className={`h-full w-full z-0 ${isSettingZone ? 'cursor-crosshair' : ''}`} />
      <button onClick={recenterMap} className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-full shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" className="w-6 h-6"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-2.25a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5Z" clipRule="evenodd" /></svg>
      </button>
      <button onClick={() => setShowHeatmap(!showHeatmap)} className={`absolute top-20 right-4 z-[1000] p-2 rounded-full shadow-lg transition-colors ${showHeatmap ? 'bg-brand-accent text-white' : 'bg-white text-black'}`}>
        <FireIcon className="w-6 h-6" />
      </button>
      <AreaSummaryModal 
        isOpen={summaryModalState.isOpen}
        isLoading={summaryModalState.isLoading}
        summary={summaryModalState.summary}
        error={summaryModalState.error}
        onClose={() => setSummaryModalState({ isOpen: false, isLoading: false, summary: null, error: null })}
      />
    </div>
  );
};

export default MapWrapper;