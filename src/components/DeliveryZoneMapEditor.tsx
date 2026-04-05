import MapView, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

type DeliveryZoneMapEditorProps = {
  viewState: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  onMove: (viewState: { latitude: number; longitude: number; zoom: number }) => void;
  onMapClick: (coords: { lat: number; lng: number }) => void;
  mapStyle: string;
  polygonFeature: GeoJSON.Feature<GeoJSON.Polygon> | null;
  polygonCoordinates: Array<[number, number]>;
};

export default function DeliveryZoneMapEditor({
  viewState,
  onMove,
  onMapClick,
  mapStyle,
  polygonFeature,
  polygonCoordinates,
}: DeliveryZoneMapEditorProps) {
  return (
    <MapView
      {...viewState}
      onMove={(evt) => onMove(evt.viewState)}
      onClick={(evt) => {
        onMapClick({
          lat: Number(evt.lngLat.lat.toFixed(6)),
          lng: Number(evt.lngLat.lng.toFixed(6)),
        });
      }}
      mapStyle={mapStyle}
      reuseMaps
      style={{ width: "100%", height: 320 }}
    >
      <NavigationControl position="top-right" />

      {polygonFeature && (
        <Source id="delivery-zone-polygon" type="geojson" data={polygonFeature}>
          <Layer
            id="delivery-zone-fill"
            type="fill"
            paint={{
              "fill-color": "#ef4444",
              "fill-opacity": 0.25,
            }}
          />
          <Layer
            id="delivery-zone-line"
            type="line"
            paint={{
              "line-color": "#b91c1c",
              "line-width": 2.5,
            }}
          />
        </Source>
      )}

      {polygonCoordinates.map(([lat, lng], index) => (
        <Marker key={`${lat}-${lng}-${index}`} longitude={lng} latitude={lat} anchor="center">
          <div className="h-3 w-3 rounded-full border border-white bg-red-600 shadow" />
        </Marker>
      ))}
    </MapView>
  );
}
