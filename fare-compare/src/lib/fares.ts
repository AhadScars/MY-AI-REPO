import type { FareOption, Platform, RouteInfo, VehicleCategory } from './types';

/**
 * Fare models based on typical published rate cards in major Indian cities.
 * Real-time fares vary with demand, traffic, and promotions.
 * These estimates are for comparison / planning only — not official quotes.
 */

interface RateCard {
  platform: Platform;
  vehicle: string;
  category: VehicleCategory;
  baseFare: number;
  perKm: number;
  perMin: number;
  minFare: number;
  freeKm: number;
  freeMin: number;
  capacity: string;
  features: string[];
  /** Multiplier vs baseline city (1 = metro average) */
  cityMultiplier?: number;
}

const RATE_CARDS: RateCard[] = [
  // ——— Rapido ———
  {
    platform: 'rapido',
    vehicle: 'Bike',
    category: 'bike',
    baseFare: 15,
    perKm: 5.5,
    perMin: 0.8,
    minFare: 25,
    freeKm: 0,
    freeMin: 0,
    capacity: '1 rider',
    features: ['Fastest in traffic', 'Helmet provided'],
  },
  {
    platform: 'rapido',
    vehicle: 'Auto',
    category: 'auto',
    baseFare: 28,
    perKm: 10,
    perMin: 1.2,
    minFare: 40,
    freeKm: 1.5,
    freeMin: 0,
    capacity: '3 seats',
    features: ['Open air', 'Good for short trips'],
  },
  {
    platform: 'rapido',
    vehicle: 'Cab Economy',
    category: 'mini',
    baseFare: 45,
    perKm: 11,
    perMin: 1.5,
    minFare: 70,
    freeKm: 1.5,
    freeMin: 0,
    capacity: '4 seats',
    features: ['AC cab', 'Budget friendly'],
  },

  // ——— Ola ———
  {
    platform: 'ola',
    vehicle: 'Auto',
    category: 'auto',
    baseFare: 30,
    perKm: 11,
    perMin: 1.5,
    minFare: 45,
    freeKm: 1.5,
    freeMin: 0,
    capacity: '3 seats',
    features: ['Meter-style pricing', 'Wide availability'],
  },
  {
    platform: 'ola',
    vehicle: 'Mini',
    category: 'mini',
    baseFare: 48,
    perKm: 12,
    perMin: 1.8,
    minFare: 80,
    freeKm: 2,
    freeMin: 0,
    capacity: '4 seats',
    features: ['Hatchback AC', 'Best value car'],
  },
  {
    platform: 'ola',
    vehicle: 'Sedan / Prime',
    category: 'sedan',
    baseFare: 60,
    perKm: 14,
    perMin: 2.2,
    minFare: 100,
    freeKm: 2,
    freeMin: 0,
    capacity: '4 seats',
    features: ['Comfort sedan', 'Prime drivers'],
  },
  {
    platform: 'ola',
    vehicle: 'SUV / XL',
    category: 'suv',
    baseFare: 90,
    perKm: 18,
    perMin: 2.8,
    minFare: 140,
    freeKm: 2,
    freeMin: 0,
    capacity: '6 seats',
    features: ['Extra space', 'Group travel'],
  },

  // ——— Uber ———
  {
    platform: 'uber',
    vehicle: 'Auto',
    category: 'auto',
    baseFare: 32,
    perKm: 10.5,
    perMin: 1.4,
    minFare: 42,
    freeKm: 1.5,
    freeMin: 0,
    capacity: '3 seats',
    features: ['Upfront pricing', 'In-app safety'],
  },
  {
    platform: 'uber',
    vehicle: 'Uber Go',
    category: 'mini',
    baseFare: 50,
    perKm: 11.5,
    perMin: 1.7,
    minFare: 75,
    freeKm: 2,
    freeMin: 0,
    capacity: '4 seats',
    features: ['Most popular', 'Upfront fare'],
  },
  {
    platform: 'uber',
    vehicle: 'Premier',
    category: 'sedan',
    baseFare: 65,
    perKm: 15,
    perMin: 2.4,
    minFare: 110,
    freeKm: 2,
    freeMin: 0,
    capacity: '4 seats',
    features: ['Top-rated drivers', 'Sedan comfort'],
  },
  {
    platform: 'uber',
    vehicle: 'Uber XL',
    category: 'suv',
    baseFare: 95,
    perKm: 19,
    perMin: 3,
    minFare: 150,
    freeKm: 2,
    freeMin: 0,
    capacity: '6 seats',
    features: ['SUV / MPV', 'Luggage friendly'],
  },
];

/** City cost index — higher cities have slightly higher rates */
const CITY_INDEX: Record<string, number> = {
  Mumbai: 1.12,
  'Delhi NCR': 1.05,
  Bengaluru: 1.08,
  Hyderabad: 1.0,
  Chennai: 0.98,
  Pune: 1.02,
  Kolkata: 0.95,
  Ahmedabad: 0.92,
  Jaipur: 0.9,
  Kochi: 0.95,
  India: 1.0,
};

