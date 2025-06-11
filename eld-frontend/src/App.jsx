import React from 'react';
import TripForm from './components/TripForm.jsx';
import LogSheetDisplay from './components/LogSheet.jsx';
import './index.css'; // Assuming you might have a basic App.css for styling

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>ELD App</h1>
      </header>
      <main>
        <TripForm />
        <LogSheetDisplay tripId={1} />
      </main>
    </div>
  );
}

export default App;