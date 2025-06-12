

import React, { useState } from 'react';
import axios from 'axios';
import MapDisplay from './MapDisplay.jsx'; // Import the new MapDisplay component

/**
 * TripForm component for entering trip details and initiating trip calculation.
 * @param {object} props - The component props.
 * @param {function(string): void} props.onTripCreatedAndCalculated - Callback function
 * to be called after successful trip creation and log calculation, passing only the
 * new trip ID to the parent component (e.g., App.jsx).
 */
function TripForm({ onTripCreatedAndCalculated }) {
  const [currentLocation, setCurrentLocation] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [currentCycleUsedHrs, setCurrentCycleUsedHrs] = useState('');
  const [message, setMessage] = useState('');
  const [tripResults, setTripResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // State for loading indicator
  const [buttonHovered, setButtonHovered] = useState(false); // State for button hover effect

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission behavior
    setMessage('Calculating trip...');
    setTripResults(null); // Clear previous results
    setIsLoading(true); // Start loading

    const tripData = {
      current_location: currentLocation,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      current_cycle_used_hrs: parseFloat(currentCycleUsedHrs), // Ensure numerical type
    };

    try {
      // Step 1: Create the trip by sending data to the backend API
      const createTripResponse = await axios.post(
        'http://127.0.0.1:8000/api/trips/', // Ensure this URL matches your backend
        tripData
      );

      console.log('Trip created successfully:', createTripResponse.data);
      setMessage(`Trip ID ${createTripResponse.data.id} created successfully! Now calculating route and logs...`);

      // Extract the dynamically generated tripId from the first response
      const tripId = createTripResponse.data.id;

      // Step 2: Calculate route and ELD logs using the obtained tripId
      const calculateLogsResponse = await axios.post(
        `http://127.0.0.1:8000/api/trips/${tripId}/calculate_route_and_logs/` // Ensure this URL matches your backend
      );

      console.log('Route and ELD logs calculated:', calculateLogsResponse.data);
      setMessage(`Trip ID ${tripId} created, route calculated, and ELD logs generated successfully!`);

      // Set trip results state for display within this component (if applicable)
      setTripResults(calculateLogsResponse.data);

      // Call the callback function passed from the parent (App.jsx).
      // This sends the dynamic tripId up to the parent App component.
      if (onTripCreatedAndCalculated) {
        onTripCreatedAndCalculated(tripId);
      }

      // Clear form fields after successful submission
      setCurrentLocation('');
      setPickupLocation('');
      setDropoffLocation('');
      setCurrentCycleUsedHrs('');

    } catch (error) {
      // Improved error handling to display relevant messages
      let errorMessage = 'An unexpected error occurred.';
      if (axios.isAxiosError(error)) { // Check if it's an Axios error
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Server Error Data:', error.response.data);
          console.error('Server Error Status:', error.response.status);
          console.error('Server Error Headers:', error.response.headers);

          if (typeof error.response.data === 'string' && error.response.data.startsWith('<!doctype')) {
              errorMessage = 'Received HTML response instead of JSON. Check backend URL or server logs.';
          } else if (error.response.data && error.response.data.detail) {
              errorMessage = `Error: ${error.response.data.detail}`;
          } else {
              errorMessage = `Server Error: ${JSON.stringify(error.response.data)}`;
          }
        } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received:', error.request);
          errorMessage = 'No response from server. Is the backend running?';
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error setting up request:', error.message);
          errorMessage = `Request Error: ${error.message}`;
        }
      } else {
        // Any other non-Axios error
        console.error('Error:', error);
        errorMessage = `An unknown error occurred: ${error.message}`;
      }
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false); // Stop loading regardless of success or error
    }
  };

  return (
    <div style={{
      maxWidth: '1000px', /* Increased width */
      width: '95%', /* Added for responsiveness */
      margin: '0 auto',
      padding: '24px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h2 style={{
        fontSize: '2em',
        fontWeight: 'bold',
        color: '#333',
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        Enter Trip Details
      </h2>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Current Location */}
        <div>
          <label htmlFor="currentLocation" style={{
            display: 'block',
            color: '#4a5568',
            fontSize: '0.875em',
            fontWeight: '600',
            marginBottom: '8px',
            textAlign: 'left'
          }}>
            Current Location:
          </label>
          <input
            type="text"
            id="currentLocation"
            value={currentLocation}
            onChange={(e) => setCurrentLocation(e.target.value)}
            required
            disabled={isLoading}
            placeholder="e.g., New York, NY"
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              transition: 'all 0.2s ease-in-out',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>

        {/* Pickup Location */}
        <div>
          <label htmlFor="pickupLocation" style={{
            display: 'block',
            color: '#4a5568',
            fontSize: '0.875em',
            fontWeight: '600',
            marginBottom: '8px',
            textAlign: 'left'
          }}>
            Pickup Location:
          </label>
          <input
            type="text"
            id="pickupLocation"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            required
            disabled={isLoading}
            placeholder="e.g., Chicago, IL"
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              transition: 'all 0.2s ease-in-out',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>

        {/* Dropoff Location */}
        <div>
          <label htmlFor="dropoffLocation" style={{
            display: 'block',
            color: '#4a5568',
            fontSize: '0.875em',
            fontWeight: '600',
            marginBottom: '8px',
            textAlign: 'left'
          }}>
            Dropoff Location:
          </label>
          <input
            type="text"
            id="dropoffLocation"
            value={dropoffLocation}
            onChange={(e) => setDropoffLocation(e.target.value)}
            required
            disabled={isLoading}
            placeholder="e.g., Los Angeles, CA"
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              transition: 'all 0.2s ease-in-out',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>

        {/* Current Cycle Used Hours */}
        <div>
          <label htmlFor="currentCycleUsedHrs" style={{
            display: 'block',
            color: '#4a5568',
            fontSize: '0.875em',
            fontWeight: '600',
            marginBottom: '8px',
            textAlign: 'left'
          }}>
            Current Cycle Used (Hrs):
          </label>
          <input
            type="number"
            id="currentCycleUsedHrs"
            value={currentCycleUsedHrs}
            onChange={(e) => setCurrentCycleUsedHrs(e.target.value)}
            required
            step="0.1"
            disabled={isLoading}
            placeholder="e.g., 5.5"
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              transition: 'all 0.2s ease-in-out',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading} // Disable button when loading
          style={{
            width: '100%',
            backgroundColor: buttonHovered ? '#0056b3' : '#007bff',
            color: '#fff',
            fontWeight: 'bold',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1.0625em',
            transition: 'all 0.3s ease-in-out',
            opacity: isLoading ? '0.5' : '1',
            boxShadow: buttonHovered ? '0 6px 12px rgba(0,0,0,0.15)' : '0 4px 8px rgba(0,0,0,0.1)',
            transform: buttonHovered ? 'scale(1.02)' : 'scale(1)',
            outline: 'none',
          }}
          onMouseEnter={() => setButtonHovered(true)}
          onMouseLeave={() => setButtonHovered(false)}
        >
          {isLoading ? 'Calculating...' : 'Calculate Trip'}
        </button>

        {/* Message Display */}
        {message && (
          <p style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '0.875em',
            border: `1px solid ${message.startsWith('Error:') ? '#fca5a5' : '#93c5fd'}`,
            backgroundColor: message.startsWith('Error:') ? '#fee2e2' : '#dbeafe',
            color: message.startsWith('Error:') ? '#b91c1c' : '#1e40af',
            textAlign: 'center'
          }}>
            {message}
          </p>
        )}
      </form>

      {/* Trip Calculation Results Display */}
      {tripResults && (
        <div style={{
          marginTop: '40px',
          paddingTop: '24px',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'left'
        }}>
          <h3 style={{
            fontSize: '1.5em',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            Trip Calculation Results
          </h3>

          {/* Route Map */}
          <h4 style={{
            fontSize: '1.25em',
            fontWeight: '600',
            color: '#4a5568',
            marginTop: '32px',
            marginBottom: '16px'
          }}>Route Map:</h4>
          <MapDisplay routeInfo={tripResults.route_info} /> {/* Make sure MapDisplay can handle this prop */}

          {/* Route Information */}
          <h4 style={{
            fontSize: '1.25em',
            fontWeight: '600',
            color: '#4a5568',
            marginTop: '32px',
            marginBottom: '16px'
          }}>Route Information:</h4>
          <p style={{ marginBottom: '8px', color: '#4a5568' }}>
            <strong style={{ color: '#2563eb' }}>Total Distance:</strong> {tripResults.route_info.total_distance_km} km
          </p>
          <p style={{ marginBottom: '8px', color: '#4a5568' }}>
            <strong style={{ color: '#2563eb' }}>Total Driving Duration:</strong> {tripResults.route_info.total_duration_hours_driving} hours
          </p>
          <p style={{ marginBottom: '16px', color: '#4a5568' }}>
            <strong style={{ color: '#2563eb' }}>Estimated Stops & Rests:</strong>
          </p>
          <ul style={{
            listStyleType: 'disc',
            listStylePosition: 'inside',
            paddingLeft: '0',
            marginBottom: '0'
          }}>
            {tripResults.route_info.estimated_stops_and_rests && tripResults.route_info.estimated_stops_and_rests.map((stop, index) => (
              <li key={index} style={{
                backgroundColor: '#f8f8f8',
                padding: '8px',
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                border: '1px solid #e0e0e0',
                marginBottom: '4px',
                color: '#4a5568'
              }}>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>{stop.type.toUpperCase()}</span> at {stop.location} (Duration: {stop.duration_hrs} hrs)
              </li>
            ))}
          </ul>

          {/* ELD Log Entries */}
          <h4 style={{
            fontSize: '1.25em',
            fontWeight: '600',
            color: '#4a5568',
            marginTop: '32px',
            marginBottom: '16px'
          }}>ELD Log Entries:</h4>
          {tripResults.trip_details.log_entries && tripResults.trip_details.log_entries.length > 0 ? (
            <div style={{}}>
              {tripResults.trip_details.log_entries.map((log) => (
                <div key={log.id} style={{
                  backgroundColor: '#f8f8f8',
                  padding: '12px',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: '1px solid #e0e0e0',
                  marginBottom: '12px'
                }}>
                  <p style={{ color: '#333' }}>
                    <strong style={{ color: '#2563eb' }}>{log.log_date}</strong>: {log.start_time.substring(11, 16)} - {log.end_time.substring(11, 16)} -{' '}
                    <span style={{
                      fontWeight: '600',
                      color:
                        log.status_display === 'Driving' ? '#10b981' :
                        log.status_display === 'On Duty' ? '#f59e0b' :
                        '#8b5cf6'
                    }}>
                      {log.status_display}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#4a5568' }}>No log entries generated for this trip.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default TripForm;