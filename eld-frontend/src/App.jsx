
import React, { useState } from 'react'; // Import useState hook
import TripForm from './components/TripForm.jsx';
import LogSheetDisplay from './components/LogSheet.jsx';
import './index.css'; // Assuming you might have a basic App.css for styling

function App() {
  // State to hold the ID of the currently active trip
  const [currentTripId, setCurrentTripId] = useState(null);

  /**
   * Callback function passed to TripForm.
   * This function is called by TripForm when a new trip is successfully
   * created and its route/logs are calculated, allowing App to get the tripId.
   * @param {string} newTripId - The ID of the newly created trip from the server.
   */
  const handleTripCreatedAndCalculated = (newTripId) => {
    setCurrentTripId(newTripId); // Update App's state with the dynamic tripId
    console.log("App received new trip ID:", newTripId);
  };

  return (
    <div className="App" style={{
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
      backgroundColor: '#f0f2f5',
      minHeight: '100vh',
      padding: '20px',
      borderRadius: '8px'
    }}>
      <header className="App-header" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5em', color: '#333' }}>ELD App</h1>
      </header>
      <main style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '30px',
        maxWidth: '1000px', /* Increased width for main content */
        width: '95%', /* Added for responsiveness */
        margin: '0 auto' /* Centered */
      }}>
        {/*
          Pass the callback function to TripForm.
          TripForm will call this function with the dynamic trip ID
          once its API calls are complete.
        */}
        <TripForm onTripCreatedAndCalculated={handleTripCreatedAndCalculated} />

        {/*
          Conditionally render LogSheetDisplay.
          It will only show up once currentTripId has a value (i.e., a trip has been created).
          The 'tripId' prop is now dynamically passed from App's state.
        */}
        {currentTripId ? (
          <LogSheetDisplay tripId={currentTripId} />
        ) : (
          <p style={{
            fontSize: '1.1em',
            color: '#555',
            marginTop: '20px'
          }}>
            Enter trip details above to calculate a new trip and view its ELD log.
          </p>
        )}
      </main>
    </div>
  );
}

export default App;