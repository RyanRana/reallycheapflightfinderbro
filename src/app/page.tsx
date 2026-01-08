"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";
import { Search, Plane, AlertTriangle, DollarSign, Sparkles, Globe, Zap } from "lucide-react";
import type { Deal } from "@/types";

const STRATEGY_LABELS: Record<Deal["strategy"], { label: string; icon: React.ReactNode; color: string }> = {
  standard: { label: "Standard", icon: <Plane className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  "hidden-city": { label: "Hidden City", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  award: { label: "Award", icon: <Sparkles className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  error: { label: "Error Fare", icon: <Zap className="h-4 w-4" />, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  currency: { label: "Currency", icon: <Globe className="h-4 w-4" />, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  throwaway: { label: "Throwaway", icon: <DollarSign className="h-4 w-4" />, color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
};

function getRiskColor(riskScore: number): string {
  if (riskScore < 30) return "text-green-500";
  if (riskScore < 60) return "text-yellow-500";
  return "text-red-500";
}

function DealCard({ deal }: { deal: Deal }) {
  const strategy = STRATEGY_LABELS[deal.strategy];

  return (
    <div className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${strategy.color} border`}>
            {strategy.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{strategy.label}</h3>
              <span className={`text-sm font-medium ${getRiskColor(deal.riskScore)}`}>
                Risk: {deal.riskScore}%
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">
              ${deal.priceUsd.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{deal.explanation}</p>

      <div className="space-y-2 mb-4">
        {deal.legs.map((leg, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="font-mono font-semibold">{leg.origin}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono font-semibold">{leg.destination}</span>
            <span className="text-muted-foreground ml-auto">
              {leg.airline} {leg.flightNumber} • {Math.floor(leg.duration / 60)}h {leg.duration % 60}m
              {leg.stops > 0 && ` • ${leg.stops} stop${leg.stops > 1 ? "s" : ""}`}
            </span>
          </div>
        ))}
      </div>

      <Button
        asChild
        className="w-full"
        variant={deal.riskScore > 60 ? "outline" : "default"}
      >
        <a href={deal.bookingLink} target="_blank" rel="noopener noreferrer">
          Book Now
        </a>
      </Button>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function SearchPage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [adults, setAdults] = useState(1);
  const [cabins, setCabins] = useState<string[]>([]);

  const searchMutation = trpc.searchFlights.useMutation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!origin || !destination || !departureDate) {
      alert("Please fill in origin, destination, and departure date");
      return;
    }

    if (origin.length !== 3 || destination.length !== 3) {
      alert("Please use 3-letter airport codes (e.g., JFK, LAX)");
      return;
    }

    searchMutation.mutate({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      dates: {
        departure: departureDate,
        return: isRoundTrip ? returnDate : undefined,
        flexible,
      },
      passengers: {
        adults,
      },
      cabins: cabins.length > 0 ? cabins as any : undefined,
    });
  };

  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Search Flights</h1>
        <p className="text-muted-foreground">
          Search across 6 strategies: standard, hidden-city, awards, currency arbitrage, error fares, and throwaway tickets.
        </p>
      </div>

      <form onSubmit={handleSearch} className="bg-card border rounded-lg p-6 mb-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="origin" className="block text-sm font-medium mb-2">
              From (Airport Code)
            </label>
            <input
              id="origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              placeholder="JFK"
              maxLength={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label htmlFor="destination" className="block text-sm font-medium mb-2">
              To (Airport Code)
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              placeholder="LAX"
              maxLength={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label htmlFor="departure" className="block text-sm font-medium mb-2">
              Departure Date
            </label>
            <input
              id="departure"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              min={today}
              max={maxDate}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label htmlFor="return" className="block text-sm font-medium mb-2">
              Return Date (Optional)
            </label>
            <input
              id="return"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={departureDate || today}
              max={maxDate}
              disabled={!isRoundTrip}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="roundTrip"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="roundTrip" className="text-sm font-medium">
              Round Trip
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="flexible"
              checked={flexible}
              onChange={(e) => setFlexible(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="flexible" className="text-sm font-medium">
              Flexible Dates (±7 days)
            </label>
          </div>

          <div>
            <label htmlFor="adults" className="block text-sm font-medium mb-2">
              Adults
            </label>
            <input
              id="adults"
              type="number"
              value={adults}
              onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={9}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full mt-6"
          size="lg"
          disabled={searchMutation.isPending}
        >
          {searchMutation.isPending ? (
            <>
              <Search className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search Flights
            </>
          )}
        </Button>
      </form>

      {searchMutation.isError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 mb-8">
          <p className="font-medium">Error searching flights</p>
          <p className="text-sm mt-1">{searchMutation.error?.message || "An unexpected error occurred"}</p>
        </div>
      )}

      {searchMutation.isSuccess && searchMutation.data && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">
              Found {searchMutation.data.deals.length} Deal{searchMutation.data.deals.length !== 1 ? "s" : ""}
            </h2>
          </div>

          {searchMutation.data.deals.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-lg">
              <p className="text-muted-foreground">No deals found. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchMutation.data.deals.map((deal, idx) => (
                <DealCard key={idx} deal={deal} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

