# Flight Search Engine - Technical Documentation

A high-performance flight search engine that uses advanced booking strategies to find cheaper flights than traditional search aggregators. Implements intelligent API budget management, multi-strategy deal discovery, and real-time data analysis.

## Architecture

### Core Components

```
src/lib/api/
├── serpapi.ts          # SerpAPI integration (Google Flights data)
├── smartSearch.ts      # API budget management & intelligent routing
├── dealFinder.ts       # Advanced deal-finding strategies
├── dataAnalyzer.ts     # Flight data analysis & deal extraction
├── resultGrouper.ts    # Result curation & grouping algorithms
├── pricingEngine.ts    # Award calculations & pricing formulas
└── airportData.ts      # Airport coordinates & distance calculations
```

### Technology Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **API Layer**: tRPC + React Query
- **Data Source**: SerpAPI (Google Flights scraping)
- **Caching**: Redis (Upstash) - 5-minute cache window
- **UI**: Tailwind CSS + shadcn/ui components

---

## API Integration: SerpAPI

### Implementation

**File**: `src/lib/api/serpapi.ts`

Real-time flight data is fetched via SerpAPI, which scrapes Google Flights results. The integration provides:

- **Real-time pricing**: Direct from Google Flights (not estimates)
- **Booking tokens**: `booking_token` field for direct Google Flights booking links
- **Flight details**: Complete itinerary data (airlines, flight numbers, layovers, duration)
- **Price insights**: `price_insights` with lowest price and typical price ranges

### API Call Structure

```typescript
const params = {
  engine: "google_flights",
  departure_id: origin,        // 3-letter IATA code
  arrival_id: destination,     // 3-letter IATA code
  outbound_date: date,         // YYYY-MM-DD format
  return_date?: returnDate,    // Optional for round-trip
  currency: "USD",
  hl: "en",
  type: returnDate ? "1" : "2", // 1 = round trip, 2 = one way
  travel_class: "1",           // 1 = economy, 2 = business, 3 = first
  api_key: SERP_API_KEY
};
```

### Response Parsing

- Combines `best_flights` and `other_flights` arrays
- Limits `other_flights` to top 10 results for performance
- Extracts: price, booking_token, flight legs, layovers, duration, airline details

### Booking Link Generation

Priority order:
1. **Google Flights booking token** (if available): `https://www.google.com/travel/flights/booking?token={token}`
2. **Airline deep links**: Direct links to United, American, Delta, Southwest, JetBlue, Alaska, Spirit, Frontier booking pages with pre-filled parameters
3. **Google Flights search URL**: Universal fallback with search parameters

---

## Smart API Budget Management

**File**: `src/lib/api/smartSearch.ts`

Implements intelligent API call budgeting to prevent excessive costs while maximizing deal discovery.

### Budget Limits

- **Maximum**: 15 API calls per search (hard limit)
- **Real-time tracking**: Tracks calls in-memory with `apiCallCount`
- **Early exit**: Stops making calls when budget exhausted

### Intelligent Selection Algorithms

#### 1. Nearby Airport Selection (`selectSmartAlternatives`)

**Heuristic**: Only check airports likely to yield savings based on base price.

```typescript
if (basePrice < 100) return alts.slice(0, 1);  // Check 1 alternative
if (basePrice < 200) return alts.slice(0, 2);  // Check 2 alternatives
return alts;                                    // Check all for expensive flights
```

**Airport alternatives mapping**:
- JFK/EWR/LGA: New York area
- LAX/BUR/ONT/SNA/LGB: Los Angeles area
- SFO/OAK/SJC: San Francisco area
- IAD/DCA/BWI: Washington DC area
- MIA/FLL/PBI: South Florida area

#### 2. Hidden City Selection (`selectSmartBeyondCities`)

**Geographic routing logic**:

- **East→West routes**: Check midwest hubs (DEN, ORD, DFW) - most likely to have layovers at destination
- **Transatlantic**: Check European beyonds (LHR, CDG, DUB)
- **Pacific**: Check Asia/Pacific beyonds (NRT, HNL, SYD)
- **South America**: Check hub cities (PTY, BOG, GRU)

**Implementation**:
```typescript
const isEastToWest = eastCoast.includes(origin) && westCoast.includes(destination);
if (isEastToWest) {
  return ["DEN", "ORD", "DFW"].filter(h => h !== origin && h !== destination).slice(0, 2);
}
```

#### 3. Split Ticketing Hub Selection (`selectSmartHubs`)

**Threshold**: Only check if `basePrice >= $120` (not worthwhile for cheap flights)