/** Time-of-day surge simulation (realistic peaks) */
export function getSurgeLevel(date = new Date()): {
  level: 'low' | 'medium' | 'high';
  multiplier: number;
  label: string;
} {
  const h = date.getHours();
  const day = date.getDay(); // 0 Sun
  const isWeekend = day === 0 || day === 6;

  // Morning office rush
  if (h >= 8 && h < 11) {
    return { level: 'high', multiplier: isWeekend ? 1.15 : 1.35, label: 'Morning rush' };
  }
  // Evening office rush
  if (h >= 17 && h < 21) {
    return { level: 'high', multiplier: isWeekend ? 1.2 : 1.4, label: 'Evening rush' };
  }
  // Late night
  if (h >= 22 || h < 5) {
    return { level: 'medium', multiplier: 1.2, label: 'Late night' };
  }
  // Weekend midday
  if (isWeekend && h >= 11 && h < 17) {
    return { level: 'medium', multiplier: 1.12, label: 'Weekend demand' };
  }
  return { level: 'low', multiplier: 1.0, label: 'Normal' };
}

function calcFare(
  card: RateCard,
  distanceKm: number,
  durationMin: number,
  cityMult: number,
  surge: number
): { low: number; high: number } {
  const billableKm = Math.max(0, distanceKm - card.freeKm);
  const billableMin = Math.max(0, durationMin - card.freeMin);

  const raw =
    card.baseFare + billableKm * card.perKm + billableMin * card.perMin;

  const afterMin = Math.max(card.minFare, raw);
  const adjusted = afterMin * cityMult * surge;

  // Platform-specific small variance (each platform prices slightly differently)
  const platformJitter =
    card.platform === 'ola' ? 1.02 : card.platform === 'uber' ? 0.99 : 0.97;

  const mid = Math.round(adjusted * platformJitter);
  // Estimate range ±6% (traffic / route variation)
  const low = Math.max(card.minFare, Math.round(mid * 0.94));
  const high = Math.round(mid * 1.08);

  return { low, high };
}

function deepLink(
  platform: Platform,
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number }
): string {
  switch (platform) {
    case 'uber':
      return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${pickup.lat}&pickup[longitude]=${pickup.lng}&dropoff[latitude]=${drop.lat}&dropoff[longitude]=${drop.lng}`;
    case 'ola':
      // Ola web deep link (opens app if installed)
      return `https://book.olacabs.com/?lat=${pickup.lat}&lng=${pickup.lng}&drop_lat=${drop.lat}&drop_lng=${drop.lng}`;
    case 'rapido':
      return `https://rapido.bike/`;
    default:
      return '#';
  }
}

export function estimateAllFares(
  route: RouteInfo,
  city: string,
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number }
): FareOption[] {
  const cityMult = CITY_INDEX[city] ?? 1;
  const surge = getSurgeLevel();

  // Slight platform-specific surge (Uber/Ola often higher surge than Rapido bikes)
  const platformSurge: Record<Platform, number> = {
    rapido: surge.multiplier * 0.95,
    ola: surge.multiplier * 1.02,
    uber: surge.multiplier * 1.05,
  };

  // ETA pad: waiting + trip
  const waitPad: Record<Platform, number> = {
    rapido: 3,
    ola: 5,
    uber: 4,
  };

  return RATE_CARDS.map((card) => {
    const { low, high } = calcFare(
      card,
      route.distanceKm,
      route.durationMin,
      cityMult,
      platformSurge[card.platform]
    );

    // Bikes slightly faster in city traffic
    const speedFactor = card.category === 'bike' ? 0.85 : card.category === 'auto' ? 0.95 : 1;
    const etaMin = Math.max(
      1,
      Math.round(route.durationMin * speedFactor) + waitPad[card.platform]
    );

    return {
      platform: card.platform,
      vehicle: card.vehicle,
      category: card.category,
      minFare: low,
      maxFare: high,
      etaMin,
      capacity: card.capacity,
      features: card.features,
      deepLink: deepLink(card.platform, pickup, drop),
    };
  }).sort((a, b) => a.minFare - b.minFare);
}

export const PLATFORM_META: Record<
  Platform,
  { name: string; color: string; accent: string; tagline: string }
> = {
  ola: {
    name: 'Ola',
    color: '#000000',
    accent: '#C4F542',
    tagline: 'Cabs & autos across India',
  },
  uber: {
    name: 'Uber',
    color: '#000000',
    accent: '#06C167',
    tagline: 'Upfront pricing worldwide',
  },
  rapido: {
    name: 'Rapido',
    color: '#FFC107',
    accent: '#F9A825',
    tagline: 'Bikes, autos & cabs',
  },
};
