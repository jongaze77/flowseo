'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type Region } from '../components/ui/RegionSelector';

interface RegionContextType {
  selectedRegion: Region;
  setSelectedRegion: (region: Region) => void;
  defaultRegion: Region;
  setDefaultRegion: (region: Region) => void;
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

interface RegionProviderProps {
  children: ReactNode;
  projectDefaultRegion?: Region;
}

export function RegionProvider({ children, projectDefaultRegion = 'UK' }: RegionProviderProps) {
  const [defaultRegion, setDefaultRegion] = useState<Region>(projectDefaultRegion);
  const [selectedRegion, setSelectedRegion] = useState<Region>(projectDefaultRegion);

  // Update regions when project changes
  useEffect(() => {
    setDefaultRegion(projectDefaultRegion);
    setSelectedRegion(projectDefaultRegion);
  }, [projectDefaultRegion]);

  return (
    <RegionContext.Provider
      value={{
        selectedRegion,
        setSelectedRegion,
        defaultRegion,
        setDefaultRegion,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
}

export function useRegionValidation() {
  const { selectedRegion, defaultRegion } = useRegion();

  const validateRegion = (region: Region): boolean => {
    return ['US', 'UK', 'AU', 'CA'].includes(region);
  };

  return {
    selectedRegion,
    defaultRegion,
    validateRegion,
    isValidRegion: validateRegion(selectedRegion),
  };
}