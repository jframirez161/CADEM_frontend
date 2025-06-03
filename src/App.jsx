// src/App.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Removed useRef as it's less critical now
import './style.css';
import HerdCompositionCard from './components/HerdCompositionCard.jsx';
import { AnimalDietsCard } from './components/AnimalDietsCard.jsx';
import SimulationRunnerCard from './components/SimulationRunnerCard.jsx';
import RunSimulationsButton from './components/RunSimulationsButton.jsx'; 
import MethaneProductionBarChart from './components/MethaneProductionBarChart.jsx';

// getDietSignature can be removed if not used elsewhere for non-simulation logic,
// as simulation triggering is now manual. Keeping it for now if useful for other comparisons.
const getDietSignature = (diet) => {
  if (!diet) return 'no_diet_loaded';
  const ingredients = Array.isArray(diet.customIngredients) ? diet.customIngredients : [];
  const ingredientsSignature = ingredients
    .map(ing => {
      const overrideSig = ing.overriddenNutrients && Object.keys(ing.overriddenNutrients).length > 0
        ? `_overrides(${Object.entries(ing.overriddenNutrients).map(([k,v]) => `${k}:${v}`).sort().join(';')})`
        : '';
      return `${ing.name}:${ing.percentage || 0}${overrideSig}`;
    })
    .sort()
    .join(',');
  return `${diet.selectedCDP || 'NoCDP'}|${ingredientsSignature}`;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
//const SIMULATE_API_ENDPOINT = `${API_BASE_URL}/api/simulate`;
const SIMULATE_API_ENDPOINT = 'https://cadem.onrender.com/api/simulate';

function LoadingModal({ isLoading, message = "Processing simulations..." }) {
  if (!isLoading) return null;
  const modalStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
  const contentStyle = { backgroundColor: 'white', padding: '30px 40px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', textAlign: 'center', color: '#333' };
  const spinnerStyle = { border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 20px auto' };
  return (<div style={modalStyle}><div style={contentStyle}><div style={spinnerStyle}></div><p>{message}</p></div></div>);
}

function App() {
  const [herdComposition, setHerdComposition] = useState([]);
  const [animalDiets, setAnimalDiets] = useState({});
  const [activeDietTabId, setActiveDietTabId] = useState('');
  const [allFeedIngredientDetails, setAllFeedIngredientDetails] = useState([]);
  
  const [simulationResults, setSimulationResults] = useState({});
  const [isSimulating, setIsSimulating] = useState(false); 
  const [simulationErrors, setSimulationErrors] = useState({});
  const [loadingModalMessage, setLoadingModalMessage] = useState("Simulations in progress...");
  
  const [simulationParamsForAPI, setSimulationParamsForAPI] = useState({
    hours: 24,
    points_per_hour: 1000 
  });

  const handleHerdUpdate = (updatedHerdGroupsArray) => {
    setHerdComposition(updatedHerdGroupsArray);
    setAnimalDiets(prevDiets => {
      const newDiets = {};
      let newActiveTab = activeDietTabId;
      let activeTabStillExists = false;
      updatedHerdGroupsArray.forEach(group => {
        newDiets[group.id] = prevDiets[group.id] || { selectedCDP: '', customIngredients: [] };
        if (group.id === activeDietTabId) activeTabStillExists = true;
      });
      if (!activeTabStillExists && updatedHerdGroupsArray.length > 0) newActiveTab = updatedHerdGroupsArray[0].id;
      else if (updatedHerdGroupsArray.length === 0) newActiveTab = '';
      if (newActiveTab !== activeDietTabId) setActiveDietTabId(newActiveTab);
      return newDiets;
    });
  };

  const handleDietsUpdate = (allUpdatedDiets, currentActiveGroupId) => {
    setAnimalDiets(allUpdatedDiets);
    setActiveDietTabId(currentActiveGroupId);
    // Any change here now just updates the state; simulation is manually triggered.
  };
  
  const dynamicTabsConfig = useMemo(() => {
    const globalCDPOptions = [ { value: "DRY JERSEY", label: "DRY JERSEY" }, { value: "MILKING HOLSTEIN", label: "MILKING HOLSTEIN" }, { value: "MILKING JERSEY", label: "MILKING JERSEY" }, { value: "DRY HOLSTEIN", label: "DRY HOLSTEIN" }, ];
    const sortedGlobalCDPOptions = [...globalCDPOptions].sort((a, b) => a.label.localeCompare(b.label) );
    return herdComposition.map(group => ({ id: group.id, label: group.name, cdpOptions: sortedGlobalCDPOptions, animalType: group.animalType }));
  }, [herdComposition]);

  useEffect(() => {
    if (!activeDietTabId && dynamicTabsConfig.length > 0) setActiveDietTabId(dynamicTabsConfig[0].id);
  }, [dynamicTabsConfig, activeDietTabId]);

  const prepareAndRunSimulationForGroup = useCallback(async (groupId, groupData, dietData, currentApiSimParams, reasonSuffix = "") => {
    // This function now primarily focuses on a single group's simulation API call
    // and updating its specific results/errors.
    if (!groupData || !dietData || !Array.isArray(dietData.customIngredients)) {
        setSimulationErrors(prev => ({ ...prev, [groupId]: "Internal error preparing simulation data." }));
        return { success: false };
    }
    setSimulationErrors(prev => { const e = {...prev}; delete e[groupId]; return e;}); // Clear previous error

    const dmiFromGroup = parseFloat(groupData.dmi);
    if (isNaN(dmiFromGroup) || dmiFromGroup <= 0) {
      setSimulationErrors(prev => ({ ...prev, [groupId]: `Invalid DMI (${groupData.dmi}).` }));
      setSimulationResults(prev => { const r = {...prev}; if (r[groupId]) delete r[groupId]; return r; });
      return { success: false };
    }

    const dietParamsForAPI = { DMI: dmiFromGroup }; 
    const calculationKeys = ['NDF', 'Starch', 'WSC', 'Acetate', 'Propionate', 'Butyrate', 'Lactate', 'CP', 'Fat', 'Ash'];
    const nutrientKeyMapToModel = { NDF: 'NDF', Starch: 'St', WSC: 'WSC', Acetate: 'Acin', Propionate: 'Prin', Butyrate: 'Buin', Lactate: 'Lain', CP: 'CP', Fat: 'Fat', Ash: 'Ash' };
    const calculatedDietNutrientsPercent = {};
    calculationKeys.forEach(key => calculatedDietNutrientsPercent[key] = 0);

    if (allFeedIngredientDetails.length > 0 && dietData.customIngredients.length > 0) {
      dietData.customIngredients.forEach(dietIng => { const baseIngDetails = allFeedIngredientDetails.find( dbIng => dbIng.IngredientName && dietIng.name && dbIng.IngredientName.toLowerCase() === dietIng.name.toLowerCase() ); if (!baseIngDetails) { console.warn(`Nutrient details for ingredient "${dietIng.name}" not found for group ${groupId}.`); return; } const ingPercentageInDiet = parseFloat(dietIng.percentage) || 0; if (ingPercentageInDiet <= 0) return; calculationKeys.forEach(calcKey => { let nutrientSourceValue = baseIngDetails[calcKey]; if (dietIng.overriddenNutrients && dietIng.overriddenNutrients.hasOwnProperty(calcKey)) { const overrideAttempt = dietIng.overriddenNutrients[calcKey]; if (overrideAttempt !== undefined) nutrientSourceValue = overrideAttempt; } let nutrientValuePercent = 0; if (typeof nutrientSourceValue === 'string' && nutrientSourceValue.trim() !== '') { nutrientValuePercent = parseFloat(String(nutrientSourceValue).replace(',', '.')); } else if (typeof nutrientSourceValue === 'number') { nutrientValuePercent = nutrientSourceValue; } if (isNaN(nutrientValuePercent)) nutrientValuePercent = 0; calculatedDietNutrientsPercent[calcKey] += nutrientValuePercent * (ingPercentageInDiet / 100); }); });
      Object.keys(nutrientKeyMapToModel).forEach(calcKeySource => { const modelParamKey = nutrientKeyMapToModel[calcKeySource]; if (calculatedDietNutrientsPercent[calcKeySource] !== undefined && modelParamKey && modelParamKey !== 'DMI') { dietParamsForAPI[modelParamKey] = calculatedDietNutrientsPercent[calcKeySource] * 10; } else if (modelParamKey && modelParamKey !== 'DMI' && dietParamsForAPI[modelParamKey] === undefined) { dietParamsForAPI[modelParamKey] = 0; } });
    } else {
      calculationKeys.forEach(calcKey => { const modelParamKey = nutrientKeyMapToModel[calcKey]; if(modelParamKey && modelParamKey !== 'DMI' && dietParamsForAPI[modelParamKey] === undefined) { dietParamsForAPI[modelParamKey] = 0;} });
    }

    const requestPayload = { simulation_params: currentApiSimParams, diet_params: dietParamsForAPI };
    const fullReason = `Group ${groupData.name} (${groupId})${reasonSuffix ? ` - ${reasonSuffix}` : ''}`;
    console.log(`App.jsx: ==> Requesting API simulation: ${fullReason}`);
    
    try {
      const response = await fetch(SIMULATE_API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.detail || `API Error: ${response.status}`);
      if (!responseData.success) throw new Error(responseData.error || responseData.detail || "API unsuccess.");
      setSimulationResults(prev => ({ ...prev, [groupId]: responseData.results }));
      return { success: true };
    } catch (err) {
      console.error(`API Sim FAILED for ${fullReason}:`, err);
      setSimulationErrors(prev => ({ ...prev, [groupId]: String(err.message || "API error") }));
      setSimulationResults(prev => { const r = {...prev}; if (r[groupId]) delete r[groupId]; return r; });
      return { success: false };
    }
  }, [allFeedIngredientDetails]);

  const handleRunAllSimulations = useCallback(async () => {
    console.log("App.jsx: 'Run All Simulations' triggered.");
    const eligibleGroupsToSimulate = [];
    // Clear all previous errors before starting a batch
    setSimulationErrors({});
    // Optionally clear previous results or keep them until new ones arrive
    // setSimulationResults({}); 

    herdComposition.forEach(group => {
      const diet = animalDiets[group.id];
      const isEligible = parseFloat(group.dmi) > 0 &&
                         diet &&
                         getDietSignature(diet) !== 'no_diet_loaded' &&
                         getDietSignature(diet) !== 'NoCDP|';
      if (isEligible) {
        eligibleGroupsToSimulate.push({
          groupId: group.id,
          groupData: group,
          dietData: diet
        });
      } else {
        console.log(`Group ${group.name} is not eligible for simulation (DMI: ${group.dmi}, Diet: ${getDietSignature(diet)})`);
        // Clear results for ineligible groups
        setSimulationResults(prev => { const r = {...prev}; delete r[group.id]; return r;});
      }
    });

    if (eligibleGroupsToSimulate.length === 0) {
      console.warn("App.jsx: No eligible groups to simulate.");
      setLoadingModalMessage("No eligible groups found for simulation.");
      // Briefly show message then hide modal
      setTimeout(() => setLoadingModalMessage("Simulations in progress..."), 2000);
      return;
    }

    setIsSimulating(true);
    setLoadingModalMessage(`Starting simulations for ${eligibleGroupsToSimulate.length} group(s)...`);

    const simulationPromises = eligibleGroupsToSimulate.map((job, index) => {
        setLoadingModalMessage(`Simulating for ${job.groupData.name} (${index + 1} of ${eligibleGroupsToSimulate.length})...`);
        return prepareAndRunSimulationForGroup(
            job.groupId, 
            job.groupData, 
            job.dietData, 
            simulationParamsForAPI,
            "Manual Run All" 
        );
    });

    try {
        await Promise.all(simulationPromises); // Run all in parallel
        console.log("App.jsx: All queued simulations in 'Run All' batch have attempted completion.");
        setLoadingModalMessage("All simulations processed!");
    } catch (batchError) {
        // This catch for Promise.all might not be hit if individual errors are handled in prepareAndRun...
        console.error("App.jsx: Error during batch simulation execution (Promise.all):", batchError);
        setLoadingModalMessage("Some simulations encountered errors.");
    } finally {
        // Short delay for the user to see the final message, then hide modal
        setTimeout(() => {
            setIsSimulating(false);
        }, 1500);
    }
  }, [herdComposition, animalDiets, simulationParamsForAPI, prepareAndRunSimulationForGroup, allFeedIngredientDetails]);

  // REMOVED the automatic useEffect that watched herdComposition, animalDiets, etc. to trigger simulations.
  // Simulation is now only triggered by `handleRunAllSimulations`.

  return (
    <div className="container">
      <LoadingModal isLoading={isSimulating} message={loadingModalMessage} />
      <h1>CADEM - Farm Model Interface</h1>
      <HerdCompositionCard onCompositionUpdate={handleHerdUpdate} />
      <AnimalDietsCard
        tabsConfig={dynamicTabsConfig}
        onDietsUpdate={handleDietsUpdate}
        onFeedDetailsLoaded={setAllFeedIngredientDetails} 
      />

    {/* Place the new button component here */}
      <RunSimulationsButton 
        onRunAllSimulations={handleRunAllSimulations}
        isLoading={isSimulating}
      />
          
          
      <SimulationRunnerCard
        simulationResults={simulationResults} 
        isLoading={isSimulating} // Used by modal, can also be used by card for its own indicators
        errors={simulationErrors} 
        // simulationParams prop removed from SimulationRunnerCard if controls are gone,
        // but can be passed if card needs to display them.
        // simulationParams={simulationParamsForAPI} 
        herdComposition={herdComposition} 
        onRunAllSimulations={handleRunAllSimulations} // Pass the new handler
      />
          
    <MethaneProductionBarChart 
          simulationResults={simulationResults}
          herdComposition={herdComposition}
          isLoading={isSimulating} // Pass isLoading so it can show a loading state
        />
    </div>
  );
}

export default App;