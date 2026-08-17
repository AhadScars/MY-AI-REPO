import type { LatLng, Place, RouteInfo } from './types';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org';

/** Haversine distance in km (fallback when routing fails) */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function searchPlaces(query: string): Promise<Place[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'in',
  });

  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error('Location search failed');

  const data = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>;

  return data.map((item) => {
    const parts = item.display_name.split(',').map((s) => s.trim());
    return {
      id: String(item.place_id),
      name: item.name || parts[0] || item.display_name,
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
  });
}

export async function getRoute(from: LatLng, to: LatLng): Promise<RouteInfo> {
  const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('route failed');
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error('no route');

    const coords: LatLng[] = (route.geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => ({ lat, lng })
    );

    return {
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
      geometry: coords,
    };
  } catch {
    // Fallback: straight-line * 1.35 for road factor
    const straight = haversineKm(from, to);
    const distanceKm = straight * 1.35;
    const durationMin = Math.round((distanceKm / 22) * 60); // ~22 km/h city avg
    return {
      distanceKm,
      durationMin,
      geometry: [from, to],
    };
  }
}

/** Rough city detection from lat/lng for city-specific rates */
export function detectCity(lat: number, lng: number): string {
  const cities: { name: string; lat: number; lng: number; r: number }[] = [
    { name: 'Mumbai', lat: 19.076, lng: 72.877, r: 0.45 },
    { name: 'Delhi NCR', lat: 28.613, lng: 77.209, r: 0.55 },
    { name: 'Bengaluru', lat: 12.972, lng: 77.594, r: 0.4 },
    { name: 'Hyderabad', lat: 17.385, lng: 78.486, r: 0.4 },
    { name: 'Chennai', lat: 13.083, lng: 80.27, r: 0.35 },
    { name: 'Pune', lat: 18.52, lng: 73.856, r: 0.3 },
    { name: 'Kolkata', lat: 22.573, lng: 88.364, r: 0.3 },
    { name: 'Ahmedabad', lat: 23.023, lng: 72.571, r: 0.3 },
    { name: 'Jaipur', lat: 26.912, lng: 75.787, r: 0.25 },
    { name: 'Kochi', lat: 9.931, lng: 76.267, r: 0.2 },
  ];

  for (const c of cities) {
    if (Math.abs(lat - c.lat) < c.r && Math.abs(lng - c.lng) < c.r) {
      return c.name;
    }
  }
  return 'India';
}
