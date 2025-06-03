// src/components/HerdCompositionCard.jsx
import React, { useState, useEffect } from 'react';
import CategoryCard from './CategoryCard';
import { v4 as uuidv4 } from 'uuid';

const ANIMAL_TYPE_CONFIG = {
  "Milking Cows": { 
    abbreviation: "MC", defaultBreeds: ["Holstein", "Jersey"], defaultDMI: "25.0", 
    defaultPercentage: 60, defaultNameBase: "Milking Cows", requiresMilkYield: true, defaultMilkYield: "30.0",
  },
  "Dry Cows":     { 
    abbreviation: "DC", defaultBreeds: ["Holstein", "Jersey"], defaultDMI: "12.5", 
    defaultPercentage: 15, defaultNameBase: "Dry Cows"
  },
  "Heifers":      { 
    abbreviation: "HF", defaultBreeds: ["Holstein", "Jersey"], defaultDMI: "9.0", 
    defaultPercentage: 15, defaultNameBase: "Heifers" 
  },
  "Calves":       { 
    abbreviation: "CV", defaultBreeds: ["Holstein", "Jersey"], defaultDMI: "1.5", 
    defaultPercentage: 5, defaultNameBase: "Calves" 
  },
  "Beef Cattle":  { 
    abbreviation: "BC", defaultBreeds: ["Angus", "Hereford", "Brahman crosses"], defaultDMI: "10.0", 
    defaultPercentage: 5, defaultNameBase: "Beef Cattle", requiresADG: true, defaultADG: "1.0",
  },
};
const AVAILABLE_ANIMAL_TYPES = Object.keys(ANIMAL_TYPE_CONFIG);

const generateDynamicGroupName = (animalType, breed, allGroupsArray, excludeGroupId = null) => {
  const config = ANIMAL_TYPE_CONFIG[animalType];
  const typePart = config?.abbreviation || config?.defaultNameBase || animalType;
  const breedPart = breed ? ` - ${breed}` : '';
  const countOfSameTypeAndBreed = allGroupsArray.filter(
    g => g.animalType === animalType && (breed ? g.breed === breed : true) && g.id !== excludeGroupId
  ).length;
   const countOfSameTypeOnly = allGroupsArray.filter(
    g => g.animalType === animalType && g.id !== excludeGroupId
  ).length;
  const groupNumber = breed ? countOfSameTypeAndBreed + 1 : countOfSameTypeOnly + 1;
  return `${typePart}${breedPart} Group ${groupNumber}`;
};

const createInitialGroup = (animalType, allCurrentGroups = []) => {
  const config = ANIMAL_TYPE_CONFIG[animalType];
  if (!config) {
    const groupCount = allCurrentGroups.filter(g => g.animalType === animalType).length;
    return {
      id: uuidv4(),
      animalType: animalType,
      name: `${animalType} Group ${groupCount + 1}`,
      percentage: 0, // <<< ADDED THIS LINE
      breed: '',
      dmi: '',
      isNameUserEdited: false,
      isExpanded: true, 
      milkYield: '', 
      adg: '',       
    };
  }
  const initialBreed = config.defaultBreeds && config.defaultBreeds.length > 0 ? config.defaultBreeds[0] : '';
  const initialName = generateDynamicGroupName(animalType, initialBreed, allCurrentGroups, null); 
  return {
    id: uuidv4(),
    animalType: animalType,
    name: initialName,
    percentage: config.defaultPercentage !== undefined ? config.defaultPercentage : 0,
    breed: initialBreed,
    dmi: config.defaultDMI || '',
    milkYield: config.requiresMilkYield ? (config.defaultMilkYield || '') : '',
    adg: config.requiresADG ? (config.defaultADG || '') : '',
    isNameUserEdited: false,
    isExpanded: false, 
  };
};

// ... rest of HerdCompositionCard.jsx (useState, useEffect, handlers, return statement)
// Make sure the initial state creation also uses this corrected function:

function HerdCompositionCard({ onCompositionUpdate }) {
  const [herdGroups, setHerdGroups] = useState(() => {
    const initialGroups = [];
    initialGroups.push(createInitialGroup("Milking Cows", initialGroups));
    initialGroups.push(createInitialGroup("Dry Cows", initialGroups));
    initialGroups.push(createInitialGroup("Heifers", initialGroups));
    initialGroups.push(createInitialGroup("Calves", initialGroups));
    initialGroups.push(createInitialGroup("Beef Cattle", initialGroups));
    return initialGroups;
  });

  const [isSectionExpanded, setIsSectionExpanded] = useState(true);

  useEffect(() => {
    if (onCompositionUpdate) {
      onCompositionUpdate(herdGroups);
    }
  }, [herdGroups, onCompositionUpdate]);

  const handleAddGroup = () => {
    let newGroupType = AVAILABLE_ANIMAL_TYPES[0]; 
    const groupCounts = AVAILABLE_ANIMAL_TYPES.map(type => ({
        type,
        count: herdGroups.filter(g => g.animalType === type).length
    }));
    groupCounts.sort((a,b) => a.count - b.count); 
    if (groupCounts.length > 0) {
        newGroupType = groupCounts[0].type;
    }
    const newGroup = createInitialGroup(newGroupType, herdGroups);
    newGroup.isExpanded = true; 
    setHerdGroups(prevGroups => [...prevGroups, newGroup]);
  };

  const handleDeleteGroup = (groupId) => {
    setHerdGroups(prevGroups => prevGroups.filter(group => group.id !== groupId));
  };

  const handleGroupDataChange = (groupId, changedDataFromCategoryCard) => {
    setHerdGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === groupId) {
          const updatedGroup = { ...group, ...changedDataFromCategoryCard };
          if (
            changedDataFromCategoryCard.breed !== undefined &&
            changedDataFromCategoryCard.breed !== group.breed && 
            !updatedGroup.isNameUserEdited 
          ) {
            updatedGroup.name = generateDynamicGroupName(
              updatedGroup.animalType, 
              updatedGroup.breed, 
              prevGroups.filter(g => g.id !== groupId), 
              null 
            );
          }
          return updatedGroup;
        }
        return group;
      })
    );
  };
  
  const handleAnimalTypeChange = (groupId, newAnimalType) => {
    setHerdGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === groupId) {
          const config = ANIMAL_TYPE_CONFIG[newAnimalType]; // Will be undefined if newAnimalType is not in ANIMAL_TYPE_CONFIG
          // Use the corrected createInitialGroup logic which handles missing config
          // We need to preserve the ID and potentially other user-set values like percentage if desired,
          // or reset them based on the new type. For now, let's mostly reset from createInitialGroup.
          const newGroupData = createInitialGroup(newAnimalType, prevGroups.filter(g => g.id !== groupId));
          return {
            ...group, // preserve existing id, isExpanded, potentially percentage if not resetting
            ...newGroupData, // apply new type defaults
            id: group.id, // ensure original ID is kept
            // percentage: group.percentage, // Option: keep existing percentage
            isExpanded: group.isExpanded, // keep current expansion state
          };
        }
        return group;
      })
    );
  };
  
  const handleGroupNameChange = (groupId, newName) => {
    setHerdGroups(prevGroups =>
        prevGroups.map(group =>
            group.id === groupId ? { ...group, name: newName, isNameUserEdited: true } : group
        )
    );
  };

  const toggleGroupExpansion = (groupId) => {
    setHerdGroups(prevGroups =>
      prevGroups.map(group =>
        group.id === groupId ? { ...group, isExpanded: !group.isExpanded } : group
      )
    );
  };

  const toggleSectionExpansion = () => {
    setIsSectionExpanded(prev => !prev);
  };

  const totalHerdPercentageValue = herdGroups.reduce((sum, group) => {
      // Defensive check for group and percentage property
      const percentage = group && group.percentage !== undefined ? Number(group.percentage) : 0;
      return sum + (isNaN(percentage) ? 0 : percentage);
  }, 0);
  const isHerdTotalOver100 = totalHerdPercentageValue > 100;

  return (
    <div className="card">
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: '10px', borderBottom: '1px solid #eee', marginBottom: '15px' }}
        onClick={toggleSectionExpansion}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSectionExpansion(); }}
        aria-expanded={isSectionExpanded}
        aria-controls="herd-composition-content"
      >
        <h2>Herd Composition</h2>
        <span style={{ fontSize: '1.5em', transform: isSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }}>
          ▶
        </span>
      </div>

      {isSectionExpanded && (
        <div id="herd-composition-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <p>Define herd by adding and configuring animal groups. Percentages should ideally sum to 100%.</p>
          <button onClick={handleAddGroup} style={{ marginBottom: '20px', padding: '10px 15px' }}>
            + Add Animal Group
          </button>

          <div className="dynamic-composition-grid">
            {herdGroups.map((group) => {
              // Defensive check if group is somehow undefined in the array, though unlikely
              if (!group) return null; 
              const typeConfig = ANIMAL_TYPE_CONFIG[group.animalType] || {};
              return (
                <div key={group.id} className="animal-group-entry">
                  <div 
                    style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', cursor: 'pointer', padding: '8px', background: '#e9ecef', borderRadius: '4px'}}
                    onClick={() => toggleGroupExpansion(group.id)}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleGroupExpansion(group.id)}} 
                    aria-expanded={group.isExpanded} aria-controls={`group-content-${group.id}`}
                  >
                    <input
                        type="text" value={group.name}
                        onChange={(e) => { e.stopPropagation(); handleGroupNameChange(group.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()} placeholder="Group Name" aria-label={`Name for ${group.animalType} group`}
                        style={{fontWeight: 'bold', fontSize: '1.1em', border: 'none', borderBottom: '1px solid #ccc', padding: '6px', flexGrow: 1, marginRight: '10px', background: 'transparent'}}
                    />
                    <span style={{ fontSize: '1.2em', marginRight: '10px', transform: group.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }}>▶</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} 
                        className="delete-button" aria-label={`Delete ${group.name} group`}
                        style={{color: '#dc3545', background: 'transparent', border: '1px solid #dc3545', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer'}}
                    >Delete</button>
                  </div>

                  {group.isExpanded && (
                    <div id={`group-content-${group.id}`} className="group-collapsible-content" style={{paddingLeft: '10px', borderLeft: '3px solid #007bff', animation: 'fadeIn 0.3s ease-out'}}>
                      <div style={{marginBottom: '15px'}}>
                        <label htmlFor={`animalType-${group.id}`} style={{marginRight: '8px', fontWeight: '500'}}>Animal Type:</label>
                        <select
                          id={`animalType-${group.id}`} value={group.animalType}
                          onChange={(e) => handleAnimalTypeChange(group.id, e.target.value)}
                          style={{padding: '8px', borderRadius: '4px', border: '1px solid #ced4da'}}
                        >
                          {AVAILABLE_ANIMAL_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                        </select>
                      </div>
                      <CategoryCard
                        title={group.animalType}
                        initialValue={group.percentage} // Should always be defined now
                        maxValue={100}
                        breedOptions={typeConfig.defaultBreeds || []}
                        initialBreed={group.breed}
                        initialDMI={group.dmi}
                        showMilkYieldField={!!typeConfig.requiresMilkYield} 
                        initialMilkYield={group.milkYield || ''}
                        showADGField={!!typeConfig.requiresADG} 
                        initialADG={group.adg || ''}
                        onCompositionChange={(_cardTitleIgnore, newData) => {
                          handleGroupDataChange(group.id, newData);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {herdGroups.length === 0 && <p>No animal groups defined. Click "Add Animal Group" to start.</p>}

          <div className={`total-herd-percentage ${isHerdTotalOver100 ? 'warning-over100' : ''}`}>
            Total Herd Percentage: {totalHerdPercentageValue.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}
export default HerdCompositionCard;