**Geographic logic**:
- **East→West**: Check DEN (most logical midwest hub)
- **West→East**: Check ORD (most logical midwest hub)
- **Other routes**: Check geographically closest major hub

**Major hubs considered**: ORD, ATL, DFW, DEN, LAX, SFO, JFK, MIA

#### 4. Positioning Flight Selection (`shouldCheckPositioning`)

**Threshold**: Only for expensive international flights (`basePrice > $300`)

**Logic**: Checks 1-2 most logical cheap departure cities based on destination (e.g., FLL/MIA for international routes)

---

## Deal-Finding Strategies

**File**: `src/lib/api/dealFinder.ts`

### Strategy 1: Nearby Airport Deals

**Method**: `findNearbyAirportDeals`

**Algorithm**:
1. Calculate alternative airports for origin and destination using `selectSmartAlternatives`
2. For each alternative origin: Search `altOrigin → destination`, check if price < 85% of base price
3. For each alternative destination: Search `origin → altDest`, check if price < 85% of base price
4. **Filter**: Only return direct flights (excludes connecting flights)
5. **Threshold**: Only execute if `basePrice >= $70`

**Savings calculation**:
```typescript
const savings = basePrice - alternativePrice;
const savingsPercent = Math.round((savings / basePrice) * 100);
```

**Example output**: `"EWR → LAX (instead of JFK) - Save $25!"`

### Strategy 2: Split Ticketing

**Method**: `findSplitTicketDeals`

**Algorithm**:
1. Select logical hub(s) using `selectSmartHubs` (geographic routing)
2. **Parallel execution**: Search both legs simultaneously
   - `origin → hub`
   - `hub → destination`
3. Calculate total: `leg1Price + leg2Price`
4. **Threshold**: Only if total < 85% of base price AND `basePrice >= $90`
5. **Risk**: User must book 2 separate tickets (no protection if one leg cancels)

**Time complexity**: O(1) hub checks (typically 1-2 API calls for both legs)

**Example output**: `"JFK → DEN + DEN → LAX (2 separate bookings)"`

### Strategy 3: Positioning Flights

**Method**: `findPositioningFlightDeals`

**Algorithm**:
1. **Threshold check**: Only execute if `basePrice >= $300` (not worthwhile for cheap flights)
2. Select cheap departure cities (e.g., FLL, MIA for international)
3. **Two-flight booking**:
   - Positioning flight: `origin → cheapCity` (day before main flight)
   - Main flight: `cheapCity → destination` (original date)
4. **Threshold**: Only if total < 75% of base price (must be significant savings)

**Time complexity**: O(n) where n = number of cheap cities checked (typically 1-2)

**Example output**: `"JFK → FLL (day before) + FLL → LHR"`

### Strategy 4: Hidden City Flights

**Method**: Implemented via `searchHiddenCityFlights` in `serpapi.ts`

**Algorithm**:
1. Select beyond destinations using `selectSmartBeyondCities` (geographic logic)
2. Search `origin → beyondDestination` for all beyond destinations (parallel, max 5)
3. **Filter**: Find flights where layover airport = target destination
4. **Result**: User books to farther destination but exits at layover (must not check bags)

**Threshold**: Only check if `basePrice >= $100`

**Legal note**: Violates airline terms of service - user risk

### Strategy 5: Connecting Flight Optimizer

**Method**: `findBestConnectingFlights`

**Algorithm**:
1. Filter flights with layovers: `flights.length > 1` OR `layovers.length > 0`
2. **Price filter**: Only flights < 90% of direct price
3. Returns sorted by price (cheapest first)

**Use case**: Extracts connecting flight deals from primary SerpAPI results (no additional API calls)

### Strategy 6: Budget Airline Filter

**Method**: `filterBudgetAirlineFlights`

**Algorithm**:
1. Identify budget airlines: Spirit, Frontier, Allegiant, Sun Country, Southwest, JetBlue, Breeze
2. Filter flights where any leg's airline matches budget airline list
3. **Warning**: Display fee warnings (baggage, seat selection typically extra)

**Data source**: Uses primary SerpAPI results (no additional API calls)

---

## Data Analysis Engine

**File**: `src/lib/api/dataAnalyzer.ts`

Extracts maximum value from existing flight data without additional API calls. Analyzes primary SerpAPI results to identify deal opportunities.

### Analysis Methods

#### 1. Red-Eye Flight Detection

**Criteria**: Departure time between 22:00-05:59

**Algorithm**:
```typescript
const hour = departureTime.getHours();
if (hour >= 22 || hour <= 5) {
  // Identify as red-eye flight
  // Calculate savings vs average price
  const savings = avgPrice - flight.price;
}
```

