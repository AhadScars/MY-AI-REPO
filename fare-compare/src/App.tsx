import { useCallback, useState } from 'react';
import { LocationInput } from './components/LocationInput';
import { RouteMap } from './components/RouteMap';
import { CompareResults } from './components/CompareResults';
import { detectCity, getRoute } from './lib/geo';
import { estimateAllFares } from './lib/fares';
import type { FareOption, Place, RouteInfo } from './lib/types';
import './App.css';

const PRESETS: { label: string; pickup: Place; drop: Place }[] = [
  {
    label: 'MG Road → Airport (BLR)',
    pickup: {
      id: 'p1',
      name: 'MG Road, Bengaluru',
      address: 'MG Road, Bengaluru, Karnataka',
      lat: 12.975,
      lng: 77.6063,
    },
    drop: {
      id: 'd1',
      name: 'Kempegowda International Airport',
      address: 'KIAL Rd, Bengaluru',
      lat: 13.1986,
      lng: 77.7066,
    },
  },
  {
    label: 'Connaught Place → Airport (DEL)',
    pickup: {
      id: 'p2',
      name: 'Connaught Place',
      address: 'Connaught Place, New Delhi',
      lat: 28.6315,
      lng: 77.2167,
    },
    drop: {
      id: 'd2',
      name: 'IGI Airport T3',
      address: 'Indira Gandhi International Airport, Delhi',
      lat: 28.5562,
      lng: 77.1,
    },
  },
  {
    label: 'Andheri → BKC (Mumbai)',
    pickup: {
      id: 'p3',
      name: 'Andheri West',
      address: 'Andheri West, Mumbai',
      lat: 19.1364,
      lng: 72.8277,
    },
    drop: {
      id: 'd3',
      name: 'Bandra Kurla Complex',
      address: 'BKC, Mumbai',
      lat: 19.0596,
      lng: 72.8656,
    },
  },
];

export default function App() {
  const [pickup, setPickup] = useState<Place | null>(null);
  const [drop, setDrop] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [options, setOptions] = useState<FareOption[]>([]);
  const [city, setCity] = useState('India');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compared, setCompared] = useState(false);

  const swap = () => {
    setPickup(drop);
    setDrop(pickup);
    setCompared(false);
    setOptions([]);
    setRoute(null);
  };

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setPickup(p.pickup);
    setDrop(p.drop);
    setCompared(false);
    setOptions([]);
    setRoute(null);
    setError(null);
  };

  const compare = useCallback(async () => {
    if (!pickup || !drop) {
      setError('Select both pickup and drop locations');
      return;
    }
    if (pickup.lat === drop.lat && pickup.lng === drop.lng) {
      setError('Pickup and drop cannot be the same place');
      return;
    }

    setLoading(true);
    setError(null);
    setCompared(false);

    try {
      const r = await getRoute(pickup, drop);
      if (r.distanceKm < 0.3) {
        setError('Route is too short to compare meaningfully');
        setLoading(false);
        return;
      }
      const c = detectCity(pickup.lat, pickup.lng);
      const fares = estimateAllFares(r, c, pickup, drop);
      setRoute(r);
      setCity(c);
      setOptions(fares);
      setCompared(true);
    } catch {
      setError('Could not calculate route. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [pickup, drop]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden>
            <span>₹</span>
          </div>
          <div>
            <h1>FareCompare</h1>
            <p>Ola · Uber · Rapido — one screen</p>
          </div>
        </div>
        <p className="header-tagline">
          See which ride is cheaper before you book
        </p>
      </header>

      <main className="main">
        <div className="panel">
          <div className="loc-stack">
            <LocationInput
              label="Pickup"
              placeholder="e.g. Koramangala, Bengaluru"
              value={pickup}
              onChange={setPickup}
              icon="pickup"
            />
            <button type="button" className="swap-btn" onClick={swap} title="Swap">
              ⇅
            </button>
            <LocationInput
              label="Drop"
              placeholder="e.g. Indiranagar, Bengaluru"
              value={drop}
              onChange={setDrop}
              icon="drop"
            />
          </div>

          <div className="presets">
            <span className="presets-label">Quick try:</span>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="preset-chip" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="compare-btn"
            onClick={compare}
            disabled={loading || !pickup || !drop}
          >
            {loading ? (
              <>
                <span className="btn-spinner" /> Comparing fares…
              </>
            ) : (
              'Compare fares'
            )}
          </button>

          {error && <p className="form-error">{error}</p>}

          <div className="platforms-row">
            <div className="plat plat-ola">
              <span className="plat-dot" /> Ola
            </div>
            <div className="plat plat-uber">
              <span className="plat-dot" /> Uber
            </div>
            <div className="plat plat-rapido">
              <span className="plat-dot" /> Rapido
            </div>
          </div>
        </div>

        <div className="map-panel">
          <RouteMap pickup={pickup} drop={drop} route={route} />
        </div>
      </main>

      {compared && route && options.length > 0 && (
        <CompareResults options={options} route={route} city={city} />
      )}

      {!compared && (
        <section className="how-it-works">
          <h2>How it works</h2>
          <div className="steps">
            <div className="step">
              <span className="step-num">1</span>
              <h3>Enter places</h3>
              <p>Search any Indian pickup &amp; drop, or use a quick preset route.</p>
            </div>
            <div className="step">
              <span className="step-num">2</span>
              <h3>We estimate</h3>
              <p>
                Distance via OpenStreetMap routing + typical Ola / Uber / Rapido rate cards,
                city costs and rush-hour demand.
              </p>
            </div>
            <div className="step">
              <span className="step-num">3</span>
              <h3>Book cheaper</h3>
              <p>Compare side-by-side, then open the app you choose with your route ready.</p>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        <p>
          Built for Indian cities · Estimates only · Not affiliated with Ola, Uber or Rapido
        </p>
      </footer>
    </div>
  );
}
