/**
 * Data Analyzer - Extract MAXIMUM value from existing flight data
 * NO ADDITIONAL API CALLS - Just smart analysis
 */

import { type SerpFlightResult } from "./serpapi";
import { type Deal } from "@/types";

export interface AnalysisResult {
  redEyeDeals: Deal[];
  layoverDeals: Deal[];
  budgetAirlineDeals: Deal[];
  connectingDeals: Deal[];
  timeBasedDeals: Deal[];
}

/**
 * Analyze ALL existing flights and extract every possible deal
 */
export function analyzeFlightData(
  flights: SerpFlightResult[],
  origin: string,
  destination: string,
  departureDate: string
): AnalysisResult {
  if (flights.length === 0) {
    return {
      redEyeDeals: [],
      layoverDeals: [],
      budgetAirlineDeals: [],
      connectingDeals: [],
      timeBasedDeals: [],
    };
  }

  const basePrice = flights[0].price;
  const directFlights = flights.filter(f => f.flights.length === 1 && (!f.flights[0].layovers || f.flights[0].layovers.length === 0));
  const cheapestDirectPrice = directFlights[0]?.price || basePrice;
  const avgPrice = flights.slice(0, 5).reduce((sum, f) => sum + f.price, 0) / Math.min(5, flights.length);

  const result: AnalysisResult = {
    redEyeDeals: [],
    layoverDeals: [],
    budgetAirlineDeals: [],
    connectingDeals: [],
    timeBasedDeals: [],
  };

  // Budget airlines list
  const budgetAirlines = ['Spirit', 'Frontier', 'Allegiant', 'JetBlue', 'Southwest'];
  const seenFlights = new Set<string>();

  for (const flight of flights) {
    const firstLeg = flight.flights[0];
    if (!firstLeg) continue;

    const flightKey = `${firstLeg.airline}-${firstLeg.flight_number}-${firstLeg.departure_airport.time}`;
    if (seenFlights.has(flightKey)) continue;
    seenFlights.add(flightKey);

    const savings = Math.max(0, avgPrice - flight.price);
    const priceDiff = cheapestDirectPrice - flight.price;

    // 1. RED-EYE & EARLY BIRD ANALYSIS (show ALL, not just cheaper)
    const departureTime = new Date(firstLeg.departure_airport.time);
    const hour = departureTime.getHours();
    
    if (hour >= 22 || hour <= 5) {
      const timeStr = departureTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      result.redEyeDeals.push(createDeal(
        flight,
        origin,
        destination,
        departureDate,
        savings > 5 
          ? `🌙 Red-eye ${timeStr} - Save $${Math.round(savings)}!`
          : `🌙 Red-eye option ${timeStr} - Late night departure`,
        5
      ));
    } else if (hour >= 6 && hour <= 8) {
      const timeStr = departureTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      result.timeBasedDeals.push(createDeal(
        flight,
        origin,
        destination,
        departureDate,
        savings > 5
          ? `🌅 Early bird ${timeStr} - Save $${Math.round(savings)}!`
          : `🌅 Early departure ${timeStr} - Beat the crowds`,
        5
      ));
    }

    // 2. LAYOVER SAVINGS ANALYSIS
    const hasLayover = flight.flights.length > 1 || (firstLeg.layovers?.length ?? 0) > 0;
    if (hasLayover) {
      const layoverAirport = firstLeg.layovers?.[0]?.id || flight.flights[1]?.departure_airport?.id || 'Hub';
      const layoverDuration = firstLeg.layovers?.[0]?.duration || 120;
      const worthIt = priceDiff > 30 && layoverDuration < 240;
      
      result.layoverDeals.push(createDeal(
        flight,
        origin,
        destination,
        departureDate,
        priceDiff > 10
          ? `1 stop in ${layoverAirport} (${Math.round(layoverDuration / 60)}h layover) - Save $${Math.round(priceDiff)}${worthIt ? ' ✨' : ''}`
          : `Via ${layoverAirport} (${Math.round(layoverDuration / 60)}h layover)`,
        10
      ));
    }

    // 3. BUDGET AIRLINE DEALS (show ALL budget airlines)
    const airline = firstLeg.airline;
    const isBudget = budgetAirlines.some(ba => airline.includes(ba));
    if (isBudget) {
      result.budgetAirlineDeals.push(createDeal(
        flight,
        origin,
        destination,
        departureDate,
        priceDiff > 10
          ? `💰 ${airline} - Save $${Math.round(priceDiff)}! (May have extra fees)`
          : `💰 ${airline} budget option (Check baggage fees)`,
        15
      ));
    }

    // 4. CONNECTING FLIGHT ANALYSIS (show best connecting options)
    if (hasLayover && priceDiff > 20) {
      const savingsPercent = Math.round((priceDiff / cheapestDirectPrice) * 100);
      result.connectingDeals.push(createDeal(
        flight,
        origin,
        destination,
        departureDate,
        `${flight.flights.length} stop${flight.flights.length > 1 ? 's' : ''} - Save $${Math.round(priceDiff)} (${savingsPercent}% less)`,
        10
      ));
    }
  }

  // Sort each category by savings (price)
  result.redEyeDeals.sort((a, b) => a.priceUsd - b.priceUsd);
  result.layoverDeals.sort((a, b) => a.priceUsd - b.priceUsd);
  result.budgetAirlineDeals.sort((a, b) => a.priceUsd - b.priceUsd);
  result.connectingDeals.sort((a, b) => a.priceUsd - b.priceUsd);
  result.timeBasedDeals.sort((a, b) => a.priceUsd - b.priceUsd);

  return result;
}

function createDeal(
  flight: SerpFlightResult,
  origin: string,
  destination: string,
  departureDate: string,
  explanation: string,
  riskScore: number
): Deal {
  return {
    priceUsd: flight.price,
    strategy: "standard",
    riskScore,
    bookingLink: `https://www.google.com/travel/flights/search?tfs=CBwQAhopag0IAhIJL20vMDJfMjg2EgoyMDI2LTA4LTI0cgwIAxIIL20vMGZucGcaKWoMCAMSCC9tLzBmbnBnEgoyMDI2LTA4LTI0cg0IAhIJL20vMDJfMjg2QAFIAXABggELCP___________wGYAQE`,
    explanation,
    legs: flight.flights.map(leg => ({
      origin: leg.departure_airport.id,
      destination: leg.arrival_airport.id,
      departureDate: leg.departure_airport.time,
      arrivalDate: leg.arrival_airport.time,
      airline: leg.airline,
      flightNumber: leg.flight_number,
      duration: leg.duration,
      stops: leg.layovers?.length || 0,
    })),
  };
}