**Output**: `"🌙 Red-eye 11:30 PM - Save $25!"` or `"🌙 Red-eye option 1:15 AM - Late night departure"`

#### 2. Early Bird Detection

**Criteria**: Departure time between 06:00-08:59

**Output**: `"🌅 Early departure 07:00 AM - Beat the crowds"`

#### 3. Layover Savings Analysis

**Algorithm**:
1. Identify connecting flights: `flights.length > 1` OR `layovers.length > 0`
2. Extract layover airport and duration
3. **Value calculation**: `priceDiff = cheapestDirectPrice - connectingPrice`
4. **Worth-it threshold**: `priceDiff > $30` AND `layoverDuration < 240 minutes`

**Output**: `"1 stop in DEN (2h layover) - Save $45 ✨"` or `"Via ATL (1h layover)"`

#### 4. Budget Airline Identification

**Algorithm**:
1. Match airline name against budget airline list (case-insensitive)
2. Calculate savings vs direct price
3. Add fee warnings

**Output**: `"💰 Spirit - Save $30! (May have extra fees)"` or `"💰 JetBlue budget option (Check baggage fees)"`

#### 5. Connecting Flight Value Analysis

**Algorithm**:
1. Filter connecting flights with `priceDiff > $20`
2. Calculate savings percentage: `(priceDiff / cheapestDirectPrice) * 100`
3. Count number of stops

**Output**: `"2 stops - Save $60 (18% less)"`

### Performance

- **Time complexity**: O(n) where n = number of flights in primary results
- **API calls**: 0 (uses existing data)
- **Deduplication**: Uses `Set<string>` with flight keys: `${airline}-${flightNumber}-${departureTime}`

---

## Result Curation & Grouping

**File**: `src/lib/api/resultGrouper.ts`

Intelligently groups and curates search results for maximum user value and variety.

### Grouping Algorithms

#### 1. Time-of-Day Grouping

**Categories**:
- **Morning**: 06:00-11:59 (max 2 per category)
- **Afternoon**: 12:00-17:59 (max 2 per category)
- **Evening**: 18:00-23:59 (max 2 per category)
- **Overnight**: 00:00-05:59 (max 2 per category)

**Algorithm**:
```typescript
const hour = new Date(departureDate).getHours();
if (hour >= 6 && hour < 12) result.cheapestByTime.morning.push(deal);
// ... etc
```

#### 2. Airline Grouping

**Algorithm**:
- Group deals by first leg's airline
- Limit: 2 deals per airline (prevents airline dominance)
- Sort by price within each airline group

#### 3. Strategy Grouping

**Algorithm**:
- Group by `deal.strategy` field
- **Special deals**: All non-standard strategies (hidden-city, award, currency, error, throwaway)
- **Standard deals**: Regular flight results

### Curation Algorithm

**Output**: 15-35 diverse, high-value deals

**Priority order**:
1. **Cheapest overall** (always included)
2. **All special strategies** (hidden-city, awards, etc.) - up to 30
3. **Best from each time period** (2 per period) - up to 40
4. **Best from each airline** (2 per airline) - up to 40
5. **Price variety** (different price points: $10 increments) - up to 35

**Deduplication**: Uses `Set<string>` with flight keys: `${airline}-${flightNumber}-${departureDate}`

**Performance**: O(n log n) for sorting, O(n) for grouping

---

## Award Flight Calculations

**File**: `src/lib/api/pricingEngine.ts`

Calculates award mileage requirements using published airline award charts.

### United MileagePlus

**Domestic**:
- < 700 miles: 12,500 miles (economy), 25,000 (business)
- ≥ 700 miles: 25,000 miles (economy), 50,000 (business)
- Fees: $5.60

**International**:
- < 3,000 miles: 30,000 miles (economy), 70,000 (business)
- 3,000-6,000 miles: 60,000 miles (economy), 130,000 (business)
- ≥ 6,000 miles: 80,000 miles (economy), 160,000 (business)
- Fees: $89-150

### American AAdvantage

**Domestic**: Same as United (12,500/25,000)

**International**:
- < 3,000 miles: 35,000 miles (economy), 75,000 (business)
- 3,000-6,000 miles: 57,500 miles (economy), 115,000 (business)
- ≥ 6,000 miles: 75,000 miles (economy), 150,000 (business)

### Delta SkyMiles

**Estimate**: Dynamic pricing, typically ~10% more than United/American

**Formula**: `miles = baseAward * 1.1` (rounded)

### Risk Score Calculation

- **15% risk**: Award availability not guaranteed (must check airline website)
- **25% risk**: Dynamic pricing may vary significantly
- **30% risk**: Limited availability on popular routes

---

## Distance Calculations

