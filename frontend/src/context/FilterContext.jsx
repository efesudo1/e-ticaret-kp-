import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { filterAPI } from '../services/api';

const FilterContext = createContext(null);

const toYYYYMMDD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};

const parseYYYYMMDD = (s) => {
  if (!s || s.length !== 8) return null;
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
};

const computePresetFromAnchor = (preset, anchorDate) => {
  const end = new Date(anchorDate);
  const start = new Date(anchorDate);
  if (preset === '7d')  start.setDate(end.getDate() - 7);
  if (preset === '30d') start.setDate(end.getDate() - 30);
  if (preset === '90d') start.setDate(end.getDate() - 90);
  if (preset === 'ytd') { start.setFullYear(end.getFullYear(), 0, 1); }
  if (preset === 'all') return { startDate: '', endDate: '' };
  return { startDate: toYYYYMMDD(start), endDate: toYYYYMMDD(end) };
};

const DEFAULT_PRESET = '30d';

export function FilterProvider({ children }) {
  const todayInit = computePresetFromAnchor(DEFAULT_PRESET, new Date());
  const [filters, setFilters] = useState({
    startDate: todayInit.startDate,
    endDate: todayInit.endDate,
    channel: '',
    campaign: '',
    device: '',
    city: '',
    brand: '',
    category: '',
    preset: DEFAULT_PRESET,
    platform: 'all',  // 'all' | 'meta' | 'google'
  });
  const [anchorDate, setAnchorDate] = useState(new Date());

  // Backend'den veri tarih aralığını çek, default'u onun maxDate'ine göre kaydır.
  // Veri eski olabilir (örn. 2024-10 / 2025-03), bugünden gerisi boş çıkar.
  useEffect(() => {
    let cancelled = false;
    filterAPI.options()
      .then(({ data }) => {
        const max = data?.dateRange?.maxDate;
        if (!max || cancelled) return;
        // max formatı YYYYMMDD veya YYYY-MM-DD olabilir
        const cleaned = String(max).replace(/-/g, '');
        const parsed = parseYYYYMMDD(cleaned);
        if (!parsed) return;
        setAnchorDate(parsed);
        const range = computePresetFromAnchor(DEFAULT_PRESET, parsed);
        setFilters(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
      })
      .catch(() => { /* sessizce yut, default kalır */ });
    return () => { cancelled = true; };
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // tarih elle değişirse preset 'custom'
      preset: (key === 'startDate' || key === 'endDate') ? 'custom' : prev.preset,
    }));
  }, []);

  const applyPreset = useCallback((preset) => {
    if (preset === 'custom') {
      setFilters(prev => ({ ...prev, preset: 'custom' }));
      return;
    }
    const range = computePresetFromAnchor(preset, anchorDate);
    setFilters(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
      preset,
    }));
  }, [anchorDate]);

  // Belirli bir ayın 1'i ile son günü arasını filtreye uygula
  // year: 4 hane, monthIndex: 0-11
  const applyMonth = useCallback((year, monthIndex) => {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0); // ayın son günü
    const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    setFilters(prev => ({
      ...prev,
      startDate: fmt(start),
      endDate: fmt(end),
      preset: `month-${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    const range = computePresetFromAnchor(DEFAULT_PRESET, anchorDate);
    setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      channel: '',
      campaign: '',
      device: '',
      city: '',
      brand: '',
      category: '',
      preset: DEFAULT_PRESET,
      platform: 'all',
    });
  }, [anchorDate]);

  const activeFilters = Object.entries(filters)
    .filter(([k, v]) => k !== 'preset' && k !== 'platform' && v !== '');

  return (
    <FilterContext.Provider value={{
      filters, updateFilter, applyPreset, applyMonth, resetFilters, activeFilters, anchorDate
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
}
