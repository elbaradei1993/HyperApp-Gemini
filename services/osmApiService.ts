
// services/osmApiService.ts

interface LatLng {
  lat: number;
  lng: number;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Fetches a list of notable nearby places (amenities, etc.) from the Overpass API.
 * This is used to provide contextual information to the AI.
 * Implements a retry mechanism with exponential backoff to handle transient server errors.
 * @param coords The latitude and longitude to search around.
 * @param radiusMeters The search radius.
 * @returns A promise that resolves to an array of unique place names.
 */
export const getNearbyPlacesList = async (coords: LatLng, radiusMeters: number): Promise<string[]> => {
  // Increased timeout to 120s and broadened the query to be more efficient
  // for the public API, reducing the chance of a server-side timeout.
  const overpassQuery = `
    [out:json][timeout:120];
    (
      nwr(around:${radiusMeters},${coords.lat},${coords.lng})[~"^(amenity|shop|tourism)$"~"."];
    );
    out body;
    >;
    out skel qt;
  `;
  
  const url = `https://overpass-api.de/api/interpreter`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `data=${encodeURIComponent(overpassQuery)}`
      });

      // Specifically check for Gateway Timeout to retry
      if (response.status === 504 && attempt < MAX_RETRIES) {
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.warn(`Overpass API timeout. Retrying in ${delay}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Move to the next attempt
      }

      if (!response.ok) {
        throw new Error(`Overpass API responded with status ${response.status}`);
      }
      
      const data = await response.json();
      
      const placeNames = new Set<string>();
      if (data.elements) {
        (data.elements as any[]).forEach(element => {
          if (element.tags && element.tags.name) {
            placeNames.add(element.tags.name);
          }
        });
      }
      
      return Array.from(placeNames); // Success, exit the function

    } catch (error: any) {
      console.error(`Failed to fetch from Overpass API (Attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      if (attempt === MAX_RETRIES) {
          return []; // All retries failed, return empty array
      }
      // Wait before the next retry for other errors (e.g., network issues)
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return []; // Should not be reached, but fallback to empty array
};
