import { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapTilerStyleUrl } from "@/lib/maps";

interface DriverLiveMapProps {
  driverLat: number | null;
  driverLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  destinationLabel: string;
  routeGeoJson?: GeoJSON.Feature<GeoJSON.LineString> | null;
}

const MAP_STYLE = getMapTilerStyleUrl();

export default function DriverLiveMap({
  driverLat,
  driverLng,
  destinationLat,
  destinationLng,
  destinationLabel,
  routeGeoJson,
}: DriverLiveMapProps) {
  const hasDriverLocation = driverLat != null && driverLng != null;
  const hasDestination = destinationLat != null && destinationLng != null;

  const center = useMemo(() => {
    if (hasDriverLocation && hasDestination) {
      return {
        longitude: (driverLng! + destinationLng!) / 2,
        latitude: (driverLat! + destinationLat!) / 2,
        zoom: 10.8,
      };
    }

    if (hasDriverLocation) {
      return { longitude: driverLng!, latitude: driverLat!, zoom: 13 };
    }

    if (hasDestination) {
      return { longitude: destinationLng!, latitude: destinationLat!, zoom: 13 };
    }

    return { longitude: 28.0473, latitude: -26.2041, zoom: 10 };
  }, [driverLat, driverLng, destinationLat, destinationLng, hasDriverLocation, hasDestination]);

  const [viewState, setViewState] = useState(center);

  useEffect(() => {
    setViewState(center);
  }, [center]);

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={MAP_STYLE}
        reuseMaps
        style={{ width: "100%", height: 360 }}
      >
        <NavigationControl position="top-right" />

        {routeGeoJson && (
          <Source id="route-source" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#ea580c",
                "line-width": 6,
                "line-opacity": 0.95,
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </Source>
        )}

        {hasDriverLocation && (
          <Marker longitude={driverLng!} latitude={driverLat!} anchor="bottom">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium shadow">
              Driver
            </div>
          </Marker>
        )}

        {hasDestination && (
          <Marker longitude={destinationLng!} latitude={destinationLat!} anchor="bottom">
            <div className="bg-success text-success-foreground px-3 py-1 rounded-full text-xs font-medium shadow">
              Destination
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
