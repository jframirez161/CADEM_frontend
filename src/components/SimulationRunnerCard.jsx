// src/components/SimulationRunnerCard.jsx
import React, { useState, useEffect } from 'react';
import { stateVariableNames as modelVariables } from '../constants/simulationConstants'; // Ensure this path is correct
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Define a list of distinct colors for the lines
const LINE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#A23B72', '#34A853', '#EA4335', '#FBBC05', '#4285F4'];

function SimulationRunnerCard({
  simulationResults, 
  isLoading, // This is the global isLoading from App.jsx, primarily for the App-level modal
  errors, 
  herdComposition
  // simulationParams prop is no longer used here as controls were removed
}) {
  const [selectedPlotVariable, setSelectedPlotVariable] = useState(
    modelVariables.length > 0 ? modelVariables[0] : ''
  );
  // New state for section expansion
  const [isResultsSectionExpanded, setIsResultsSectionExpanded] = useState(true); // Start expanded by default
  
  useEffect(() => {
    // Initialize or update selectedPlotVariable if modelVariables are available and selection is empty
    if (!selectedPlotVariable && modelVariables.length > 0) {
      setSelectedPlotVariable(modelVariables[0]);
    }
  }, [modelVariables, selectedPlotVariable]);

  const formatTick = (value) => {
    if (value === null || typeof value === 'undefined') return ''; // Handle null or undefined
    if (isNaN(value)) return 'N/A'; // Handle NaN, return a displayable string
    
    if (typeof value === 'number') { // Ensure value is a number before calling number methods
        if ((Math.abs(value) < 1e-3 && value !== 0) || Math.abs(value) > 1e5) {
            return value.toExponential(1);
        }
        return value.toFixed(3); // toFixed returns a string, which is fine for display
    }
    return String(value); // Fallback for other types
  };

  const hasAnyResults = simulationResults && 
                        Object.keys(simulationResults).some(groupId => 
                          simulationResults[groupId] && simulationResults[groupId].length > 0
                        );
  
  const globalBatchError = errors && errors._global_batch; // Assuming App.jsx might set this key for batch-wide errors
  const groupSpecificErrors = errors 
                      ? Object.entries(errors).filter(([key, value]) => key !== '_global_batch' && value !== null) 
                      : [];

  const toggleResultsSectionExpansion = () => {
    setIsResultsSectionExpanded(prev => !prev);
  };

  return (
    <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
      <div 
        style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            cursor: 'pointer', 
            paddingBottom: '10px', 
            // Apply border/margin only if the section is expanded or always if you prefer
            borderBottom: isResultsSectionExpanded ? '1px solid #eee' : 'none', 
            marginBottom: isResultsSectionExpanded ?  '15px' : '0'
        }}
        onClick={toggleResultsSectionExpansion}
        role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleResultsSectionExpansion(); }}
        aria-expanded={isResultsSectionExpanded} aria-controls="simulation-results-content"
      >
        <h2>Rumen Model Simulation Results</h2>
        <span style={{ fontSize: '1.5em', transform: isResultsSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }}>
          ▶
        </span>
      </div>

      {isResultsSectionExpanded && (
        <div id="simulation-results-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {/* isLoading prop from App.jsx controls the global modal. 
              This card doesn't need its own separate main loading indicator if App has one.
              However, error messages are specific to simulation outcomes, so they are displayed here.
          */}
          
          {globalBatchError && <p style={{ color: 'red', marginTop: '10px', fontWeight:'bold' }}>Batch Error: {globalBatchError}</p>}
          {groupSpecificErrors.length > 0 && (
              <div style={{color: 'red', marginTop: '10px'}}>
                  <p>Simulation Errors for specific groups:</p>
                  <ul style={{paddingLeft: '20px', listStyleType:'disc'}}>
                      {groupSpecificErrors.map(([groupId, errorMsg]) => {
                          const group = herdComposition.find(g => g.id === groupId);
                          return <li key={groupId}>Group '{group?.name || `ID: ${groupId.substring(0,6)}...`}': {String(errorMsg)}</li>;
                      })}
                  </ul>
              </div>
          )}
          
          {hasAnyResults ? (
            <div style={{ marginTop: '20px' }}>
              <h3>Simulation Results Plot</h3>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="plotVariableSelectCard" style={{ marginRight: '10px' }}>Select variable to plot:</label>
                <select 
                  id="plotVariableSelectCard" 
                  value={selectedPlotVariable} 
                  onChange={(e) => setSelectedPlotVariable(e.target.value)}
                  aria-label="Select variable for simulation plot"
                >
                  {modelVariables.map(varName => (
                    <option key={varName} value={varName}>{varName}</option>
                  ))}
                </select>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart margin={{ top: 5, right: 30, left: 30, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    type="number" 
                    domain={['dataMin', 'dataMax']}
                    allowDuplicatedCategory={false}
                    label={{ value: "Time (hours)", position: "insideBottomRight", dy:10, offset: 0 }}
                  />
                  <YAxis 
                    label={{ value: selectedPlotVariable, angle: -90, position: 'insideLeft', dx: -20}}
                    tickFormatter={formatTick} 
                    allowDataOverflow={false} 
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => {
                      if (value === null || typeof value === 'undefined' || isNaN(value)) return ['N/A', name];
                      return [formatTick(value), name]; 
                    }} 
                  />
                  <Legend verticalAlign="top" height={36}/>
                  {Object.entries(simulationResults).map(([groupId, groupResultData], index) => {
                    if (!groupResultData || groupResultData.length === 0) {
                        return null;
                    }
                    
                    const validData = groupResultData.filter(point => 
                      point && typeof point[selectedPlotVariable] === 'number' && !isNaN(point[selectedPlotVariable])
                    );

                    const group = herdComposition.find(g => g.id === groupId);
                    const groupName = group ? group.name : `Group ${groupId.substring(0, 6)}`;

                    if (validData.length === 0) {
                      if (groupResultData.length > 0) { 
                        console.warn(`Plotting: Group ${groupId} (${groupName}) has no valid (non-NaN, numeric) data points for selected variable: ${selectedPlotVariable}.`);
                      }
                      return null; 
                    }
                    
                    return (
                      <Line 
                        key={groupId}
                        type="monotone"
                        dataKey={selectedPlotVariable}
                        data={validData} 
                        name={groupName} 
                        stroke={LINE_COLORS[index % LINE_COLORS.length]}
                        dot={false}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false} 
                        connectNulls={true} 
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>

              {Object.values(simulationResults).find(data => data && data.length > 0) && (
                <>

                </>
              )}
            </div>
          ) : (
            // This message shows if the section is expanded, not loading (App's modal handles global loading),
            // no batch/group errors, but still no results.
            !isLoading && !globalBatchError && groupSpecificErrors.length === 0 && (
              <p style={{marginTop: '20px'}}>
                No simulation results to display. 
                Configure herd composition and diets, then click the "Run All Defined Simulations" button above the results section.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
export default SimulationRunnerCard;