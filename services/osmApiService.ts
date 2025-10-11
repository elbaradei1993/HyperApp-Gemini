// services/osmApiService.ts

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Fetches a list of notable nearby places (amenities, etc.) from the Overpass API.
 * This is used to provide contextual information to the AI.
 * @param coords The latitude and longitude to search around.
 * @param radiusMeters The search radius.
 * @returns A promise that resolves to an array of unique place names.
 */
export const getNearbyPlacesList = async (coords: LatLng, radiusMeters: number): Promise<string[]> => {
  // This query looks for common amenities that might influence a neighborhood's vibe.
  // The timeout is set to 60 seconds; the public Overpass API can be slow under load,
  // and a higher timeout makes our request more likely to succeed.
  const overpassQuery = `
    [out:json][timeout:60];
    (
      node["amenity"~"bar|cafe|restaurant|police|hospital|bus_station|train_station|park|nightclub"](around:${radiusMeters},${coords.lat},${coords.lng});
      way["amenity"~"bar|cafe|restaurant|police|hospital|bus_station|train_station|park|nightclub"](around:${radiusMeters},${coords.lat},${coords.lng});
      relation["amenity"~"bar|cafe|restaurant|police|hospital|bus_station|train_station|park|nightclub"](around:${radiusMeters},${coords.lat},${coords.lng});
    );
    out body;
    >;
    out skel qt;
  `;
  
  const url = `https://overpass-api.de/api/interpreter`;

  try {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(overpassQuery)}`
    });
    if (!response.ok) {
      throw new Error(`Overpass API responded with status ${response.status}`);
    }
    const data = await response.json();
    
    // Extract unique names of places from the response tags.
    const placeNames = new Set<string>();
    if (data.elements) {
      (data.elements as any[]).forEach(element => {
        if (element.tags && element.tags.name) {
          placeNames.add(element.tags.name);
        }
      });
    }
    
    return Array.from(placeNames);

  } catch (error: any) {
    console.error("Failed to fetch from Overpass API:", error.message);
    return []; // Return an empty array on failure to prevent crashes.
  }
};