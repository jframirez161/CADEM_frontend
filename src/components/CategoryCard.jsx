// src/components/CategoryCard.jsx
import React, { useState, useEffect } from 'react';

function CategoryCard({
  title, // This is group.animalType, used mainly for unique IDs if needed
  initialValue,
  maxValue,
  breedOptions = [],
  initialBreed = '',
  initialDMI = '',
  showMilkYieldField = false,
  initialMilkYield = '',
  showADGField = false,
  initialADG = '',
  onCompositionChange
}) {
  const [sliderValue, setSliderValue] = useState(initialValue);
  const [selectedBreed, setSelectedBreed] = useState(initialBreed || (breedOptions.length > 0 ? breedOptions[0] : ''));
  const [dmiValue, setDmiValue] = useState(initialDMI);
  const [milkYieldValue, setMilkYieldValue] = useState(initialMilkYield);
  const [adgValue, setAdgValue] = useState(initialADG);

  useEffect(() => setSliderValue(initialValue), [initialValue]);
  useEffect(() => setSelectedBreed(initialBreed || (breedOptions.length > 0 ? breedOptions[0] : '')), [initialBreed, breedOptions]);
  useEffect(() => setDmiValue(initialDMI), [initialDMI]);
  useEffect(() => setMilkYieldValue(initialMilkYield), [initialMilkYield]);
  useEffect(() => setAdgValue(initialADG), [initialADG]);

  const gatherAllData = () => {
    const data = {
      percentage: Number(sliderValue),
      breed: selectedBreed,
      dmi: dmiValue, // Keep as string for controlled input, App.jsx will parseFloat
    };
    if (showMilkYieldField) data.milkYield = milkYieldValue;
    if (showADGField) data.adg = adgValue;
    return data;
  };

  const makeChangeHandler = (fieldSetter, fieldNameForCallback) => (event) => {
    const newValue = event.target.value;
    // Allow empty string, numbers, and a single decimal point
    if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
        fieldSetter(newValue);
        // Construct data with the new value immediately for callback
        const currentData = gatherAllData(); // Get all current values
        currentData[fieldNameForCallback] = newValue; // Update the changed field
        if (onCompositionChange) {
            onCompositionChange(title, currentData);
        }
    }
  };
  
  const handleSliderChange = (event) => {
    const newSliderValue = event.target.value;
    setSliderValue(newSliderValue);
    if (onCompositionChange) {
        const currentData = gatherAllData();
        currentData.percentage = Number(newSliderValue);
        onCompositionChange(title, currentData);
    }
  };

  const handleBreedChange = (event) => {
    const newBreed = event.target.value;
    setSelectedBreed(newBreed);
    if (onCompositionChange) {
        const currentData = gatherAllData();
        currentData.breed = newBreed;
        onCompositionChange(title, currentData);
    }
  };

  const handleDmiChange = makeChangeHandler(setDmiValue, 'dmi');
  const handleMilkYieldChange = makeChangeHandler(setMilkYieldValue, 'milkYield');
  const handleAdgChange = makeChangeHandler(setAdgValue, 'adg');

  const idBase = String(title).toLowerCase().replace(/\s+/g, '-') + '-';

  return (
    // Removed title display from here, as HerdCompositionCard displays group name
    <div className={`category-card-content`}> {/* Simplified className */}
      <div className="category-body"> {/* Assuming this class provides necessary padding/layout */}
        <div>
            <label htmlFor={`${idBase}breedSelect`} className="parameter-label">Breed:</label>
            <select id={`${idBase}breedSelect`} value={selectedBreed} onChange={handleBreedChange} aria-label={`${title} Breed`}>
            {breedOptions.map(breed => (
                <option key={breed} value={breed}>{breed}</option>
            ))}
            {breedOptions.length === 0 && <option value="">No breeds defined</option>}
            </select>
        </div>
        

        <div className="slider-container" style={{marginTop: '15px'}}>
          <label htmlFor={`${idBase}percentageSlider`} className="parameter-label" style={{display: 'block', marginBottom:'5px'}}>Percentage in Herd:</label>
          <span className="slider-value">{sliderValue}%</span>
          <input
            type="range" min="0" max={maxValue} value={sliderValue}
            className="slider" id={`${idBase}percentageSlider`}
            onChange={handleSliderChange}
          />
          <div className="slider-labels"><span>0%</span><span>{maxValue}%</span></div>
        </div>

        <div className="parameter-input-container">
          <label htmlFor={`${idBase}DmiInput`} className="parameter-label">
            DMI (kg/day):
          </label>
          <input
            type="text" id={`${idBase}DmiInput`}
            className="parameter-input" value={dmiValue} onChange={handleDmiChange}
            placeholder="e.g., 22.5"
            aria-label={`Dry Matter Intake for ${title}`}
          />
        </div>

        {showMilkYieldField && (
          <div className="parameter-input-container">
            <label htmlFor={`${idBase}MilkYieldInput`} className="parameter-label">
              Milk Yield (kg/day):
            </label>
            <input
              type="text" id={`${idBase}MilkYieldInput`}
              className="parameter-input" value={milkYieldValue} onChange={handleMilkYieldChange}
              placeholder="e.g., 30.0"
              aria-label={`Milk Yield for ${title}`}
            />
          </div>
        )}

        {showADGField && (
          <div className="parameter-input-container">
            <label htmlFor={`${idBase}AdgInput`} className="parameter-label">
              ADG (kg/day):
            </label>
            <input
              type="text" id={`${idBase}AdgInput`}
              className="parameter-input" value={adgValue} onChange={handleAdgChange}
              placeholder="e.g., 1.2"
              aria-label={`Average Daily Gain for ${title}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoryCard;