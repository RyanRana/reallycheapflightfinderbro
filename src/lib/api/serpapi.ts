/**
 * SerpAPI Integration for Real Google Flights Data
 * 
 * Uses SerpAPI to scrape real-time flight prices from Google Flights
 * No more calculations - these are actual bookable flights!
 */

const SERP_API_KEY = process.env.SERP_API_KEY || "3680ca1d5457c18a4ddf7f25004ac0df5d1d0802cb2857e51c94c910841b1eab";
const SERP_API_BASE = "https://serpapi.com/search.json";

export interface SerpFlightResult {
  flights: Array<{
    departure_airport: {
      name: string;
      id: string;
      time: string;
    };
    arrival_airport: {
      name: string;
      id: string;
      time: string;
    };
    duration: number;
    airplane: string;
    airline: string;
    airline_logo: string;
    travel_class: string;
    flight_number: string;
    legroom: string;
    extensions: string[];
    layovers?: Array<{
      duration: number;
      name: string;
      id: string;
    }>;
  }>;
  price: number;
  type: string;
  booking_token?: string;
}

export interface SerpApiResponse {
  search_metadata: {
    status: string;
  };
  search_parameters: {
    engine: string;
    departure_id: string;
    arrival_id: string;
    outbound_date: string;
    return_date?: string;
  };
  best_flights?: SerpFlightResult[];
  other_flights?: SerpFlightResult[];
  price_insights?: {
    lowest_price: number;
    price_level: string;
    typical_price_range: [number, number];
  };
}

/**
 * Search Google Flights via SerpAPI
 */
export async function searchGoogleFlights(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
  travelClass: string = "economy"
): Promise<SerpFlightResult[]> {
  try {
    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departureDate,
      currency: "USD",
      hl: "en",
      api_key: SERP_API_KEY,
      type: returnDate ? "1" : "2", // 1 = round trip, 2 = one way
    });

    if (returnDate) {
      params.append("return_date", returnDate);
    }

    // Map travel class
    if (travelClass === "business") {
      params.append("travel_class", "2");
    } else if (travelClass === "first") {
      params.append("travel_class", "3");
    } else {
      params.append("travel_class", "1");
    }

    const url = `${SERP_API_BASE}?${params.toString()}`;
    console.log(`[SerpAPI] Searching flights: ${origin} → ${destination}`);

    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
    }

    const data: SerpApiResponse = await response.json();

    if (data.search_metadata.status !== "Success") {
      throw new Error(`SerpAPI search failed: ${data.search_metadata.status}`);
    }

    const results: SerpFlightResult[] = [];

    // Combine best flights and other flights
    if (data.best_flights) {
      results.push(...data.best_flights);
    }
    if (data.other_flights) {
      results.push(...data.other_flights.slice(0, 10)); // Limit to top 10 other flights
    }

    console.log(`[SerpAPI] Found ${results.length} flights`);
    return results;
  } catch (error) {
    console.error("[SerpAPI] Search error:", error);
    return [];
  }
}

/**
 * Search for hidden city opportunities
 * Searches for flights to destinations beyond the target
 */
export async function searchHiddenCityFlights(
  origin: string,
  destination: string,
  departureDate: string
): Promise<Array<{ beyondDestination: string; flights: SerpFlightResult[] }>> {
  const majorHubs = ["LAX", "JFK", "SFO", "ORD", "ATL", "DEN", "DFW", "SEA", "MIA", "LHR", "CDG", "NRT"];
  
  // Filter out origin and destination
  const beyondDestinations = majorHubs.filter(
    (hub) => hub !== origin && hub !== destination
  );

  const results: Array<{ beyondDestination: string; flights: SerpFlightResult[] }> = [];

  // Search for flights to beyond destinations in parallel (limit to 5 to avoid rate limits)
  const searches = beyondDestinations.slice(0, 5).map(async (beyondDest) => {
    const flights = await searchGoogleFlights(origin, beyondDest, departureDate);
    
    // Filter flights that have a layover in our target destination
    const hiddenCityFlights = flights.filter((flight) =>
      flight.flights.some((leg) => 
        leg.layovers?.some((layover) => layover.id === destination)
      )
    );

    if (hiddenCityFlights.length > 0) {
      return { beyondDestination: beyondDest, flights: hiddenCityFlights };
    }
    return null;
  });

  const settled = await Promise.allSettled(searches);
  
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value);
    }
  }

  return results;
}

