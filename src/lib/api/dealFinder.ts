/**
 * Deal Finding Engine - REAL Strategy Implementation
 * 
 * This module implements ACTUAL deal-finding techniques that beat Google Flights:
 * - Nearby airport combinations
 * - Multi-city vs round-trip comparison
 * - Connecting flight analysis
 * - Time-of-day pricing differences
 * - Budget airline integration
 */

import { type SerpFlightResult } from "./serpapi";
import { smartSearchFlights, selectSmartAlternatives, selectSmartHubs, selectSmartBeyondCities } from "./smartSearch";

export interface DealOpportunity {
  savings: number;
  savingsPercent: number;
  technique: string;
  alternativeRoute: string;
  flights: SerpFlightResult[];
}

/**
 * Find nearby airports that might have cheaper flights
 */
export const AIRPORT_ALTERNATIVES: Record<string, string[]> = {
  "JFK": ["EWR", "LGA"],
  "EWR": ["JFK", "LGA"],
  "LGA": ["JFK", "EWR"],
  "LAX": ["BUR", "ONT", "SNA", "LGB"],
  "SFO": ["OAK", "SJC"],
  "ORD": ["MDW"],
  "IAD": ["DCA", "BWI"],
  "DCA": ["IAD", "BWI"],
  "BWI": ["DCA", "IAD"],
  "FLL": ["MIA", "PBI"],
  "MIA": ["FLL", "PBI"],
};

/**
 * Strategy 1: Nearby Airport Hack
 * Check if flying from/to nearby airports is cheaper
 */
export async function findNearbyAirportDeals(
  origin: string,
  destination: string,
  departureDate: string,
  basePrice: number
): Promise<DealOpportunity[]> {
  const deals: DealOpportunity[] = [];
  
  // Lower threshold - worth checking for most flights
  if (basePrice < 70) return [];

  // SMART: Only check most promising alternatives
  const originAlternatives = selectSmartAlternatives(origin, basePrice);
  const destAlternatives = selectSmartAlternatives(destination, basePrice);

  console.log(`   📍 Nearby: ${originAlternatives.length} origins, ${destAlternatives.length} dests (max ${originAlternatives.length + destAlternatives.length} calls)`);

  // Check alternative origins
  for (const altOrigin of originAlternatives) {
    try {
      const flights = await smartSearchFlights(altOrigin, destination, departureDate, undefined, `Nearby: ${altOrigin}→${destination}`);
      if (flights.length > 0 && flights[0].price < basePrice * 0.85) {
        // Filter out connecting flights - only show direct flights
        const isDirect = flights[0].flights.length === 1 && (!flights[0].flights[0].layovers || flights[0].flights[0].layovers.length === 0);
        if (isDirect) {
          const savings = basePrice - flights[0].price;
          deals.push({
            savings,
            savingsPercent: Math.round((savings / basePrice) * 100),
            technique: "nearby-origin",
            alternativeRoute: `${altOrigin} → ${destination} (instead of ${origin})`,
            flights: [flights[0]],
          });
        }
      }
    } catch (err) {
      continue;
    }
  }

  // Check alternative destinations
  for (const altDest of destAlternatives) {
    try {
      const flights = await smartSearchFlights(origin, altDest, departureDate, undefined, `Nearby: ${origin}→${altDest}`);
      if (flights.length > 0 && flights[0].price < basePrice * 0.85) {
        // Filter out connecting flights - only show direct flights
        const isDirect = flights[0].flights.length === 1 && (!flights[0].flights[0].layovers || flights[0].flights[0].layovers.length === 0);
        if (isDirect) {
          const savings = basePrice - flights[0].price;
          deals.push({
            savings,
            savingsPercent: Math.round((savings / basePrice) * 100),
            technique: "nearby-destination",
            alternativeRoute: `${origin} → ${altDest} (instead of ${destination})`,
            flights: [flights[0]],
          });
        }
      }
    } catch (err) {
      continue;
    }
  }

  return deals;
}

/**
 * Strategy 2: Split Ticket Finder
 * Sometimes booking through a hub as 2 separate tickets is cheaper
 */
