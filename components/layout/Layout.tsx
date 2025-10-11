import React, { ReactNode, useEffect, useContext } from 'react';
import BottomNavbar from './BottomNavbar';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';

// Haversine distance function to check if a point is within a radius
const haversineDistance = (coords1: { lat: number, lng: number }, coords2: { lat: number, lng: number }): number => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const auth = useContext(AuthContext);

  useEffect(() => {
    if (!auth?.user) return;

    let safeZones: any[] = [];
    
    // Fetch user's safe zones to monitor them
    const fetchSafeZones = async () => {
        const { data, error } = await supabase
            .from('safe_zones')
            .select('*')
            .eq('user_id', auth.user!.id);
        
        if (error) {
            console.error("Could not fetch safe zones for notifications:", error);
        } else {
            safeZones = data;
        }
    };
    
    fetchSafeZones();

    // Listen for new inserts on vibes and sos tables
    const channel = supabase.channel('public-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public' },
        (payload) => {
          // Re-fetch zones in case they changed in another tab.
          fetchSafeZones(); 
          if (safeZones.length === 0) return;

          const newRecord = payload.new as any;
          
          let alertLocation: { lat: number, lng: number } | null = null;
          let isCriticalAlert = false;
          let alertType = '';

          if (payload.table === 'vibes' && newRecord.vibe_type === 'unsafe') {
            alertLocation = newRecord.location;
            isCriticalAlert = true;
            alertType = 'Unsafe Vibe';
          } else if (payload.table === 'sos') {
            alertLocation = newRecord.location;
            isCriticalAlert = true;
            alertType = 'SOS Alert';
          }

          if (isCriticalAlert && alertLocation) {
            for (const zone of safeZones) {
              if (zone.location && zone.radius_km) {
                const distance = haversineDistance(alertLocation, zone.location);
                if (distance <= zone.radius_km) {
                  console.warn(
                    `🚨 PUSH NOTIFICATION 🚨\n` +
                    `A new "${alertType}" was reported inside your safe zone "${zone.name}".\n` +
                    `Please check the map for more details.`
                  );
                  // In a real app with a service worker, this would trigger a system notification.
                  break; // Notify only once per event.
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [auth?.user]);


  return (
    <div className="min-h-screen bg-brand-primary flex flex-col">
      <main className="flex-grow pb-20 relative">
        {children}
      </main>
      <BottomNavbar />
    </div>
  );
};

export default Layout;
