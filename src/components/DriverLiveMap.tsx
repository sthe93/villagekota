import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

interface DriverLiveMapProps {
  driverLat: number | null;
  driverLng: number | null;
  destinationLabel: string;
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`;

export default function DriverLiveMap({
  driverLat,
  driverLng,
  destinationLabel,
}: DriverLiveMapProps) {
  const hasDriverLocation = driverLat != null && driverLng != null;

  const center = useMemo(() => {
    if (!hasDriverLocation) {
      return { longitude: 28.0473, latitude: -26.2041, zoom: 10 };
    }

    return {
      longitude: driverLng!,
      latitude: driverLat!,
      zoom: 13,
    };
  }, [driverLat, driverLng, hasDriverLocation]);

  const [viewState, setViewState] = useState(center);

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <Map
        {...viewState}
        longitude={center.longitude}
        latitude={center.latitude}
        zoom={center.zoom}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={MAP_STYLE}
        reuseMaps
        style={{ width: "100%", height: 320 }}
      >
        <NavigationControl position="top-right" />

        {hasDriverLocation && (
          <Marker longitude={driverLng!} latitude={driverLat!} anchor="bottom">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium shadow">
              Driver
            </div>
          </Marker>
        )}
      </Map>

      <div className="p-3 bg-card text-sm">
        <p className="text-foreground font-medium">
          {hasDriverLocation ? "Driver location updating live" : "Waiting for driver location"}
        </p>
        <p className="text-muted-foreground">{destinationLabel}</p>
      </div>
    </div>
  );
}