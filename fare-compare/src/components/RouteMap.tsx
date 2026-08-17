import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng, Place, RouteInfo } from '../lib/types';
import 'leaflet/dist/leaflet.css';

const pickupIcon = L.divIcon({
  className: 'map-pin',
  html: '<div class="map-pin-inner map-pin-pickup"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropIcon = L.divIcon({
  className: 'map-pin',
  html: '<div class="map-pin-inner map-pin-drop"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

interface Props {
  pickup: Place | null;
  drop: Place | null;
  route: RouteInfo | null;
}

export function RouteMap({ pickup, drop, route }: Props) {
  const center: [number, number] = pickup
    ? [pickup.lat, pickup.lng]
    : [20.5937, 78.9629]; // India center
  const zoom = pickup && drop ? 12 : pickup ? 13 : 5;

  const linePoints: [number, number][] =
    route?.geometry.map((g) => [g.lat, g.lng] as [number, number]) ??
    (pickup && drop ? [[pickup.lat, pickup.lng], [drop.lat, drop.lng]] : []);

  const fitPoints: LatLng[] = [];
  if (pickup) fitPoints.push(pickup);
  if (drop) fitPoints.push(drop);
  if (route?.geometry.length) fitPoints.push(...route.geometry);

  return (
    <div className="map-wrap">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="route-map"
        key={`${pickup?.id ?? 'a'}-${drop?.id ?? 'b'}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {drop && <Marker position={[drop.lat, drop.lng]} icon={dropIcon} />}
        {linePoints.length >= 2 && (
          <Polyline positions={linePoints} pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.85 }} />
        )}
        {fitPoints.length >= 2 && <FitBounds points={fitPoints} />}
      </MapContainer>
    </div>
  );
}
