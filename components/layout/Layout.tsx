import React, { ReactNode, useEffect, useContext, useState } from 'react';
import BottomNavbar from './BottomNavbar';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import type { SafeZone } from '../../types';
import { haversineDistance } from '../../utils/geolocation';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const auth = useContext(AuthContext);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

  useEffect(() => {
    if (!auth?.user) return;

    // Fetch user's safe zones to monitor them
    const fetchSafeZones = async () => {
        const { data, error } = await supabase
            .from('safe_zones')
            .select('*')
            .eq('user_id', auth.user!.id);
        
        if (error) {
            console.error("Could not fetch safe zones for notifications:", error.message);
        } else {
            setSafeZones(data || []);
        }
    };
    
    fetchSafeZones();

    // Channel to listen for new Vibe/SOS alerts
    const alertChannel = supabase.channel('public-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public' },
        (payload) => {
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
      
    // Channel to keep the safe zones list in sync across tabs/devices
    const safeZoneChannel = supabase.channel(`safe-zones-user-${auth.user.id}`)
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'safe_zones', filter: `user_id=eq.${auth.user.id}` },
          () => fetchSafeZones()
      ).subscribe();


    return () => {
      supabase.removeChannel(alertChannel);
      supabase.removeChannel(safeZoneChannel);
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