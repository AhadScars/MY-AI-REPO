import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../lib/geo';
import type { Place } from '../lib/types';

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  icon: 'pickup' | 'drop';
}

export function LocationInput({ label, placeholder, value, onChange, icon }: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function handleInput(text: string) {
    setQuery(text);
    setError(null);
    if (value) onChange(null);

    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const places = await searchPlaces(text);
        setResults(places);
        setOpen(true);
        if (places.length === 0) setError('No places found in India');
      } catch {
        setError('Search unavailable — try again');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function select(place: Place) {
    setQuery(place.name);
    onChange(place);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    setQuery('');
    onChange(null);
    setResults([]);
    setError(null);
  }

  return (
    <div className={`loc-input loc-${icon}`} ref={boxRef}>
      <label className="loc-label">{label}</label>
      <div className="loc-field">
        <span className={`loc-dot loc-dot-${icon}`} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="loc-spinner" aria-label="Searching" />}
        {query && !loading && (
          <button type="button" className="loc-clear" onClick={clear} aria-label="Clear">
            ×
          </button>
        )}
      </div>
      {error && !open && <p className="loc-error">{error}</p>}
      {open && results.length > 0 && (
        <ul className="loc-dropdown" role="listbox">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => select(p)}>
                <strong>{p.name}</strong>
                <span>{p.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
