// src/components/MethaneProductionBarChart.jsx
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const BAR_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#A23B72'];
const MOLAR_MASS_CH4 = 16.042; // g/mol for CH4

const formatTick = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    if (isNaN(value)) return 'N/A';
    if (typeof value === 'number') {
        if ((Math.abs(value) < 0.1 && value !== 0) || Math.abs(value) > 10000) { // Adjusted for typical gram values
            return value.toExponential(1);
        }
        return value.toFixed(1); // Show 1 decimal place for grams
    }
    return String(value);
};

function MethaneProductionBarChart({ simulationResults, herdComposition, isLoading }) {
  const chartData = useMemo(() => {
    if (!simulationResults || Object.keys(simulationResults).length === 0 || !herdComposition || herdComposition.length === 0) {
      return [];
    }

    return Object.entries(simulationResults)
      .map(([groupId, resultsArray]) => {
        if (!resultsArray || resultsArray.length === 0) {
          return null;
        }
        const lastResultPoint = resultsArray[resultsArray.length - 1];
        const qmtValueInMoles = lastResultPoint?.QMt;

        if (typeof qmtValueInMoles !== 'number' || isNaN(qmtValueInMoles)) {
          console.warn(`MethaneChart: Invalid QMt (moles) value for group ${groupId}`, qmtValueInMoles);
          return null;
        }

        const qmtValueInGrams = qmtValueInMoles * MOLAR_MASS_CH4; // Convert moles to grams

        const groupInfo = herdComposition.find(g => g.id === groupId);
        const groupName = groupInfo ? groupInfo.name : `Group ${groupId.substring(0, 6)}`;
        
        return {
          name: groupName,
          QMt_grams: qmtValueInGrams, // Store the value in grams
        };
      })
      .filter(item => item !== null && item.QMt_grams !== undefined);
  }, [simulationResults, herdComposition]);

  if (isLoading) {
    return (
      <div className="card" style={{ marginTop: '20px', padding: '20px', textAlign: 'center' }}>
        <p>Loading simulation data for methane chart...</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
        <h4>Methane Production (Final - Grams)</h4>
        <p>No simulation data available to display methane production.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
      <h4>Methane Production (Final - Grams per Group)</h4>
      <p style={{fontSize: '0.9em', color: '#555', marginBottom: '20px'}}>
        This chart displays the final amount of Methane (CH₄) in grams at the end of the simulation period for each animal group.
      </p>
      <ResponsiveContainer width="100%" height={300 + chartData.length * 25}> {/* Increased height per bar slightly */}
        <BarChart
          data={chartData}
          layout="vertical" 
          margin={{
            top: 5, right: 40, left: 120, bottom: 20, // Adjusted margins for labels
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            tickFormatter={formatTick} 
            label={{ value: "Methane Production (grams)", position: 'insideBottom', offset: 0, dy: 10 }} 
            domain={[0, 'auto']} // Start X-axis at 0 for production amounts
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={130} 
            interval={0} 
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value, name, props) => {
                // value is QMt_grams, name is "QMt_grams" (the dataKey)
                // props.payload.name is the group name
                if (value === null || typeof value === 'undefined' || isNaN(value)) return ['N/A', props.payload.name];
                return [formatTick(value) + " g", props.payload.name]; // Display with "g" unit
            }}
            cursor={{fill: 'rgba(204,204,204,0.2)'}}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }} 
            payload={[{ value: 'Final Methane (grams)', type: 'square', id: 'ID01', color: BAR_COLORS[0] }]}
          />
          <Bar dataKey="QMt_grams" name="Final Methane (g)"> {/* Changed dataKey */}
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MethaneProductionBarChart;