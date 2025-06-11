


import React, { useState } from 'react';
import axios from 'axios';
import MapDisplay from './MapDisplay.jsx'; // Import the new MapDisplay component

function TripForm() {
  const [currentLocation, setCurrentLocation] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [currentCycleUsedHrs, setCurrentCycleUsedHrs] = useState('');
  const [message, setMessage] = useState('');
  const [tripResults, setTripResults] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('Calculating trip...');
    setTripResults(null);

    const tripData = {
      current_location: currentLocation,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      current_cycle_used_hrs: parseFloat(currentCycleUsedHrs),
    };

    try {
      const createTripResponse = await axios.post(
        'http://127.0.0.1:8000/api/trips/',
        tripData
      );

      console.log('Trip created successfully:', createTripResponse.data);
      setMessage(`Trip ID ${createTripResponse.data.id} created successfully! Now calculating route and logs...`);

      const tripId = createTripResponse.data.id;

      const calculateLogsResponse = await axios.post(
        `http://127.0.0.1:8000/api/trips/${tripId}/calculate_route_and_logs/`
      );

      console.log('Route and ELD logs calculated:', calculateLogsResponse.data);
      setMessage(`Trip ID ${tripId} created, route calculated, and ELD logs generated successfully!`);

      setTripResults(calculateLogsResponse.data);

      setCurrentLocation('');
      setPickupLocation('');
      setDropoffLocation('');
      setCurrentCycleUsedHrs('');

    } catch (error) {
      console.error('Error submitting trip or calculating logs:', error.response ? error.response.data : error.message);
      setMessage(`Error: ${error.response ? (error.response.data.detail || JSON.stringify(error.response.data)) : error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Enter Trip Details</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label htmlFor="currentLocation" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Current Location:</label>
          <input
            type="text"
            id="currentLocation"
            value={currentLocation}
            onChange={(e) => setCurrentLocation(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label htmlFor="pickupLocation" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Pickup Location:</label>
          <input
            type="text"
            id="pickupLocation"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label htmlFor="dropoffLocation" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dropoff Location:</label>
          <input
            type="text"
            id="dropoffLocation"
            value={dropoffLocation}
            onChange={(e) => setDropoffLocation(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label htmlFor="currentCycleUsedHrs" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Current Cycle Used (Hrs):</label>
          <input
            type="number"
            id="currentCycleUsedHrs"
            value={currentCycleUsedHrs}
            onChange={(e) => setCurrentCycleUsedHrs(e.target.value)}
            required
            step="0.1"
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
          Calculate Trip
        </button>
        {message && <p style={{ marginTop: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>{message}</p>}
      </form>

      {tripResults && (
        <div style={{ marginTop: '30px', textAlign: 'left', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <h3>Trip Calculation Results:</h3>

          {/* Render MapDisplay component */}
          <h4>Route Map:</h4>
          <MapDisplay routeInfo={tripResults.route_info} />

          <h4>Route Information:</h4>
          <p><strong>Total Distance:</strong> {tripResults.route_info.total_distance_km} km</p>
          <p><strong>Total Driving Duration:</strong> {tripResults.route_info.total_duration_hours_driving} hours</p>
          <p><strong>Estimated Stops & Rests:</strong></p>
          <ul>
            {tripResults.route_info.estimated_stops_and_rests.map((stop, index) => (
              <li key={index}>
                {stop.type.toUpperCase()} at {stop.location} (Duration: {stop.duration_hrs} hrs)
              </li>
            ))}
          </ul>
          <h4>ELD Log Entries:</h4>
          {tripResults.trip_details.log_entries.length > 0 ? (
            <ul>
              {tripResults.trip_details.log_entries.map((log) => (
                <li key={log.id}>
                  {log.log_date}: {log.start_time.substring(11, 16)} - {log.end_time.substring(11, 16)} - {log.status_display}
                </li>
              ))}
            </ul>
          ) : (
            <p>No log entries generated for this trip.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default TripForm;