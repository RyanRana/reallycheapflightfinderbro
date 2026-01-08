/**
 * Result Grouper - Make search results INTERESTING and USEFUL
 * Group flights by categories that matter to users
 */

import { type Deal } from "@/types";

export interface GroupedResults {
  bestOverall: Deal | null;
  cheapestByTime: {
    morning: Deal[];    // 6am-12pm
    afternoon: Deal[];  // 12pm-6pm
    evening: Deal[];    // 6pm-12am
    overnight: Deal[];  // 12am-6am
  };
  byAirline: Map<string, Deal[]>;
  byStrategy: Map<string, Deal[]>;
  specialDeals: Deal[];  // Unique strategies
  topDeals: Deal[];      // Final curated list
}

export function groupAndCurateResults(deals: Deal[]): GroupedResults {
  if (deals.length === 0) {
    return {
      bestOverall: null,
      cheapestByTime: { morning: [], afternoon: [], evening: [], overnight: [] },
      byAirline: new Map(),
      byStrategy: new Map(),
      specialDeals: [],
      topDeals: [],
    };
  }

  // Sort by price
  const sorted = [...deals].sort((a, b) => a.priceUsd - b.priceUsd);
  
  const result: GroupedResults = {
    bestOverall: sorted[0],
    cheapestByTime: { morning: [], afternoon: [], evening: [], overnight: [] },
    byAirline: new Map(),
    byStrategy: new Map(),
    specialDeals: [],
    topDeals: [],
  };

  // Group by time of day
  for (const deal of deals) {
    const timeStr = deal.legs[0]?.departureDate || '';
    const hour = new Date(timeStr).getHours();
    
    if (hour >= 6 && hour < 12) {
      if (result.cheapestByTime.morning.length < 2) result.cheapestByTime.morning.push(deal);
    } else if (hour >= 12 && hour < 18) {
      if (result.cheapestByTime.afternoon.length < 2) result.cheapestByTime.afternoon.push(deal);
    } else if (hour >= 18 && hour < 24) {
      if (result.cheapestByTime.evening.length < 2) result.cheapestByTime.evening.push(deal);
    } else {
      if (result.cheapestByTime.overnight.length < 2) result.cheapestByTime.overnight.push(deal);
    }
  }

  // Group by airline
  for (const deal of deals) {
    const airline = deal.legs[0]?.airline || 'Unknown';
    if (!result.byAirline.has(airline)) {
      result.byAirline.set(airline, []);
    }
    const airlineDeals = result.byAirline.get(airline)!;
    if (airlineDeals.length < 2) {
      airlineDeals.push(deal);
    }
  }

  // Group by strategy
  for (const deal of deals) {
    if (!result.byStrategy.has(deal.strategy)) {
      result.byStrategy.set(deal.strategy, []);
    }
    result.byStrategy.get(deal.strategy)!.push(deal);
  }

  // Identify special deals (non-standard strategies)
  result.specialDeals = deals.filter(d => d.strategy !== 'standard');

  // Curate top deals with VARIETY
  const topDeals: Deal[] = [];
  const addedFlights = new Set<string>();

  // 1. Always add cheapest
  if (sorted[0]) {
    topDeals.push(sorted[0]);
    addedFlights.add(getFlightKey(sorted[0]));
  }

  // 2. Add all special strategies
  for (const deal of result.specialDeals) {
    const key = getFlightKey(deal);
    if (!addedFlights.has(key) && topDeals.length < 30) {
      topDeals.push(deal);
      addedFlights.add(key);
    }
  }

  // 3. Add best from each time period (2 per period)
  for (const period of Object.values(result.cheapestByTime)) {
    for (let i = 0; i < 2 && i < period.length && topDeals.length < 40; i++) {
      const key = getFlightKey(period[i]);
      if (!addedFlights.has(key)) {
        topDeals.push(period[i]);
        addedFlights.add(key);
      }
    }
  }

  // 4. Add best from each airline (2 per airline)
  for (const [airline, airlineDeals] of result.byAirline) {
    for (let i = 0; i < 2 && i < airlineDeals.length && topDeals.length < 40; i++) {
      const key = getFlightKey(airlineDeals[i]);
      if (!addedFlights.has(key)) {
        topDeals.push(airlineDeals[i]);
        addedFlights.add(key);
      }
    }
  }

  // 5. Fill remaining with price variety (different price points)
  const pricesSeen = new Set(topDeals.map(d => Math.floor(d.priceUsd / 10) * 10));
  for (const deal of sorted) {
    if (topDeals.length >= 35) break;
    
    const pricePoint = Math.floor(deal.priceUsd / 10) * 10;
    const key = getFlightKey(deal);
    
    if (!pricesSeen.has(pricePoint) && !addedFlights.has(key)) {
      topDeals.push(deal);
      addedFlights.add(key);
      pricesSeen.add(pricePoint);
    }
  }

  result.topDeals = topDeals.sort((a, b) => a.priceUsd - b.priceUsd);

  console.log(`📦 Grouped results:`, {
    total: deals.length,
    special: result.specialDeals.length,
    airlines: result.byAirline.size,
    strategies: result.byStrategy.size,
    curated: result.topDeals.length,
  });

  return result;
}

function getFlightKey(deal: Deal): string {
  return `${deal.legs[0]?.airline}-${deal.legs[0]?.flightNumber}-${deal.legs[0]?.departureDate}`;
}

