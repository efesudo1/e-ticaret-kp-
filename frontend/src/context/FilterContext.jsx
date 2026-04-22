import { createContext, useContext, useState, useCallback } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    channel: '',
    campaign: '',
    device: '',
    city: '',
  });

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      startDate: '',
      endDate: '',
      channel: '',
      campaign: '',
      device: '',
      city: '',
    });
  }, []);

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== '');

  return (
    <FilterContext.Provider value={{ filters, updateFilter, resetFilters, activeFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
}
