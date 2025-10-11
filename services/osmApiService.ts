import type { Vibe, SOS, Event } from '../types';

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: { [key: string]: string };
}

/**
 * Fetches the name of the most prominent nearby place for a given location using the Overpass API.
 * @param location The latitude and longitude to search around.
 * @returns The name of the place, or a default message if not found.
 */
export async function getNearbyPlaceName(location: { lat: number, lng: number }): Promise<string> {
  const query = `
    [out:json][timeout:10];
    (
      node(around:50, ${location.lat}, ${location.lng})[name];
      way(around:50, ${location.lat}, ${location.lng})[name];
      relation(around:50, ${location.lat}, ${location.lng})[name];
    );
    out tags 1;
  `;
  
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (data.elements && data.elements.length > 0) {
      // Prefer the name of the first element found
      return data.elements[0].tags.name;
    }
    return 'Unnamed location';
  } catch (error) {
    console.error("Failed to fetch from Overpass API:", error);
    return 'Could not fetch place name';
  }
}

/**
 * Fetches a list of nearby place names for the AI summary using the Overpass API.
 * @param location The latitude and longitude to search around.
 * @param radius The radius in meters.
 * @returns An array of place names.
 */
export async function getNearbyPlacesList(location: { lat: number, lng: number }, radius: number = 1000): Promise<string[]> {
   const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"cafe|restaurant|bar|pub|police|hospital|clinic|pharmacy|school|university|library|place_of_worship"](around:${radius},${location.lat},${location.lng});
      node["shop"](around:${radius},${location.lat},${location.lng});
      node["leisure"~"park|playground|stadium"](around:${radius},${location.lat},${location.lng});
    );
    out tags 10;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (data.elements && data.elements.length > 0) {
      // Fix: Add a type assertion to `data.elements` to resolve type inference issues with the result of `response.json()`.
      const names = (data.elements as OsmElement[])
        .map((place) => place.tags?.name)
        .filter((name): name is string => !!name);
      return [...new Set(names)].slice(0, 5);
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch places list from Overpass:", error);
    return [];
  }
}
