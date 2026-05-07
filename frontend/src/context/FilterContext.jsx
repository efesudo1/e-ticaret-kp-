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
  // İlk açılışta 'all' (boş tarih) — veri olmayan aralığa düşmesin diye.
  // Backend'den anchor (data maxDate) gelince otomatik 30 güne kayar.
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    channel: '',
    campaign: '',
    device: '',
    city: '',
    brand: '',
    category: '',
    preset: 'all',
    platform: 'all',  // 'all' | 'meta' | 'google'
  });
  const [anchorDate, setAnchorDate] = useState(null);

  // Backend'den veri tarih aralığını çek, anchor olarak max'ı al ve 30 güne kaydır.
  useEffect(() => {
    let cancelled = false;
    filterAPI.options()
      .then(({ data }) => {
        if (cancelled) return;
        const max = data?.dateRange?.maxDate;
        if (!max) return;
        const cleaned = String(max).replace(/-/g, '');
        const parsed = parseYYYYMMDD(cleaned);
        if (!parsed) return;
        setAnchorDate(parsed);
        const range = computePresetFromAnchor(DEFAULT_PRESET, parsed);
        // anchor geldikten sonra otomatik 30 güne kay (sadece kullanıcı henüz manuel değiştirmemişse)
        setFilters(prev => prev.preset === 'all' && !prev.startDate
          ? { ...prev, startDate: range.startDate, endDate: range.endDate, preset: DEFAULT_PRESET }
          : prev);
      })
      .catch(() => { /* sessizce yut, default 'all' kalır */ });
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
    // anchor henüz gelmemişse bugünü kullan
    const useAnchor = anchorDate || new Date();
    const range = computePresetFromAnchor(preset, useAnchor);
    setFilters(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
      preset,
    }));
  }, [anchorDate]);

  const resetFilters = useCallback(() => {
    const useAnchor = anchorDate || new Date();
    const range = computePresetFromAnchor(DEFAULT_PRESET, useAnchor);
    setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      channel: '',
      campaign: '',
      device: '',
      city: '',
      brand: '',
      category: '',
      preset: anchorDate ? DEFAULT_PRESET : 'all',
      platform: 'all',
    });
  }, [anchorDate]);

  const activeFilters = Object.entries(filters)
    .filter(([k, v]) => k !== 'preset' && k !== 'platform' && v !== '');

  return (
    <FilterContext.Provider value={{
      filters, updateFilter, applyPreset, resetFilters, activeFilters, anchorDate
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
