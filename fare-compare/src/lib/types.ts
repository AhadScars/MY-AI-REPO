export type Platform = 'ola' | 'uber' | 'rapido';

export type VehicleCategory =
  | 'bike'
  | 'auto'
  | 'mini'
  | 'sedan'
  | 'suv'
  | 'premium';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  geometry: LatLng[];
}

export interface FareOption {
  platform: Platform;
  vehicle: string;
  category: VehicleCategory;
  minFare: number;
  maxFare: number;
  etaMin: number;
  capacity: string;
  features: string[];
  deepLink: string;
}

export interface CompareResult {
  route: RouteInfo;
  options: FareOption[];
  cheapest: FareOption;
  surgeLevel: 'low' | 'medium' | 'high';
  city: string;
}
