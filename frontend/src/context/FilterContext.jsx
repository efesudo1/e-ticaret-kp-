import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
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

// Preset'i belirli bir referans (bitiş) tarihinden geri sayar.
const computePresetFrom = (preset, refDate) => {
  if (preset === 'all') return { startDate: '', endDate: '' };
  const end = new Date(refDate);
  const start = new Date(refDate);
  if (preset === '7d')  start.setDate(end.getDate() - 7);
  if (preset === '30d') start.setDate(end.getDate() - 30);
  if (preset === '90d') start.setDate(end.getDate() - 90);
  if (preset === 'ytd') { start.setFullYear(end.getFullYear(), 0, 1); }
  return { startDate: toYYYYMMDD(start), endDate: toYYYYMMDD(end) };
};

const DEFAULT_PRESET = '30d';
const ANCHOR_MODE_KEY = 'kpi_anchor_mode';
const VALID_MODES = ['data', 'today'];

export function FilterProvider({ children }) {
  // anchorMode: 'data' = verinin son tarihinden geri say (default, snapshot için doğru)
  //             'today' = bugünden geri say (canlı veri akışı için doğru)
  const [anchorMode, setAnchorModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(ANCHOR_MODE_KEY);
      return VALID_MODES.includes(saved) ? saved : 'data';
    } catch { return 'data'; }
  });

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
    platform: 'all',
  });
  const [anchorDate, setAnchorDate] = useState(null); // verinin max tarihi (data mode için)

  // Aktif referans tarih: mode'a göre data anchor veya bugün.
  // Eğer data mode'unda anchor henüz gelmediyse fallback bugün.
  const effectiveAnchor = useMemo(() => {
    if (anchorMode === 'today') return new Date();
    return anchorDate || new Date();
  }, [anchorMode, anchorDate]);

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
        setFilters(prev => {
          if (prev.preset !== 'all' || prev.startDate || prev.endDate) return prev;
          // İlk açılışta anchorMode'a göre 30g uygula
          const ref = anchorMode === 'today' ? new Date() : parsed;
          const range = computePresetFrom(DEFAULT_PRESET, ref);
          return { ...prev, startDate: range.startDate, endDate: range.endDate, preset: DEFAULT_PRESET };
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // anchorMode değiştiğinde mevcut preset'i (custom/all/month- dışında) yeniden hesapla
  const setAnchorMode = useCallback((mode) => {
    if (!VALID_MODES.includes(mode)) return;
    setAnchorModeState(mode);
    try { localStorage.setItem(ANCHOR_MODE_KEY, mode); } catch {}
    setFilters(prev => {
      const p = prev.preset;
      const isRecalculable = ['7d', '30d', '90d', 'ytd'].includes(p);
      if (!isRecalculable) return prev;
      const ref = mode === 'today' ? new Date() : (anchorDate || new Date());
      const range = computePresetFrom(p, ref);
      return { ...prev, startDate: range.startDate, endDate: range.endDate };
    });
  }, [anchorDate]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
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
    const ref = anchorMode === 'today' ? new Date() : (anchorDate || new Date());
    const range = computePresetFrom(preset, ref);
    setFilters(prev => ({
      ...prev,
      startDate: range.startDate,
      endDate: range.endDate,
      preset,
    }));
  }, [anchorMode, anchorDate]);

  // Belirli bir ayın 1'i ile son günü arasını filtreye uygula
  const applyMonth = useCallback((year, monthIndex) => {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
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
    const ref = anchorMode === 'today' ? new Date() : anchorDate;
    if (ref) {
      const range = computePresetFrom(DEFAULT_PRESET, ref);
      setFilters({
        ...baseFields,
        startDate: range.startDate, endDate: range.endDate, preset: DEFAULT_PRESET,
      });
    } else {
      setFilters({ ...baseFields, startDate: '', endDate: '', preset: 'all' });
    }
  }, [anchorMode, anchorDate]);

  const activeFilters = Object.entries(filters)
    .filter(([k, v]) => k !== 'preset' && k !== 'platform' && v !== '');

  return (
    <FilterContext.Provider value={{
      filters, updateFilter, applyPreset, applyMonth, resetFilters, activeFilters,
      anchorDate, anchorMode, setAnchorMode, effectiveAnchor,
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
