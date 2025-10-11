// This service handles interactions with Google Maps Platform APIs.

const GOOGLE_MAPS_API_KEY = (() => {
    try {
        // Safely access process.env to avoid ReferenceError in some environments
        return process.env.GOOGLE_MAPS_API_KEY;
    } catch (e) {
        return undefined;
    }
})();

if (!GOOGLE_MAPS_API_KEY) {
    console.warn(
        "Google Maps API Key is not configured. Features like Street View and Places will be disabled. " +
        "Please set the GOOGLE_MAPS_API_KEY environment variable to enable them."
    );
}

function isApiKeyAvailable(): boolean {
    return !!GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('YOUR');
}

/**
 * Constructs a URL for the Google Street View Static API.
 * @param location The latitude and longitude of the desired image.
 * @param size The dimensions of the image in pixels (e.g., '400x300').
 * @returns A URL string for the image, or null if the API key is not available.
 */
export function getStreetViewImageUrl(
    location: { lat: number, lng: number }, 
    size: string = '250x150'
): string | null {
    if (!isApiKeyAvailable()) return null;
    return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${location.lat},${location.lng}&fov=90&heading=235&pitch=10&key=${GOOGLE_MAPS_API_KEY}`;
}

/**
 * Fetches the name of the most prominent nearby place for a given location using Google Places API.
 * @param location The latitude and longitude to search around.
 * @returns The name of the place, or a default message if not found.
 */
export async function getNearbyPlaceName(location: { lat: number, lng: number }): Promise<string> {
    if (!isApiKeyAvailable()) return 'Place info unavailable';
    
    try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&rankby=distance&key=${GOOGLE_MAPS_API_KEY}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            return data.results[0].name;
        }
        return 'Unnamed location';
    } catch (error) {
        console.error("Failed to fetch from Google Places API:", error);
        return 'Could not fetch place name';
    }
}

/**
 * Fetches a list of nearby place names for the AI summary.
 * @param location The latitude and longitude to search around.
 * @param radius The radius in meters.
 * @returns An array of place names.
 */
export async function getNearbyPlacesList(location: { lat: number, lng: number }, radius: number = 1000): Promise<string[]> {
    if (!isApiKeyAvailable()) return [];

    try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&key=${GOOGLE_MAPS_API_KEY}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            // Return names of up to 5 prominent places
            return data.results.slice(0, 5).map((place: any) => place.name);
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch places list:", error);
        return [];
    }
}
