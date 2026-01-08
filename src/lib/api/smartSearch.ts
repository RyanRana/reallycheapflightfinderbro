/**
 * Smart Search - Intelligent API Budget Management
 * 
 * GOAL: Maximum value with MINIMUM API calls
 * - Use heuristics to predict best options
 * - Stop early when we find good deals
 * - Cache everything aggressively
 * - Prioritize high-probability strategies
 */

import { searchGoogleFlights, type SerpFlightResult } from "./serpapi";

// API call tracker
let apiCallCount = 0;
const MAX_API_CALLS_PER_SEARCH = 15; // Hard limit

export function resetApiCallCount() {
  apiCallCount = 0;
}

export function getApiCallCount() {
  return apiCallCount;
}

/**
 * Smart wrapper around SerpAPI - tracks and limits calls
 */
export async function smartSearchFlights(
  origin: string,
  destination: string,
  date: string,
  returnDate?: string,
  reason: string = "search"
): Promise<SerpFlightResult[]> {
  if (apiCallCount >= MAX_API_CALLS_PER_SEARCH) {
    console.log(`⚠️ API budget exhausted (${apiCallCount}/${MAX_API_CALLS_PER_SEARCH}). Skipping: ${reason}`);
    return [];
  }

  apiCallCount++;
  console.log(`🔍 API Call ${apiCallCount}/${MAX_API_CALLS_PER_SEARCH}: ${origin}→${destination} (${reason})`);
  
  try {
    return await searchGoogleFlights(origin, destination, date, returnDate);
  } catch (error) {
    console.error(`API call failed: ${error}`);
    return [];
  }
}

/**
 * Intelligent nearby airport selection
 * Only check airports that are LIKELY to be cheaper
 */
export function selectSmartAlternatives(airport: string, basePrice: number): string[] {
  const allAlternatives: Record<string, string[]> = {
    "JFK": ["EWR", "LGA"],
    "EWR": ["JFK", "LGA"],
    "LGA": ["JFK", "EWR"],
    "LAX": ["BUR", "ONT", "LGB", "SNA"],
    "SFO": ["OAK", "SJC"],
    "ORD": ["MDW"],
    "IAD": ["DCA", "BWI"],
    "FLL": ["MIA", "PBI"],
  };

  const alts = allAlternatives[airport] || [];
  
  // Heuristic: If base price is low (<$100), only check 1 alternative
  // If base price is high (>$200), check all alternatives
  if (basePrice < 100) {
    return alts.slice(0, 1);
  } else if (basePrice < 200) {
    return alts.slice(0, 2);
  }
  
  return alts;
}

/**
 * Intelligent hidden city selection
 * Only check cities that make geographical sense
 */
export function selectSmartBeyondCities(origin: string, destination: string): string[] {
  // Major hubs beyond common destinations
  const beyondCities: Record<string, string[]> = {
    "LAX": ["SFO", "SEA", "HNL", "SYD"],      // Continue west/Pacific
    "SFO": ["LAX", "SEA", "HNL", "NRT"],      // West coast + Asia
    "ATL": ["MIA", "MCO", "MSY"],             // Southeast
    "ORD": ["DEN", "SFO", "LAX", "SEA"],      // Midwest to west
    "DFW": ["LAX", "PHX", "DEN"],             // Texas to west
    "MIA": ["PTY", "BOG", "GRU"],             // South America
    "JFK": ["LHR", "CDG", "DUB"],             // Transatlantic
    "LAX_FROM_EAST": ["DEN", "PHX", "LAS"],   // Connections from east
  };

  // Smart routing logic
  const eastCoast = ["JFK", "EWR", "LGA", "BOS", "DCA", "IAD", "MIA", "MCO"];
  const westCoast = ["LAX", "SFO", "SEA", "SAN", "PDX"];
  
  const isEastToWest = eastCoast.includes(origin) && westCoast.includes(destination);
  
  if (isEastToWest) {
    // For east-to-west, check midwest hubs
    return ["DEN", "ORD", "DFW"].filter(h => h !== origin && h !== destination).slice(0, 2);
  }
  
  // Otherwise check logical beyond cities for the destination
  return (beyondCities[destination] || []).slice(0, 2);
}

/**
 * Intelligent hub selection for split ticketing
 * Only check hubs that make geographical sense
 */
export function selectSmartHubs(origin: string, destination: string, basePrice: number): string[] {
  // Only worth checking if base price is high enough
  if (basePrice < 120) return [];

  const majorHubs = ["ORD", "ATL", "DFW", "DEN", "LAX", "SFO", "JFK", "MIA"];
  
  // Filter out origin and destination
  const viableHubs = majorHubs.filter(h => h !== origin && h !== destination);
  
  // Geographic logic: pick the most likely hub based on route
  const eastCoast = ["JFK", "EWR", "LGA", "BOS", "DCA", "PHL"];
  const westCoast = ["LAX", "SFO", "SEA", "PDX", "SAN"];
  const midwest = ["ORD", "DEN", "DFW"];
  
  if (eastCoast.includes(origin) && westCoast.includes(destination)) {
    // East to west: check ONE midwest hub
    return ["DEN"];
  } else if (westCoast.includes(origin) && eastCoast.includes(destination)) {
    // West to east: check ONE midwest hub
    return ["ORD"];
  }
  
  // For other routes, check the geographically closest major hub
  return viableHubs.slice(0, 1);
}

/**
 * Should we check positioning flights?
 * Only if price is high enough to justify the complexity
 */
export function shouldCheckPositioning(basePrice: number): boolean {
  return basePrice > 300; // Only for expensive international flights
}

/**
 * Should we check hidden city?
 * Only if there's a reasonable chance of savings
 */
export function shouldCheckHiddenCity(basePrice: number): boolean {
  return basePrice > 100; // Need enough margin for savings
}

/**
 * Priority order for strategies
 * Run high-value, low-cost strategies first
 */
export const STRATEGY_PRIORITY = {
  "nearby-airports": 1,      // 2-3 API calls, high success rate
  "split-ticketing": 2,      // 2 API calls, good success rate  
  "throwaway": 3,            // 1 API call, quick check
  "hidden-city": 4,          // 2-4 API calls, medium success
  "positioning": 5,          // 3-4 API calls, low success rate
};



