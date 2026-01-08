// Shared TypeScript types

export interface Flight {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  price: number;
  airline: string;
  flightNumber: string;
  type: "standard" | "hidden-city" | "award" | "error-fare";
}

export interface Alert {
  id: string;
  origin: string;
  destination: string;
  maxPrice: number;
  createdAt: string;
  userId: string;
}

export interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
}

export interface Leg {
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  airline: string;
  flightNumber: string;
  duration: number; // minutes
  stops: number;
}

export interface Deal {
  priceUsd: number;
  strategy: "hidden-city" | "award" | "error" | "currency" | "standard" | "throwaway";
  riskScore: number; // 0-100
  bookingLink: string;
  explanation: string;
  legs: Leg[];
}

export interface SearchInput {
  origin: string;
  destination: string;
  dates: {
    departure: string; // YYYY-MM-DD
    return?: string; // YYYY-MM-DD
    flexible?: boolean; // ±7 days
  };
  cabins?: ("economy" | "premium" | "business" | "first")[];
  passengers?: {
    adults: number;
    children?: number;
    infants?: number;
  };
}