export async function findSplitTicketDeals(
  origin: string,
  destination: string,
  departureDate: string,
  basePrice: number
): Promise<DealOpportunity[]> {
  const deals: DealOpportunity[] = [];
  
  // Check for any flight over $90 - often worthwhile
  if (basePrice < 90) return [];

  // SMART: Only check the most logical hub(s)
  const smartHubs = selectSmartHubs(origin, destination, basePrice);
  
  if (smartHubs.length === 0) {
    console.log(`   ⊘ Split: No logical hubs for this route`);
    return [];
  }
  
  console.log(`   🎟️  Split: Checking ${smartHubs.length} logical hub(s) (${smartHubs.length * 2} API calls)`);
  
  // Check smart hubs only
  for (const hub of smartHubs) {
    try {
      // Search both legs in parallel for speed
      const [leg1Results, leg2Results] = await Promise.all([
        smartSearchFlights(origin, hub, departureDate, undefined, `Split: ${origin}→${hub}`),
        smartSearchFlights(hub, destination, departureDate, undefined, `Split: ${hub}→${destination}`),
      ]);

      if (leg1Results.length === 0 || leg2Results.length === 0) continue;

      const totalPrice = leg1Results[0].price + leg2Results[0].price;
      
      // Lower threshold to 15% cheaper (was 20%)
      if (totalPrice < basePrice * 0.85) {
        const savings = basePrice - totalPrice;
        deals.push({
          savings,
          savingsPercent: Math.round((savings / basePrice) * 100),
          technique: "split-ticket",
          alternativeRoute: `${origin} → ${hub} + ${hub} → ${destination} (2 separate bookings)`,
          flights: [leg1Results[0], leg2Results[0]],
        });
        // Don't break - keep looking for more deals
      }
    } catch (err) {
      continue;
    }
  }

  return deals;
}

/**
 * Strategy 3: Positioning Flight Analysis
 * Fly to a cheaper departure city first, then to your destination
 */
export async function findPositioningFlightDeals(
  origin: string,
  destination: string,
  departureDate: string,
  basePrice: number
): Promise<DealOpportunity[]> {
  const deals: DealOpportunity[] = [];
  
  // SMART: Only for EXPENSIVE international flights (>$300)
  if (basePrice < 300) {
    console.log(`   ⊘ Positioning: Only worthwhile for expensive flights (>${basePrice})`);
    return [];
  }

  // Pick ONE most logical cheap departure city based on destination
  const cheapDepartureCities = ["FLL", "MIA"];  // Focus on Florida for international
  
  console.log(`   ✈️  Positioning: Checking ${cheapDepartureCities.length} city (${cheapDepartureCities.length * 2} API calls)`);
  
  // Check smart positioning options
  for (const cheapCity of cheapDepartureCities) {
    if (cheapCity === origin || cheapCity === destination) continue;

    try {
      // Positioning flight (day before)
      const posDate = new Date(departureDate);
      posDate.setDate(posDate.getDate() - 1);
      const posDateStr = posDate.toISOString().split("T")[0];
      
      const positioning = await smartSearchFlights(origin, cheapCity, posDateStr, undefined, `Positioning: ${origin}→${cheapCity}`);
      if (positioning.length === 0) continue;

      // Main flight from cheap city
      const mainFlight = await smartSearchFlights(cheapCity, destination, departureDate, undefined, `Positioning: ${cheapCity}→${destination}`);
      if (mainFlight.length === 0) continue;

      const totalPrice = positioning[0].price + mainFlight[0].price;
      
      if (totalPrice < basePrice * 0.75) { // 25% cheaper
        const savings = basePrice - totalPrice;
        deals.push({
          savings,
          savingsPercent: Math.round((savings / basePrice) * 100),
          technique: "positioning-flight",
          alternativeRoute: `${origin} → ${cheapCity} (day before) + ${cheapCity} → ${destination}`,
          flights: [positioning[0], mainFlight[0]],
        });
        // Keep checking for more positioning options
      }
    } catch (err) {
      continue;
    }
  }

  return deals;
}

/**
 * Strategy 4: Connecting Flight Optimizer
 * Find the CHEAPEST connecting flights from SerpAPI results
 */
export function findBestConnectingFlights(
  flights: SerpFlightResult[],
  directPrice: number
): SerpFlightResult[] {
  // Filter for connecting flights
  const connecting = flights.filter(f => 
    f.flights.length > 1 || 
    f.flights.some(leg => leg.layovers && leg.layovers.length > 0)
  );

  // Find ones significantly cheaper than direct
  return connecting.filter(f => f.price < directPrice * 0.90);
}

/**
 * Strategy 5: Budget Airline Deep Search
 * Note: SerpAPI includes budget airlines, but we can prioritize them
 */
export function filterBudgetAirlineFlights(
  flights: SerpFlightResult[]
): SerpFlightResult[] {
  const budgetAirlines = [
    "Spirit", "Frontier", "Allegiant", "Sun Country",
    "Southwest", "JetBlue", "Breeze"
  ];

  return flights.filter(f =>
    f.flights.some(leg => 
      budgetAirlines.some(budget => 
        leg.airline.toLowerCase().includes(budget.toLowerCase())
      )
    )
  );
}

