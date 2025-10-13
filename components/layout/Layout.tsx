import React, { useEffect, useContext, useState, useRef } from 'react';
import { Outlet } from 'react-router-dom'; // Import Outlet
import BottomNavbar from './BottomNavbar';
import ReportVibeModal from '../vibe/ReportVibeModal'; // Import the new modal
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import type { SafeZone, Location } from '../../types';
import { VibeType } from '../../types';
import { haversineDistance } from '../../utils/geolocation';
import Header from './Header';

const parseLocationFromPayload = (loc: any): Location | null => {
    if (loc && loc.type === 'Point' && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return loc;
    }
    return null;
}

const Layout: React.FC = () => {
  const auth = useContext(AuthContext);
  const { userSettings } = useData();
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [isReportVibeModalOpen, setIsReportVibeModalOpen] = useState(false);
  
  // Use a ref to hold the latest settings and zones to avoid re-subscribing on every change
  const settingsRef = useRef(userSettings);
  const safeZonesRef = useRef(safeZones);

  useEffect(() => {
    settingsRef.current = userSettings;
    safeZonesRef.current = safeZones;
  }, [userSettings, safeZones]);


  useEffect(() => {
    if (!auth?.user) return;

    const fetchSafeZones = async () => {
        const { data, error } = await supabase
            .from('safe_zones')
            .select('*')
            .eq('user_id', auth.user!.id);
        
        if (error) {
            console.error("Could not fetch safe zones for notifications:", error.message);
        } else {
            const parsedZones = (data || [])
                .map(z => ({ ...z, location: parseLocationFromPayload(z.location) }))
                .filter(z => z.location) as SafeZone[];
            setSafeZones(parsedZones);
        }
    };
    
    fetchSafeZones();

    const alertChannel = supabase.channel('public-alerts-insert-only')
      .on('postgres_changes', { event: 'INSERT', schema: 'public' },
        (payload) => {
          const currentSettings = settingsRef.current;
          const currentZones = safeZonesRef.current;
          
          if (!currentSettings.notifications.safeZoneAlerts || currentZones.length === 0 || !payload.new) return;

          const newRecord = payload.new as any;
          
          let alertLocation: Location | null = null;
          let isCriticalAlert = false;
          let alertType = '';
          let shouldNotify = false;

          if (payload.table === 'vibes' && newRecord.vibe_type === VibeType.Dangerous && currentSettings.notifications.onDangerousVibe) {
            alertLocation = parseLocationFromPayload(newRecord.location);
            isCriticalAlert = true;
            alertType = 'Dangerous Vibe';
            shouldNotify = true;
          } else if (payload.table === 'sos' && currentSettings.notifications.onSOS) {
            alertLocation = parseLocationFromPayload(newRecord.location);
            isCriticalAlert = true;
            alertType = 'SOS Alert';
            shouldNotify = true;
          }

          if (shouldNotify && isCriticalAlert && alertLocation) {
            for (const zone of currentZones) {
              if (zone.location && zone.radius_km) {
                const distance = haversineDistance(alertLocation, zone.location);
                if (distance <= zone.radius_km) {
                  console.warn(
                    `🚨 PUSH NOTIFICATION 🚨\n` +
                    `A new "${alertType}" was reported inside your safe zone "${zone.name}".\n` +
                    `Please check the map for more details.`
                  );
                  break; 
                }
              }
            }
          }
        }
      )
      .subscribe();
      
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
        <Outlet />
      </main>
      <BottomNavbar onReportVibeClick={() => setIsReportVibeModalOpen(true)} />
      <ReportVibeModal isOpen={isReportVibeModalOpen} onClose={() => setIsReportVibeModalOpen(false)} />
    </div>
  );
};

export default Layout;