import React, { ReactNode, useEffect, useContext, useState } from 'react';
import BottomNavbar from './BottomNavbar';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import type { SafeZone, Location } from '../../types';
import { VibeType } from '../../types';
import { haversineDistance } from '../../utils/geolocation';
import Header from './Header';

// Helper to parse location, as it might be in different formats in the payload
const parseLocationFromPayload = (loc: any): Location | null => {
    if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return loc;
    }
    return null;
}

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
            // Safe zones fetched for the user also need location parsing
            const parsedZones = (data || [])
                .map(z => ({ ...z, location: parseLocationFromPayload(z.location) }))
                .filter(z => z.location) as SafeZone[];
            setSafeZones(parsedZones);
        }
    };
    
    fetchSafeZones();

    // Channel to listen specifically for NEW critical alerts
    const alertChannel = supabase.channel('public-alerts-insert-only')
      .on('postgres_changes', { event: 'INSERT', schema: 'public' },
        (payload) => {
          // DEFENSIVE FIX: Ensure payload.new exists before processing.
          // This prevents crashes on events that don't have a 'new' record (like DELETE).
          if (safeZones.length === 0 || !payload.new) return;

          const newRecord = payload.new as any;
          
          let alertLocation: Location | null = null;
          let isCriticalAlert = false;
          let alertType = '';

          if (payload.table === 'vibes' && newRecord.vibe_type === VibeType.Dangerous) {
            alertLocation = parseLocationFromPayload(newRecord.location);
            isCriticalAlert = true;
            alertType = 'Dangerous Vibe';
          } else if (payload.table === 'sos') {
            alertLocation = parseLocationFromPayload(newRecord.location);
            isCriticalAlert = true;
            alertType = 'SOS Alert';
          }

          if (isCriticalAlert && alertLocation) {
            for (const zone of safeZones) {
              if (zone.location && zone.radius_km) {
                const distance = haversineDistance(alertLocation, zone.location);
                if (distance <= zone.radius_km) {
                  // In a real app with a service worker, this would trigger a system notification.
                  // For now, we use a console warning as a clear indicator.
                  console.warn(
                    `🚨 PUSH NOTIFICATION 🚨\n` +
                    `A new "${alertType}" was reported inside your safe zone "${zone.name}".\n` +
                    `Please check the map for more details.`
                  );
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
    <div className="h-full bg-brand-primary flex flex-col">
      <Header />
      <main className="flex-grow pt-16 pb-20 relative overflow-y-auto">
        {children}
      </main>
      <BottomNavbar />
    </div>
  );
};

export default Layout;