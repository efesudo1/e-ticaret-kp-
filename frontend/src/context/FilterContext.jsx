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
  // İlk açılışta anchor henüz yok → 'all' (tüm zaman) ile başla.
  // Bu, "son 30 gün bugünden hesaplanır → veri yok → 0" sorununu çözer.
  // Anchor (data maxDate) gelince otomatik DEFAULT_PRESET'e (30g) kaymak için ayrı useEffect.
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
  const [autoApplied, setAutoApplied] = useState(false);

  // Backend'den veri max tarihini çek, anchor olarak ayarla.
  // İlk anchor geldiğinde (kullanıcı henüz preset değiştirmediyse) son 30 güne otomatik kaydır.
  useEffect(() => {
    let cancelled = false;
    filterAPI.options()
      .then(({ data }) => {
        const max = data?.dateRange?.maxDate;
        if (!max || cancelled) return;
        const cleaned = String(max).replace(/-/g, '');
        const parsed = parseYYYYMMDD(cleaned);
        if (!parsed) return;
        setAnchorDate(parsed);
        // Sadece kullanıcı henüz manuel preset seçmediyse otomatik 30g'ye kay
        setFilters(prev => {
          if (prev.preset !== 'all' || prev.startDate || prev.endDate) return prev; // dokunma
          const range = computePresetFromAnchor(DEFAULT_PRESET, parsed);
          return { ...prev, startDate: range.startDate, endDate: range.endDate, preset: DEFAULT_PRESET };
        });
        setAutoApplied(true);
      })
      .catch(() => { /* sessizce yut, 'all' kalır → backend tüm zamanı döner, veri yine var */ });
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
    if (preset === 'all') {
      setFilters(prev => ({ ...prev, startDate: '', endDate: '', preset: 'all' }));
      return;
    }
    // Preset'ler için anchor şart — anchor henüz yoksa anchor gelene kadar 'all' bırakma yerine bugünden hesapla.
    // Anchor genelde mount'tan ~200ms sonra geliyor, bu durum nadirdir.
    const useAnchor = anchorDate || new Date();
    const range = computePresetFromAnchor(preset, useAnchor);
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
    const baseFields = {
      channel: '', campaign: '', device: '', city: '', brand: '', category: '',
      platform: 'all',
    };
    if (anchorDate) {
      const range = computePresetFromAnchor(DEFAULT_PRESET, anchorDate);
      setFilters({
        ...baseFields,
        startDate: range.startDate, endDate: range.endDate, preset: DEFAULT_PRESET,
      });
    } else {
      // Anchor yoksa 'all' (tüm zaman) — veri her zaman dolu
      setFilters({ ...baseFields, startDate: '', endDate: '', preset: 'all' });
    }
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
