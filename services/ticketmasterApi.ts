// services/ticketmasterApi.ts
import type { TicketmasterEvent } from '../types';

const API_KEY = 'KDDyGfAzLbyZU8gDHYknKgY6oNBsScOR';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Fetches a list of nearby events from the Ticketmaster API.
 * @param coords The latitude and longitude to search around.
 * @param radiusMiles The search radius in miles.
 * @returns A promise that resolves to an array of TicketmasterEvent objects.
 */
export const getNearbyEvents = async (coords: LatLng, radiusMiles: number = 20): Promise<TicketmasterEvent[]> => {
  const url = new URL(BASE_URL);
  url.searchParams.append('apikey', API_KEY);
  url.searchParams.append('latlong', `${coords.lat},${coords.lng}`);
  url.searchParams.append('radius', String(radiusMiles));
  url.searchParams.append('unit', 'miles');
  url.searchParams.append('sort', 'date,asc');
  url.searchParams.append('classificationName', 'Music,Sports,Arts & Theatre,Miscellaneous');

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Ticketmaster API responded with status ${response.status}: ${errorBody.fault?.faultstring || JSON.stringify(errorBody)}`);
    }
    
    const data = await response.json();
    return data._embedded?.events || [];

  } catch (error: any) {
    console.error("Failed to fetch from Ticketmaster API:", error.message);
    return []; // Return an empty array on failure
  }
};