/**
 * Search multiple dates for flexible travel
 */
export async function searchFlexibleDates(
  origin: string,
  destination: string,
  centerDate: string,
  dayRange: number = 3
): Promise<Array<{ date: string; flights: SerpFlightResult[] }>> {
  const dates: string[] = [];
  const center = new Date(centerDate);

  // Generate date range
  for (let i = -dayRange; i <= dayRange; i++) {
    const date = new Date(center);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }

  // Search all dates in parallel
  const searches = dates.map(async (date) => {
    const flights = await searchGoogleFlights(origin, destination, date);
    return { date, flights };
  });

  const results = await Promise.allSettled(searches);
  
  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ date: string; flights: SerpFlightResult[] }>).value)
    .filter((r) => r.flights.length > 0);
}

/**
 * Build booking link from SerpAPI result
 * Creates direct deep links to airline booking pages
 */
export function buildBookingLink(flight: SerpFlightResult, origin: string, destination: string, date: string): string {
  // Priority 1: Use Google Flights booking token (most reliable)
  if (flight.booking_token) {
    return `https://www.google.com/travel/flights/booking?token=${flight.booking_token}`;
  }

  const airline = flight.flights[0]?.airline || "";
  const departureDate = date.split('T')[0]; // Ensure YYYY-MM-DD format
  
  // Priority 2: Direct airline booking URLs with proper parameters
  const airlineLinks: Record<string, (o: string, d: string, date: string) => string> = {
    "United": (o, d, dt) => 
      `https://www.united.com/en/us/fsr/choose-flights?f=${o}&t=${d}&d=${dt}&tt=1&sc=7&px=1&taxng=1&newHP=True&idx=1`,
    
    "American": (o, d, dt) => 
      `https://www.aa.com/booking/find-flights?locale=en_US&slices=%5B%7B%22orig%22%3A%22${o}%22%2C%22dest%22%3A%22${d}%22%2C%22date%22%3A%22${dt}%22%7D%5D&adults=1&searchType=Award`,
    
    "Delta": (o, d, dt) => 
      `https://www.delta.com/flight-search/book-a-flight?tripType=ONE_WAY&departureDate=${dt}&originCode=${o}&destinationCode=${d}&numOfPassengers=1`,
    
    "Southwest": (o, d, dt) => 
      `https://www.southwest.com/air/booking/select.html?originationAirportCode=${o}&destinationAirportCode=${d}&returnAirportCode=&departureDate=${dt}&departureTimeOfDay=ALL_DAY&adultPassengersCount=1`,
    
    "JetBlue": (o, d, dt) => 
      `https://jbrest.jetblue.com/lfs-rwb/outboundLFS.action?origin=${o}&destination=${d}&dep_date=${dt}`,
    
    "Alaska": (o, d, dt) => 
      `https://www.alaskaair.com/booking/search?numAdults=1&fromCity=${o}&toCity=${d}&fromDate=${dt}`,
    
    "Spirit": (o, d, dt) => 
      `https://www.spirit.com/book/flights?f=${o}&t=${d}&d=${dt}&r=&p=1`,
    
    "Frontier": (o, d, dt) => 
      `https://www.flyfrontier.com/travel/flight-search/?departureDate=${dt}&origin=${o}&destination=${d}&adults=1`,
  };

  // Try to match airline and build deep link
  for (const [name, linkBuilder] of Object.entries(airlineLinks)) {
    if (airline.toLowerCase().includes(name.toLowerCase())) {
      return linkBuilder(origin, destination, departureDate);
    }
  }

  // Priority 3: Google Flights search URL (universal fallback)
  const gfUrl = new URL("https://www.google.com/travel/flights");
  gfUrl.searchParams.set("q", `flights from ${origin} to ${destination} on ${departureDate}`);
  gfUrl.searchParams.set("hl", "en");
  gfUrl.searchParams.set("curr", "USD");
  
  return gfUrl.toString();
}

