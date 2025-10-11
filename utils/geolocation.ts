// utils/geolocation.ts

/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @param coords1 - The first coordinate object { lat: number, lng: number }.
 * @param coords2 - The second coordinate object { lat: number, lng: number }.
 * @returns The distance between the two points in kilometers.
 */
export const haversineDistance = (coords1: { lat: number, lng: number }, coords2: { lat: number, lng: number }): number => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
};
