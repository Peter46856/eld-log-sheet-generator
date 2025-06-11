// MapDisplay.jsx
import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import L from 'leaflet'; // Import Leaflet object for custom icon

// Fix for default marker icon issue with Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function MapDisplay({ routeInfo }) {
    // Ensure routeInfo and its properties exist before accessing
    // Corrected: Checking for path_coordinates instead of polyline_points
    if (!routeInfo || !routeInfo.path_coordinates || !routeInfo.estimated_stops_and_rests) {
        return <p>No map data available.</p>;
    }

    // Convert path_coordinates from [longitude, latitude] (ORS format)
    // to [latitude, longitude] (Leaflet Polyline format)
    const polylinePositions = routeInfo.path_coordinates.map(point => [point[1], point[0]]);

    // Determine map center and zoom based on route (simple approach for now)
    // Default center set to Nairobi, Kenya
    const defaultCenter = [-1.286389, 36.817223];
    let mapCenter = defaultCenter;
    let zoom = 5; // Default zoom

    if (polylinePositions.length > 0) {
        // Calculate approximate center of the route for initial map view
        const sumLat = polylinePositions.reduce((sum, p) => sum + p[0], 0);
        const sumLon = polylinePositions.reduce((sum, p) => sum + p[1], 0);
        mapCenter = [sumLat / polylinePositions.length, sumLon / polylinePositions.length];
        zoom = 8; // Adjust zoom for better view of a route
    } else if (routeInfo.estimated_stops_and_rests.length > 0) {
        // If no polyline but stops, use the first stop's coordinates as center
        // Ensure the stop object has latitude and longitude
        const firstStop = routeInfo.estimated_stops_and_rests[0];
        if (firstStop.latitude && firstStop.longitude) {
            mapCenter = [firstStop.latitude, firstStop.longitude];
            zoom = 8;
        }
    }

    return (
        <div style={{ height: '500px', width: '100%', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Draw the route polyline */}
                {polylinePositions.length > 0 && (
                    <Polyline positions={polylinePositions} color="blue" weight={5} />
                )}

                {/* Add markers for stops and rests */}
                {/* Corrected: Only render marker if latitude and longitude exist for the stop */}
                {routeInfo.estimated_stops_and_rests.map((stop, index) => (
                    stop.latitude && stop.longitude && (
                        <Marker
                            key={index}
                            position={[stop.latitude, stop.longitude]}
                            title={`${stop.type}: ${stop.location} (Duration: ${stop.duration_hrs} hrs)`}
                        />
                    )
                ))}
            </MapContainer>
        </div>
    );
}

export default MapDisplay;