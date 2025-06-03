// src/components/AnimalDietsCard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import DietCompositionSection from './DietCompositionSection';
import * as XLSX from 'xlsx';

// Nutrient display configuration for the table in AnimalDietsCard
const NUTRIENTS_TO_DISPLAY_IN_CARD = [
  { key: 'DM', label: 'Dry Matter', unit: '%' }, 
  { key: 'CP', label: 'Crude Protein', unit: '% DM' },
  { key: 'NDF', label: 'NDF', unit: '% DM' },
  { key: 'ADF', label: 'ADF', unit: '% DM' },
  { key: 'Lignin', label: 'Lignin', unit: '% DM' },
  { key: 'Starch', label: 'Starch', unit: '% DM' },
  { key: 'WSC', label: 'WSC (Sugar)', unit: '% DM' },
  { key: 'Fat', label: 'Fat (EE)', unit: '% DM' },
  { key: 'Ash', label: 'Ash', unit: '% DM' },
  { key: 'Acetate', label: 'Acetate', unit: '% DM' },
  { key: 'Propionate', label: 'Propionate', unit: '% DM' },
  { key: 'Butyrate', label: 'Butyrate', unit: '% DM' },
  { key: 'Lactate', label: 'Lactate', unit: '% DM' },
];


function AnimalDietsCard({
  tabsConfig = [], 
  onDietsUpdate,
  onFeedDetailsLoaded
}) {
  const [tabDiets, setTabDiets] = useState({});
  const [activeTab, setActiveTab] = useState(''); 

  const [cdpIngredientsData, setCdpIngredientsData] = useState([]);
  const [feedIngredientsData, setFeedIngredientsData] = useState([]); 
  const [allAvailableIngredientsForDropdown, setAllAvailableIngredientsForDropdown] = useState([]);
  const [excelLoadingError, setExcelLoadingError] = useState(null);

  const [activeDietNutrientProfile, setActiveDietNutrientProfile] = useState(null);
  const [allFeedIngredientDetailsForCalc, setAllFeedIngredientDetailsForCalc] = useState([]);

  // State for the ENTIRE "Common Diet Practices" card's expansion
  const [isMainCardExpanded, setIsMainCardExpanded] = useState(true); // Correct state variable name

  // State for the DietCompositionSection content *WITHIN* the active tab
  const [isDietDetailsExpanded, setIsDietDetailsExpanded] = useState(true); 


  useEffect(() => {
    const newTabDiets = {};
    let firstTabId = '';
    if (tabsConfig && tabsConfig.length > 0) {
      firstTabId = tabsConfig[0].id;
      tabsConfig.forEach(tab => {
        newTabDiets[tab.id] = tabDiets[tab.id] || { selectedCDP: '', customIngredients: [] };
      });
    }
    setTabDiets(newTabDiets);

    if (tabsConfig && tabsConfig.find(t => t.id === activeTab)) {
      // Active tab still exists
    } else if (tabsConfig && tabsConfig.length > 0) {
      setActiveTab(firstTabId);
    } else {
      setActiveTab(''); 
    }
  }, [tabsConfig]); 


  useEffect(() => {
    if (onDietsUpdate && activeTab && tabsConfig.some(t => t.id === activeTab)) {
      console.log('[AnimalDietsCard] useEffect calling onDietsUpdate. ActiveTab:', activeTab, 'All tabDiets:', JSON.parse(JSON.stringify(tabDiets)));
      onDietsUpdate(tabDiets, activeTab); 
    } else if (onDietsUpdate && tabsConfig.length === 0 && activeTab === '') {
      console.log('[AnimalDietsCard] useEffect calling onDietsUpdate (no tabs). ActiveTab:', activeTab, 'All tabDiets:', JSON.parse(JSON.stringify(tabDiets)));
      onDietsUpdate({}, '');
    }
  }, [onDietsUpdate, activeTab, tabDiets, tabsConfig]);


  useEffect(() => {
    const fetchExcelData = async () => {
      try {
        const response = await fetch('/data/Data_CADEM.xlsx');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const cdpSheetName = 'common_diet_practices';
        if (workbook.Sheets[cdpSheetName]) {
          const cdpJsonData = XLSX.utils.sheet_to_json(workbook.Sheets[cdpSheetName]);
          setCdpIngredientsData(cdpJsonData);
        } else { console.warn(`Sheet "${cdpSheetName}" not found.`);}

        const feedSheetName = 'feed_ingredients';
        if (workbook.Sheets[feedSheetName]) {
          const feedJson = XLSX.utils.sheet_to_json(workbook.Sheets[feedSheetName]);
          setFeedIngredientsData(feedJson); 
          setAllFeedIngredientDetailsForCalc(feedJson); 
          if (onFeedDetailsLoaded) { 
            onFeedDetailsLoaded(feedJson); 
          }
          const feedSheetForHeaders = XLSX.utils.sheet_to_json(workbook.Sheets[feedSheetName], { header: 1 });
          if (feedSheetForHeaders.length > 1) {
            const headers = feedSheetForHeaders[0].map(h => String(h).trim());
            const nameIdx = headers.indexOf('IngredientName');
            const catIdx = headers.indexOf('Category');
            if (nameIdx !== -1 && catIdx !== -1) {
              const ingredients = feedSheetForHeaders.slice(1).map(row => ({
                name: String(row[nameIdx] || ''), category: String(row[catIdx] || '')
              })).filter(ing => ing.name && ing.category);
              setAllAvailableIngredientsForDropdown(ingredients);
            } else { console.error("IngredientName or Category not found in feed_ingredients headers.");}
          }
        } else { console.warn(`Sheet "${feedSheetName}" not found.`); }
        setExcelLoadingError(null);
      } catch (e) {
        console.error("Failed to fetch/parse Excel data:", e);
        setExcelLoadingError(e.message);
      }
    };
    fetchExcelData();
  }, [onFeedDetailsLoaded]); 


  useEffect(() => {
    if (!activeTab || !tabDiets[activeTab] || allFeedIngredientDetailsForCalc.length === 0) {
      setActiveDietNutrientProfile(null);
      return;
    }
    const currentDiet = tabDiets[activeTab];
    const calculatedProfilePercent = {};
    NUTRIENTS_TO_DISPLAY_IN_CARD.forEach(nutrient => calculatedProfilePercent[nutrient.key] = 0);

    if (currentDiet.customIngredients && currentDiet.customIngredients.length > 0) {
      currentDiet.customIngredients.forEach(dietIng => {
        const baseIngDetails = allFeedIngredientDetailsForCalc.find(
          dbIng => dbIng.IngredientName && dietIng.name && dbIng.IngredientName.toLowerCase() === dietIng.name.toLowerCase()
        );
        if (!baseIngDetails) return;
        const ingPercentageInDiet = parseFloat(dietIng.percentage) || 0;
        if (ingPercentageInDiet <= 0) return;

        NUTRIENTS_TO_DISPLAY_IN_CARD.forEach(nutrientToDisplay => {
          const nutrientKeyInExcel = nutrientToDisplay.key; 
          let nutrientSourceValue = baseIngDetails[nutrientKeyInExcel];
          if (dietIng.overriddenNutrients && dietIng.overriddenNutrients.hasOwnProperty(nutrientKeyInExcel)) {
            const overrideAttempt = dietIng.overriddenNutrients[nutrientKeyInExcel];
            if (overrideAttempt !== undefined) nutrientSourceValue = overrideAttempt;
          }
          let nutrientValueAsPercentage = 0;
          if (typeof nutrientSourceValue === 'string' && nutrientSourceValue.trim() !== '') {
            nutrientValueAsPercentage = parseFloat(String(nutrientSourceValue).replace(',', '.'));
          } else if (typeof nutrientSourceValue === 'number') {
            nutrientValueAsPercentage = nutrientSourceValue;
          }
          if (isNaN(nutrientValueAsPercentage)) nutrientValueAsPercentage = 0;
          calculatedProfilePercent[nutrientToDisplay.key] += nutrientValueAsPercentage * (ingPercentageInDiet / 100);
        });
      });
    }
    setActiveDietNutrientProfile(calculatedProfilePercent);
  }, [activeTab, tabDiets, allFeedIngredientDetailsForCalc]);


  const handleDietChange = (groupId, dietUpdate) => { 
    console.log('[AnimalDietsCard] handleDietChange triggered for group:', groupId, 'with update:', JSON.parse(JSON.stringify(dietUpdate)));
    setTabDiets(prevDiets => {
      const currentGroupDiet = prevDiets[groupId] || { selectedCDP: '', customIngredients: [] };
      let newCustomIngredients = currentGroupDiet.customIngredients;
      let newSelectedCDP = dietUpdate.selectedCDP !== undefined ? dietUpdate.selectedCDP : currentGroupDiet.selectedCDP;
      if (dietUpdate.selectedCDP && dietUpdate.selectedCDP !== currentGroupDiet.selectedCDP) {
        if (cdpIngredientsData.length > 0) {
          newCustomIngredients = cdpIngredientsData
            .filter(ing => ing.DietName === dietUpdate.selectedCDP)
            .map(ing => {
              const feedItem = feedIngredientsData.find(item => item.IngredientName === ing.IngredientName);
              return {
                name: ing.IngredientName,
                percentage: ing.Percentage !== undefined ? ing.Percentage : 0,
                category: feedItem ? feedItem.Category : 'Uncategorized',
                overriddenNutrients: undefined 
              };
            });
        } else { newCustomIngredients = []; }
      } else if (dietUpdate.customIngredients) {
        newCustomIngredients = dietUpdate.customIngredients;
      }
      const nextDietForGroup = { ...currentGroupDiet, selectedCDP: newSelectedCDP, customIngredients: newCustomIngredients };
      console.log('[AnimalDietsCard] Calculated new diet state for group', groupId, ':', JSON.parse(JSON.stringify(nextDietForGroup)));
      return { ...prevDiets, [groupId]: nextDietForGroup };
    });
  };

  const toggleMainDietCardExpansion = () => {
    setIsMainCardExpanded(prev => !prev); // Corrected: Use setIsMainCardExpanded
  };

  const toggleDietDetailsExpansion = () => {
    setIsDietDetailsExpanded(prev => !prev);
  };

  // Reset inner diet details expansion when the active tab changes
  useEffect(() => {
    setIsDietDetailsExpanded(true); 
  }, [activeTab]);


  return (
    <div className="card" id="animalTagsSection">
      {/* Clickable Header for the ENTIRE "Common Diet Practices" Card */}
      <div
        style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            cursor: 'pointer', 
            paddingBottom: '10px', 
            borderBottom: isMainCardExpanded ? '1px solid #eee' : 'none', 
            marginBottom: isMainCardExpanded ?  '15px' : '0'
        }}
        onClick={toggleMainDietCardExpansion} // Uses the corrected function name
        role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMainDietCardExpansion(); }}
        aria-expanded={isMainCardExpanded} aria-controls="common-diet-practices-content-wrapper"
      >
        <h2>Common Diet Practices</h2>
        <span style={{ fontSize: '1.5em', transform: isMainCardExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }}>
          ▶
        </span>
      </div>

      {isMainCardExpanded && (
        <div id="common-diet-practices-content-wrapper" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {excelLoadingError && <p style={{color: 'red'}}>Error loading base diet data: {excelLoadingError}</p>}
          
          {tabsConfig.length === 0 ? (
            <p>Please define animal groups in the "Herd Composition" section first to configure their diets.</p>
          ) : (
            <>
              <div className="tab-navigation">
                {tabsConfig.map(tab => ( 
                  <button
                    key={tab.id} 
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label} 
                  </button>
                ))}
              </div>
              <div className="tab-content-area">
                {tabsConfig.map(tab => (
                  <div key={tab.id} id={`diet-tab-pane-${tab.id}`} className={`tab-pane ${activeTab === tab.id ? 'active' : ''}`}>
                    {activeTab === tab.id && ( 
                      <>
                        <div 
                          style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            cursor: 'pointer', padding: '10px 0', marginTop:'10px', 
                            borderBottom: isDietDetailsExpanded ? '1px dashed #ccc' : 'none', 
                            marginBottom: '15px'
                          }}
                          onClick={toggleDietDetailsExpansion}
                          role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleDietDetailsExpansion(); }}
                          aria-expanded={isDietDetailsExpanded} aria-controls={`diet-details-content-${tab.id}`}
                        >
                          <h3 style={{margin: 0, fontSize: '1.2em'}}>Diet Details & Customization for {tab.label}</h3>
                          <span style={{ fontSize: '1.2em', transform: isDietDetailsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }}>▶</span>
                        </div>

                        {isDietDetailsExpanded && (
                           <div id={`diet-details-content-${tab.id}`} style={{ animation: 'fadeIn 0.2s ease-out', paddingLeft: '10px' }}>
                            <DietCompositionSection
                              allAvailableIngredients={allAvailableIngredientsForDropdown} 
                              feedIngredientDetailsList={feedIngredientsData} 
                              key={`diet-comp-section-${tab.id}`} 
                              cdpOptions={tab.cdpOptions}
                              initialCustomDiet={tabDiets[tab.id]}
                              onDietChange={(newDietData) => handleDietChange(tab.id, newDietData)}
                            />
                          </div>
                        )}
                        {activeDietNutrientProfile && (
                          <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                            <h4>Calculated Diet Nutrient Profile (DM Basis)</h4>
                             <table className="nutrient-profile-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2' }}>Nutrient</th>
                                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', backgroundColor: '#f2f2f2' }}>Value</th>
                                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2' }}>Unit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {NUTRIENTS_TO_DISPLAY_IN_CARD.map(nutrient => (
                                  <tr key={nutrient.key}>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{nutrient.label}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                                      {nutrient.key === 'DM' && (!tabDiets[activeTab] || tabDiets[activeTab]?.customIngredients?.length === 0) 
                                       ? 'N/A' 
                                       : nutrient.key === 'DM' 
                                         ? '100.00' 
                                         : (activeDietNutrientProfile[nutrient.key] !== undefined 
                                             ? activeDietNutrientProfile[nutrient.key].toFixed(2)
                                             : 'N/A')}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                        {nutrient.key === 'DM' && (!tabDiets[activeTab] || tabDiets[activeTab]?.customIngredients?.length === 0) 
                                          ? '' 
                                          : nutrient.unit}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export { AnimalDietsCard };