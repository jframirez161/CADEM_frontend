// src/components/RunSimulationsButton.jsx
import React from 'react';

function RunSimulationsButton({ onRunAllSimulations, isLoading }) {
  if (!onRunAllSimulations) {
    return null; // Don't render if no handler is provided
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
      <button 
        onClick={onRunAllSimulations} 
        disabled={isLoading} 
        style={{ 
          padding: '12px 25px', 
          fontSize: '1.1em', 
          fontWeight: 'bold',
          backgroundColor: isLoading ? '#ccc' : '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px', 
          cursor: isLoading ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'background-color 0.2s ease',
        }}
        onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#0056b3'; }}
        onMouseOut={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#007bff'; }}
      >
        {isLoading ? 'Simulations Running...' : 'Run All Defined Simulations'}
      </button>
    </div>
  );
}

export default RunSimulationsButton;