**File**: `src/lib/api/airportData.ts`

Uses **Haversine formula** to calculate great-circle distance between airports.

### Formula

```typescript
const R = 3959; // Earth radius in miles
const φ1 = lat1 * Math.PI / 180;
const φ2 = lat2 * Math.PI / 180;
const Δφ = (lat2 - lat1) * Math.PI / 180;
const Δλ = (lon2 - lon1) * Math.PI / 180;

const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

const distance = R * c;
```

### Airport Database

Stores IATA codes with latitude/longitude coordinates for ~50 major airports:
- US hubs: JFK, LAX, ORD, ATL, DFW, DEN, SFO, SEA, MIA, etc.
- International: LHR, CDG, NRT, DXB, etc.

---

## API Budget Optimization

### Cost Analysis

**SerpAPI Pricing**: ~$0.002 per API call

**Before optimization**: 137 calls/search = $0.274/search = $274/month (1,000 searches)

**After optimization**: 7-15 calls/search = $0.014-0.030/search = $14-30/month (1,000 searches)

**Savings**: ~91-95% cost reduction

### Execution Flow

1. **Primary search**: 1 call (`origin → destination`)
2. **Nearby airports**: 1-3 calls (based on price heuristics)
3. **Split ticketing**: 0-2 calls (geographic hub selection)
4. **Hidden city**: 0-4 calls (geographic beyond selection)
5. **Positioning**: 0-4 calls (only for expensive flights)
6. **Currency arbitrage**: 0 calls (uses primary data)
7. **Awards**: 0 calls (calculations only)
8. **Throwaway**: 0-1 call (one-way only)
9. **Error fares**: 0 calls (RSS feed, no API)

**Total**: Typically 2-10 calls per search (well under 15 budget)

---

## Performance Metrics

### Search Time

- **Primary API call**: ~1.5-2.5 seconds
- **Parallel strategy calls**: ~2-4 seconds (all strategies run in parallel with `Promise.all`)
- **Data analysis**: < 50ms (in-memory processing)
- **Result curation**: < 100ms (grouping and deduplication)
- **Total**: ~3-5 seconds for complete search with all strategies

### Cache Strategy

- **Redis TTL**: 5 minutes (`next: { revalidate: 300 }`)
- **Cache key**: `${origin}-${destination}-${departureDate}-${returnDate || 'oneway'}`
- **Invalidation**: Manual (or wait for TTL)

### Rate Limiting

- SerpAPI rate limits: 100 calls/minute (free tier)
- Our usage: < 15 calls/search = can handle 6+ searches/minute
- **Mitigation**: Redis caching reduces repeat API calls

---

## Error Handling

### API Failures

- **SerpAPI errors**: Return empty array, log error, continue with other strategies
- **Network timeouts**: 30-second timeout per API call, skip on failure
- **Rate limiting**: Exponential backoff (not currently implemented, relies on budget limits)

### Data Validation

- **Airport codes**: Must be 3-letter IATA codes, uppercase
- **Dates**: Must be YYYY-MM-DD format, future dates only
- **Price validation**: Filter out $0 or negative prices
- **Flight data**: Validate required fields (origin, destination, price, airline)

---

## Type Definitions

**File**: `src/types/index.ts`

```typescript
interface Deal {
  priceUsd: number;
  strategy: "standard" | "hidden-city" | "award" | "error" | "currency" | "throwaway";
  riskScore: number;  // 0-100
  bookingLink: string;
  explanation: string;
  legs: Leg[];
}

interface Leg {
  origin: string;           // IATA code
  destination: string;      // IATA code
  departureDate: string;    // ISO 8601
  arrivalDate: string;      // ISO 8601
  airline: string;
  flightNumber: string;
  duration: number;         // minutes
  stops: number;
}
```

---

## Environment Variables

```bash
SERP_API_KEY=your_serpapi_key_here
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
DATABASE_URL=your_postgres_url  # Optional - not currently used
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key  # Optional - auth disabled
CLERK_SECRET_KEY=your_clerk_secret  # Optional - auth disabled
```

---

## Installation & Setup

```bash
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

---

## Future Optimizations

1. **Predictive strategy selection**: ML model to predict which strategies work best per route
2. **Batch API requests**: Combine multiple strategies in single SerpAPI call
3. **Longer cache TTL**: 15-30 minutes for popular routes
4. **Database storage**: Store historical deal data for trend analysis
5. **Real-time error fare detection**: WebSocket integration with error fare feeds
6. **Currency arbitrage expansion**: Multi-currency API integration
7. **Award availability checking**: Integrate with award search APIs (ExpertFlyer, etc.)

---

## License

MIT
