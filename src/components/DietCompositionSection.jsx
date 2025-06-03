// src/components/DietCompositionSection.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PREDEFINED_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FF7F50', '#DA70D6', '#A52A2A', '#DEB887',
  '#5F9EA0', '#7FFF00'
];

const CATEGORY_DISPLAY_ORDER = [
  "Silage", "Dry Roughage", "Other Forages and Wet Feeds",
  "Energy Concentrate", "Protein Concentrate", "Byproduct",
  "Minerals", "Vitamins", "Additives", "Uncategorized"
];

// Modal Component for Editing Ingredient Details
function IngredientEditModal({
  ingredient,
  baseDetails,
  onClose,
  onSaveChanges
}) {
  if (!ingredient || !baseDetails) return null;

  const editableNutrientMap = {
    'DM': 'Dry Matter (%)', 'NDF': 'NDF (% DM)', 'ADF': 'ADF (% DM)',
    'Lignin': 'Lignin (% DM)', 'Starch': 'Starch (% DM)', 'WSC': 'WSC (Sugar) (% DM)',
    'CP': 'Crude Protein (% DM)', 'Fat': 'Fat (EE) (% DM)', 'Ash': 'Ash (% DM)',
    'Acetate': 'Acetate (% DM)', 'Propionate': 'Propionate (% DM)',
    'Butyrate': 'Butyrate (% DM)', 'Lactate': 'Lactate (% DM)',
  };

  const [editableNutrients, setEditableNutrients] = useState(() => {
    const initial = { ...baseDetails };
    if (ingredient.overriddenNutrients) {
      for (const key in ingredient.overriddenNutrients) {
        if (editableNutrientMap.hasOwnProperty(key)) { 
          initial[key] = ingredient.overriddenNutrients[key];
        }
      }
    }
    return initial;
  });

  const handleNutrientChange = (nutrientKey, inputValue) => {
    const sanitizedValue = inputValue.replace(',', '.');
    if (sanitizedValue === "" || /^\d*\.?\d*$/.test(sanitizedValue)) {
      setEditableNutrients(prev => ({ ...prev, [nutrientKey]: sanitizedValue }));
    }
  };

  const handleSave = () => {
    const newOverrides = {};
    let hasActualOverrides = false;
    for (const key in editableNutrientMap) {
      if (!editableNutrientMap.hasOwnProperty(key)) continue;
      const baseVal = baseDetails[key];
      const currentEditVal = editableNutrients[key];
      const normalizedCurrentValStr = (currentEditVal === undefined || currentEditVal === null || String(currentEditVal).trim() === "") ? null : String(currentEditVal).trim();
      const normalizedBaseValStr = (baseVal === undefined || baseVal === null || String(baseVal).trim() === "") ? null : String(baseVal).trim();
      if (normalizedCurrentValStr !== normalizedBaseValStr) {
        newOverrides[key] = normalizedCurrentValStr === null ? "" : currentEditVal; 
        hasActualOverrides = true;
      }
    }
    onSaveChanges(ingredient.name, hasActualOverrides ? newOverrides : undefined);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ingredient-edit-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h4 id="ingredient-edit-title">Edit Nutrients for: {ingredient.name}</h4>
        <p style={{fontSize: '0.8em', color: '#555'}}>Enter new values to override defaults. Clear a field to have it not saved as an override (uses base value).</p>
        <div className="nutrient-edit-grid">
          {Object.entries(editableNutrientMap).map(([key, label]) => (
            <div key={key} className="nutrient-edit-item">
              <label htmlFor={`edit-${key}`}>{label}:</label>
              <div className="nutrient-values">
                <input
                  type="text"
                  id={`edit-${key}`}
                  value={editableNutrients[key] === null || editableNutrients[key] === undefined ? '' : String(editableNutrients[key]).replace('.',',')}
                  onChange={(e) => handleNutrientChange(key, e.target.value)}
                  placeholder={`Base: ${parseFloat(String(baseDetails[key] ?? '0').replace(',','.')).toFixed(2)}`}
                />
                <span className="base-value">
                  {(base) => {
                    console.log('[DietCompositionSection] Base details found:', JSON.parse(JSON.stringify(base)));
                    return `(Base: ${parseFloat(String(baseDetails[key] ?? '0').replace(',','.')).toFixed(2)})`;
                  }}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={handleSave} className="save-changes-button">Save Changes</button>
          <button onClick={onClose} className="modal-close-button">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DietCompositionSection({
  cdpOptions,
  initialCustomDiet, 
  onDietChange,      
  allAvailableIngredients = [],
  feedIngredientDetailsList = []
  // Props related to "Edit Mode" (`isEditingMode`, `onApplyEdits`, `onCancelEdits`)
  // would be added here if DietCompositionSection itself was managing that mode's UI.
  // Since AnimalDietsCard now handles the Edit Mode toggle for its content,
  // DietCompositionSection just receives the initialCustomDiet (which is either committed or a working copy from parent if parent manages edit buffer)
  // and calls onDietChange when any modification is made.
}) {
  const [selectedCDP, setSelectedCDP] = useState('');
  const [editableIngredients, setEditableIngredients] = useState([]);
  const [addIngredientForm, setAddIngredientForm] = useState({
    isVisible: false, category: '', name: '', percentage: 0,
  });
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showAddFormForCategory, setShowAddFormForCategory] = useState(null); // Tracks which category's add form is visible
  const [newIngredient, setNewIngredient] = useState({ name: '', percentage: '', category: '' }); // Holds data for the ingredient being added 

  const [showIngredientEditModal, setShowIngredientEditModal] = useState(false);
  const [ingredientToEdit, setIngredientToEdit] = useState(null);
  const [baseDetailsForEdit, setBaseDetailsForEdit] = useState(null);

  useEffect(() => {
    console.log('[DietCompositionSection] useEffect [initialCustomDiet] - Received initialCustomDiet:', 
      initialCustomDiet ? JSON.parse(JSON.stringify(initialCustomDiet)) : 'null/undefined',
      'Current editableIngredients before this useEffect applies changes:', JSON.parse(JSON.stringify(editableIngredients))
    );

    // Added specific log for a test ingredient:
    if (initialCustomDiet && initialCustomDiet.customIngredients) {
      const testIngredientName = "Pasture"; // Change this if you test with a different ingredient
      const foundTestIngredient = initialCustomDiet.customIngredients.find(
        ing => ing.name && ing.name.toLowerCase() === testIngredientName.toLowerCase()
      );
      if (foundTestIngredient) {
        console.log(`[DietCompositionSection] >>> Specific Check: Details for '${testIngredientName}' in received initialCustomDiet:`,
          JSON.parse(JSON.stringify(foundTestIngredient))
        );
      } else {
        console.log(`[DietCompositionSection] >>> Specific Check: '${testIngredientName}' NOT FOUND in received initialCustomDiet.customIngredients.`);
      }
    } else {
      console.log("[DietCompositionSection] >>> Specific Check: initialCustomDiet or initialCustomDiet.customIngredients is null/undefined.");
    }
    setSelectedCDP(initialCustomDiet?.selectedCDP || '');
    setEditableIngredients(initialCustomDiet?.customIngredients || []);
    setAddIngredientForm(prev => ({ ...prev, isVisible: false })); 

    if (initialCustomDiet?.customIngredients) {
      const currentCategoryNamesInDiet = new Set(
        initialCustomDiet.customIngredients.map(ing => ing.category || 'Uncategorized')
      );
      setExpandedCategories(prevExpanded => {
        const nextExpansionState = { ...prevExpanded }; 
        let didExpansionStateChange = false;
        currentCategoryNamesInDiet.forEach(catName => {
          if (nextExpansionState[catName] === undefined) { 
            nextExpansionState[catName] = false; 
            didExpansionStateChange = true;
          }
        });
        Object.keys(nextExpansionState).forEach(catName => {
          if (!currentCategoryNamesInDiet.has(catName)) {
            delete nextExpansionState[catName];
            didExpansionStateChange = true;
          }
        });
        return didExpansionStateChange ? nextExpansionState : prevExpanded;
      });
    } else {
        console.warn(`[DietCompositionSection] Base details NOT FOUND for ${ingredientFromDiet.name}. Modal will not open. Searched in ${feedIngredientDetailsList.length} items.`);
        console.warn(`[DietCompositionSection] Base details NOT FOUND for ${ingredientFromDiet.name}. Cannot open edit modal.`);
      setExpandedCategories({}); 
    }
  }, [initialCustomDiet]);

  const groupedIngredients = useMemo(() => { /* ... same ... */ return editableIngredients.reduce((acc, ingredient) => { const category = ingredient.category || 'Uncategorized'; if (!acc[category]) acc[category] = []; acc[category].push(ingredient); return acc; }, {}); }, [editableIngredients]);
  const pieChartData = useMemo(() => Object.entries(groupedIngredients) .map(([categoryName, ingredients]) => ({ name: categoryName, value: parseFloat(ingredients.reduce((sum, ing) => sum + (parseFloat(ing.percentage) || 0), 0).toFixed(2)) })).filter(category => category.value > 0).sort((a, b) => { const indexA = CATEGORY_DISPLAY_ORDER.indexOf(a.name); const indexB = CATEGORY_DISPLAY_ORDER.indexOf(b.name); if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name); if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB; }), [groupedIngredients]);
  const totalDietPercentage = useMemo(() => editableIngredients.reduce((sum, ing) => sum + (parseFloat(ing.percentage) || 0), 0), [editableIngredients]);
  const isTotalOver100 = totalDietPercentage > 100;
  const sortedCategoryEntries = useMemo(() => Object.entries(groupedIngredients).sort(([categoryA], [categoryB]) => { const indexA = CATEGORY_DISPLAY_ORDER.indexOf(categoryA); const indexB = CATEGORY_DISPLAY_ORDER.indexOf(categoryB); if (indexA === -1 && indexB === -1) return categoryA.localeCompare(categoryB); if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB; }), [groupedIngredients]);

  const toggleCategoryExpansion = (categoryName) => setExpandedCategories(prev => ({ ...prev, [categoryName]: prev[categoryName] === undefined ? true : !prev[categoryName] }));
  const handleOpenIngredientEditModal = (ingredientFromDiet) => {
    console.log('[DietCompositionSection] handleOpenIngredientEditModal called for:', JSON.parse(JSON.stringify(ingredientFromDiet)));
    // Log only names for brevity and to avoid overly verbose logs if the list is large
    console.log('[DietCompositionSection] Searching for base details in feedIngredientDetailsList. Available ingredient names:', JSON.parse(JSON.stringify(feedIngredientDetailsList.map(i => i.IngredientName))));

    const base = feedIngredientDetailsList.find(
      (item) => item.IngredientName && ingredientFromDiet.name &&
                item.IngredientName.toLowerCase() === ingredientFromDiet.name.toLowerCase()
    );

    if (base) {
      console.log('[DietCompositionSection] Base details FOUND for ' + ingredientFromDiet.name + ':', JSON.parse(JSON.stringify(base)));
      setIngredientToEdit(ingredientFromDiet);
      setBaseDetailsForEdit(base);
      setShowIngredientEditModal(true);
    } else {
      console.warn(`[DietCompositionSection] Base details NOT FOUND for ${ingredientFromDiet.name}. Modal will not open. Searched in ${feedIngredientDetailsList.length} items.`);
      // Optionally, provide user feedback here, e.g., an alert.
      // alert(`Could not find base nutrient details for ${ingredientFromDiet.name}.`);
    }
  };
  const handleCloseIngredientEditModal = () => {
    setShowIngredientEditModal(false);
    setIngredientToEdit(null);
    setBaseDetailsForEdit(null);
    console.log('[DietCompositionSection] IngredientEditModal closed.');
  };
  const handleSaveIngredientOverrides = (ingredientName, newOverrides) => { const updatedIngredients = editableIngredients.map(ing => ing.name === ingredientName ? { ...ing, overriddenNutrients: newOverrides } : ing ); if (onDietChange) onDietChange({ selectedCDP, customIngredients: updatedIngredients }); };
  const handleCDPChange = (event) => { const newCDP = event.target.value; if (onDietChange) onDietChange({ selectedCDP: newCDP, customIngredients: [] }); };
  const handlePercentageChange = (ingredientName, newPercentageStr) => {
    const newPercentage = newPercentageStr === '' ? null : parseFloat(newPercentageStr.replace(',', '.'));

    if (newPercentageStr !== '' && (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100)) {
      console.warn(`[DietCompositionSection] Invalid percentage value for ${ingredientName}: ${newPercentageStr}. Not updating.`);
      // Potentially revert or show an error to the user in the UI
      // For now, we just don't update the state if invalid to prevent bad data propagation
      // You might want to force a re-render here to show the old value if the input doesn't auto-revert
      return; 
    }
    
    console.log(`[DietCompositionSection] Percentage change for ${ingredientName}: ${newPercentageStr} -> Parsed: ${newPercentage}`);
    const updatedIngredients = editableIngredients.map((ing) =>
      ing.name === ingredientName ? { ...ing, percentage: newPercentage === null ? '' : newPercentage } : ing
    );
    setEditableIngredients(updatedIngredients);
    if (onDietChange) {
      onDietChange({
        selectedCDP: selectedCDP, // Pass the current selectedCDP
        customIngredients: updatedIngredients,
        source: 'manual',
      });
      console.log(`[DietCompositionSection] Percentage for ${ingredientName} updated. Called onDietChange.`);
    } else {
      console.warn('[DietCompositionSection] onDietChange is not defined. Cannot propagate percentage change.');
    }
  };
  const handleDeleteIngredient = (ingredientNameToDelete) => {
    console.log(`[DietCompositionSection] Attempting to delete ingredient: ${ingredientNameToDelete}`);
    const updatedIngredients = editableIngredients.filter(
      (ing) => ing.name !== ingredientNameToDelete
    );
    setEditableIngredients(updatedIngredients);
    if (onDietChange) {
      onDietChange({
        selectedCDP: selectedCDP, // Pass the current selectedCDP
        customIngredients: updatedIngredients,
        source: 'manual',
      });
      console.log(`[DietCompositionSection] Ingredient ${ingredientNameToDelete} deleted. Called onDietChange.`);
    } else {
      console.warn('[DietCompositionSection] onDietChange is not defined. Cannot propagate deletion.');
    }
  };
  const handleShowAddForm = (category) => {
    console.log(`[DietCompositionSection] Showing add ingredient form for category: ${category}`);
    setShowAddFormForCategory(category);
    setNewIngredient({ name: '', percentage: '', category: category }); // Reset for the new category
    // Ensure the category is expanded when showing the add form
    if (!expandedCategories[category]) {
      toggleCategoryExpansion(category);
    }
  };
  const handleAddFormChange = (event) => {
    const { name, value } = event.target;
    let processedValue = value;
    // Basic validation for percentage during typing can be added here if desired
    // For now, mainly capturing input, full validation on save
    setNewIngredient((prev) => ({ ...prev, [name]: processedValue }));
    console.log(`[DietCompositionSection] New ingredient form change: ${name} = ${processedValue}`);
  };
  const handleSaveNewIngredient = () => {
    console.log('[DietCompositionSection] Attempting to save new ingredient:', JSON.parse(JSON.stringify(newIngredient)));
    const { name, percentage: percentageStr, category } = newIngredient;

    if (!name || !name.trim()) {
      alert('Ingredient name cannot be empty.');
      console.warn('[DietCompositionSection] Save new ingredient failed: Name is empty.');
      return;
    }

    const trimmedName = name.trim();
    const percentage = parseFloat(String(percentageStr).replace(',', '.'));

    if (String(percentageStr).trim() === '' || isNaN(percentage) || percentage <= 0 || percentage > 100) {
      alert('Please enter a valid percentage greater than 0 and no more than 100 for the new ingredient.');
      console.warn(`[DietCompositionSection] Save new ingredient failed: Invalid percentage '${percentageStr}'.`);
      return;
    }

    if (editableIngredients.some(ing => ing.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert(`Ingredient "${trimmedName}" already exists in the diet.`);
      console.warn(`[DietCompositionSection] Save new ingredient failed: Ingredient ${trimmedName} already exists.`);
      return;
    }

    const baseDetails = feedIngredientDetailsList.find(
      item => item.IngredientName && item.IngredientName.toLowerCase() === trimmedName.toLowerCase()
    );

    if (!baseDetails) {
      alert(`Base nutrient details for "${trimmedName}" were not found. Ingredient cannot be added. Please check the feed library or spelling.`);
      console.warn(`[DietCompositionSection] Save new ingredient failed: Base details not found for ${trimmedName}.`);
      return;
    }

    const ingredientToAdd = {
      name: trimmedName,
      percentage: percentage,
      category: category,
      DryMatter: baseDetails.DryMatter,
      CP: baseDetails.CP,
      ME: baseDetails.ME,
      NDF: baseDetails.NDF,
      ADF: baseDetails.ADF,
      Fat: baseDetails.Fat,
      Ash: baseDetails.Ash,
      Ca: baseDetails.Ca,
      P: baseDetails.P,
      overriddenNutrients: {},
    };

    const updatedIngredients = [...editableIngredients, ingredientToAdd];
    setEditableIngredients(updatedIngredients);

    if (onDietChange) {
      onDietChange({
        selectedCDP: selectedCDP, // Pass the current selectedCDP
        customIngredients: updatedIngredients,
        source: 'manual',
      });
      console.log('[DietCompositionSection] New ingredient saved and onDietChange called:', JSON.parse(JSON.stringify(ingredientToAdd)));
    } else {
      console.warn('[DietCompositionSection] onDietChange is not defined. Cannot propagate new ingredient.');
    }

    setShowAddFormForCategory(null);
    setNewIngredient({ name: '', percentage: '', category: '' });
    if (category && !expandedCategories[category]) {
      toggleCategoryExpansion(category);
    }
  };
  const handleCancelAddIngredient = () => {
    console.log('[DietCompositionSection] Cancelling add ingredient.');
    setShowAddFormForCategory(null);
    setNewIngredient({ name: '', percentage: '', category: '' }); // Also clear the data
  };
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { /* ... same ... */ };

  return (
    <div className="diet-composition-section">
      <p className="subtitle">Select a Common Diet Practice (CDP) as a Base</p>
      <p>This loads base ingredients. Click ingredient names to edit their nutrient values. Changes are applied immediately.</p>
      <select className="cdp-select" value={selectedCDP} onChange={handleCDPChange} aria-label="Select Common Diet Practice">
        <option value="">-- Select a CDP to load --</option>
        {cdpOptions.map(cdp => (<option key={cdp.value} value={cdp.value}>{cdp.label}</option>))}
      </select>

      <div className="custom-diet-ingredients">
        <h5>Custom Diet Ingredients:</h5>
        {selectedCDP && pieChartData.length > 0 && (
            /* ... Pie Chart JSX ... */
            <div className="diet-composition-chart-container">
            <h6>Diet Category Breakdown</h6>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieChartData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel}
                     outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PREDEFINED_COLORS[index % PREDEFINED_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${parseFloat(value).toFixed(2)}%`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <p className={`total-diet-percentage ${isTotalOver100 ? 'warning-over100' : ''}`}>
              Total Diet Composition: {totalDietPercentage.toFixed(2)}%
            </p>
          </div>
        )}

        {!selectedCDP && <p style={{marginTop: '15px'}}>Please select a CDP to view or customize ingredients.</p>}

        {selectedCDP && (sortedCategoryEntries.length > 0 || (addIngredientForm.isVisible && !addIngredientForm.category)) && (
            <div className="categories-grid-container">
              {sortedCategoryEntries.map(([category, ingredientsInCategory]) => {
                const isExpanded = !!expandedCategories[category];
                const categoryTotalPercentage = ingredientsInCategory.reduce((sum, ing) => sum + (parseFloat(ing.percentage) || 0), 0);
                return (
                  <div key={category} className={`category-group collapsible ${isExpanded ? 'expanded' : ''}`}>
                    <h6
                      className="category-group-title"
                      onClick={() => toggleCategoryExpansion(category)}
                      aria-expanded={isExpanded} aria-controls={`category-content-${category.replace(/\s+/g, '-')}`}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => {if(e.key === 'Enter' || e.key === ' ') toggleCategoryExpansion(category)}}
                    >
                      <span>{category} ({categoryTotalPercentage.toFixed(2)}%)</span>
                      <span className={`expansion-indicator ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </h6>
                    {isExpanded && (
                      <div className="category-group-content" id={`category-content-${category.replace(/\s+/g, '-')}`}>
                        <ul>
                          {ingredientsInCategory.map((ingredient) => (
                            <li key={`${category}-${ingredient.name}`}>
                              <span
                                className="ingredient-name-clickable"
                                onClick={() => handleOpenIngredientEditModal(ingredient)}
                                title={`Edit nutrients for ${ingredient.name}`}
                                role="button" tabIndex={0}
                                onKeyDown={(e) => {if(e.key === 'Enter' || e.key === ' ') handleOpenIngredientEditModal(ingredient)}}
                              >
                                {ingredient.name}
                                <span role="img" aria-label="edit nutrients" style={{ marginLeft: '5px', color: '#007bff', cursor: 'pointer', fontSize: '0.9em' }}>⚙️</span>
                              </span>
                              <div>
                                <input type="text" 
                                       value={String(ingredient.percentage).replace('.',',')}
                                       onChange={(e) => handlePercentageChange(ingredient.name, e.target.value)}
                                       aria-label={`Percentage for ${ingredient.name}`}
                                       min="0" step="0.01" style={{width: '70px', textAlign: 'right'}}/> %
                              </div>
                              <button onClick={() => handleDeleteIngredient(ingredient.name)} className="delete-button" aria-label={`Delete ${ingredient.name}`}>X</button>
                            </li>
                          ))}
                        </ul>
                        {showAddFormForCategory === category ? (
                          <div className="add-ingredient-form">
                            <div>
                                <label htmlFor={`newIngName-${category}`}>Ingredient:</label>
                                <select id={`newIngName-${category}`} name="name" value={newIngredient.name} onChange={handleAddFormChange} aria-label="Select new ingredient">
                                  <option value="">Select Ingredient</option>
                                  {(allAvailableIngredients || [])
                                    .filter(availIngObj => {
                                      if (availIngObj.category !== newIngredient.category) return false;
                                      return !ingredientsInCategory.some(editIng => editIng.name.toLowerCase() === availIngObj.name.toLowerCase());
                                    })
                                    .map(availIngObj => (<option key={availIngObj.name} value={availIngObj.name}>{availIngObj.name}</option>))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor={`newIngPerc-${category}`}>Percentage (%):</label>
                                <input id={`newIngPerc-${category}`} type="text" placeholder="e.g. 25,5" name="percentage"
                                       value={newIngredient.percentage} onChange={handleAddFormChange} aria-label="New ingredient percentage"/>
                            </div>
                            <div className="form-actions">
                                <button onClick={handleSaveNewIngredient} className="save-ingredient-button">Save</button>
                                <button onClick={handleCancelAddIngredient} type="button" className="cancel-ingredient-button">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => handleShowAddForm(category)} className="add-ingredient-to-category-button">
                            Add Ingredient to {category}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {showAddFormForCategory && !newIngredient.category && ( /* This condition might need review - form for 'Uncategorized'? */
                 <div className="category-group" style={{marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '15px'}}>
                    <h6>Add New Ingredient to Diet</h6>
                    <div style={{marginBottom:'10px'}}>
                        <label htmlFor="newCategoryNameInput" style={{marginRight: '5px'}}>Category (or type new):</label>
                        <input 
                            id="newCategoryNameInput" type="text" placeholder="e.g., Forages (optional)"
                            list="existing-categories-datalist"
                            defaultValue={addIngredientForm.category}
                            onBlur={(e) => { 
                                const newCatName = e.target.value.trim();
                                setAddIngredientForm(f => ({...f, category: newCatName || 'Uncategorized'}));
                            }}
                            aria-label="New ingredient category"
                        />
                        <datalist id="existing-categories-datalist">
                            {CATEGORY_DISPLAY_ORDER.filter(c => c !== "Uncategorized").map(cat => <option key={cat} value={cat} />)}
                        </datalist>
                    </div>
                    <div className="add-ingredient-form" style={{border: 'none', padding: '0'}}>
                        <div>
                            <label htmlFor="newIngredientNameGlobal">Ingredient:</label>
                            <select id="newIngredientNameGlobal" name="name" value={addIngredientForm.name} onChange={handleAddFormChange} aria-label="Select new ingredient (general)">
                                <option value="">Select Ingredient</option>
                                {allAvailableIngredients.map(o=><option key={o.name} value={o.name}>{o.name} ({o.category})</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="newIngredientPercentageGlobal">Percentage (%):</label>
                            <input id="newIngredientPercentageGlobal" type="text" name="percentage" placeholder="e.g. 10,0"
                                   value={String(addIngredientForm.percentage).replace('.',',')} onChange={handleAddFormChange} aria-label="New ingredient percentage (general)"/>
                        </div>
                        <div className="form-actions">
                            <button onClick={handleSaveNewIngredient} className="save-ingredient-button">Save Ingredient</button>
                            <button onClick={handleCancelAddIngredient} type="button" className="cancel-ingredient-button">Cancel</button>
                        </div>
                    </div>
                </div>
              )}
            </div>
          )}
        {selectedCDP && sortedCategoryEntries.length === 0 && !(addIngredientForm.isVisible && !addIngredientForm.category) && (
            <p style={{marginTop: '15px'}}>No ingredients currently in this diet. Add some below or select a different CDP.</p>
        )}

      </div>

      {showIngredientEditModal && (
        <IngredientEditModal
          ingredient={ingredientToEdit}
          baseDetails={baseDetailsForEdit}
          onClose={handleCloseIngredientEditModal}
          onSaveChanges={handleSaveIngredientOverrides}
        />
      )}
    </div>
  );
}

export default DietCompositionSection;