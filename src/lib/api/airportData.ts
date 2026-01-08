/**
 * Airport Coordinates Database
 * Used for accurate distance calculations and routing
 */

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
}

// Major airports database (expandable)
export const AIRPORTS: Record<string, Airport> = {
  // US Major Hubs
  JFK: { code: "JFK", name: "John F Kennedy Intl", city: "New York", country: "US", lat: 40.6413, lon: -73.7781, timezone: "America/New_York" },
  LAX: { code: "LAX", name: "Los Angeles Intl", city: "Los Angeles", country: "US", lat: 33.9416, lon: -118.4085, timezone: "America/Los_Angeles" },
  ORD: { code: "ORD", name: "O'Hare Intl", city: "Chicago", country: "US", lat: 41.9742, lon: -87.9073, timezone: "America/Chicago" },
  ATL: { code: "ATL", name: "Hartsfield-Jackson Atlanta Intl", city: "Atlanta", country: "US", lat: 33.6407, lon: -84.4277, timezone: "America/New_York" },
  DFW: { code: "DFW", name: "Dallas/Fort Worth Intl", city: "Dallas", country: "US", lat: 32.8998, lon: -97.0403, timezone: "America/Chicago" },
  DEN: { code: "DEN", name: "Denver Intl", city: "Denver", country: "US", lat: 39.8561, lon: -104.6737, timezone: "America/Denver" },
  SFO: { code: "SFO", name: "San Francisco Intl", city: "San Francisco", country: "US", lat: 37.6213, lon: -122.3790, timezone: "America/Los_Angeles" },
  SEA: { code: "SEA", name: "Seattle-Tacoma Intl", city: "Seattle", country: "US", lat: 47.4502, lon: -122.3088, timezone: "America/Los_Angeles" },
  LAS: { code: "LAS", name: "Harry Reid Intl", city: "Las Vegas", country: "US", lat: 36.0840, lon: -115.1537, timezone: "America/Los_Angeles" },
  MCO: { code: "MCO", name: "Orlando Intl", city: "Orlando", country: "US", lat: 28.4312, lon: -81.3081, timezone: "America/New_York" },
  MIA: { code: "MIA", name: "Miami Intl", city: "Miami", country: "US", lat: 25.7959, lon: -80.2870, timezone: "America/New_York" },
  PHX: { code: "PHX", name: "Phoenix Sky Harbor Intl", city: "Phoenix", country: "US", lat: 33.4342, lon: -112.0080, timezone: "America/Phoenix" },
  IAH: { code: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "US", lat: 29.9902, lon: -95.3368, timezone: "America/Chicago" },
  BOS: { code: "BOS", name: "Logan Intl", city: "Boston", country: "US", lat: 42.3656, lon: -71.0096, timezone: "America/New_York" },
  EWR: { code: "EWR", name: "Newark Liberty Intl", city: "Newark", country: "US", lat: 40.6895, lon: -74.1745, timezone: "America/New_York" },
  LGA: { code: "LGA", name: "LaGuardia", city: "New York", country: "US", lat: 40.7769, lon: -73.8740, timezone: "America/New_York" },
  BWI: { code: "BWI", name: "Baltimore/Washington Intl", city: "Baltimore", country: "US", lat: 39.1774, lon: -76.6684, timezone: "America/New_York" },
  
  // International Major Hubs
  LHR: { code: "LHR", name: "Heathrow", city: "London", country: "GB", lat: 51.4700, lon: -0.4543, timezone: "Europe/London" },
  CDG: { code: "CDG", name: "Charles de Gaulle", city: "Paris", country: "FR", lat: 49.0097, lon: 2.5479, timezone: "Europe/Paris" },
  FRA: { code: "FRA", name: "Frankfurt", city: "Frankfurt", country: "DE", lat: 50.0379, lon: 8.5622, timezone: "Europe/Berlin" },
  AMS: { code: "AMS", name: "Schiphol", city: "Amsterdam", country: "NL", lat: 52.3105, lon: 4.7683, timezone: "Europe/Amsterdam" },
  DXB: { code: "DXB", name: "Dubai Intl", city: "Dubai", country: "AE", lat: 25.2532, lon: 55.3657, timezone: "Asia/Dubai" },
  NRT: { code: "NRT", name: "Narita Intl", city: "Tokyo", country: "JP", lat: 35.7720, lon: 140.3929, timezone: "Asia/Tokyo" },
  HND: { code: "HND", name: "Haneda", city: "Tokyo", country: "JP", lat: 35.5494, lon: 139.7798, timezone: "Asia/Tokyo" },
  HKG: { code: "HKG", name: "Hong Kong Intl", city: "Hong Kong", country: "HK", lat: 22.3080, lon: 113.9185, timezone: "Asia/Hong_Kong" },
  SIN: { code: "SIN", name: "Changi", city: "Singapore", country: "SG", lat: 1.3644, lon: 103.9915, timezone: "Asia/Singapore" },
  ICN: { code: "ICN", name: "Incheon Intl", city: "Seoul", country: "KR", lat: 37.4602, lon: 126.4407, timezone: "Asia/Seoul" },
  YYZ: { code: "YYZ", name: "Toronto Pearson Intl", city: "Toronto", country: "CA", lat: 43.6777, lon: -79.6248, timezone: "America/Toronto" },
  MEX: { code: "MEX", name: "Mexico City Intl", city: "Mexico City", country: "MX", lat: 19.4363, lon: -99.0721, timezone: "America/Mexico_City" },
};

/**
 * Calculate great circle distance between two airports using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(origin: string, destination: string): number {
  const orig = AIRPORTS[origin.toUpperCase()];
  const dest = AIRPORTS[destination.toUpperCase()];
  
  if (!orig || !dest) {
    // Fallback estimate if airport not in database
    return 1000;
  }
  
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(dest.lat - orig.lat);
  const dLon = toRad(dest.lon - orig.lon);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(orig.lat)) * Math.cos(toRad(dest.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance);
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find optimal hub airports for connecting flights
 */
export function findOptimalHubs(origin: string, destination: string): string[] {
  const majorHubs = ["ORD", "ATL", "DFW", "DEN", "IAH", "SFO", "LAX", "JFK", "EWR"];
  const orig = AIRPORTS[origin.toUpperCase()];
  const dest = AIRPORTS[destination.toUpperCase()];
  
  if (!orig || !dest) return ["DEN", "ORD"];
  
  // Calculate which hubs are geographically between origin and destination
  const hubs = majorHubs
    .filter(hub => hub !== origin && hub !== destination)
    .map(hub => {
      const hubAirport = AIRPORTS[hub];
      if (!hubAirport) return null;
      
      // Calculate if hub is roughly on the path
      const totalDirect = calculateDistance(origin, destination);
      const viaHub = calculateDistance(origin, hub) + calculateDistance(hub, destination);
      const deviation = viaHub - totalDirect;
      
      return { hub, deviation };
    })
    .filter((h): h is { hub: string; deviation: number } => h !== null)
    .sort((a, b) => a.deviation - b.deviation)
    .map(h => h.hub);
  
  return hubs.slice(0, 3);
}

/**
 * Determine if route is domestic or international
 */
export function getRouteType(origin: string, destination: string): "domestic" | "international" {
  const orig = AIRPORTS[origin.toUpperCase()];
  const dest = AIRPORTS[destination.toUpperCase()];
  
  if (!orig || !dest) return "domestic";
  
  return orig.country === dest.country ? "domestic" : "international";
}

/**
 * Get airport info
 */
export function getAirport(code: string): Airport | null {
  return AIRPORTS[code.toUpperCase()] || null;
}




