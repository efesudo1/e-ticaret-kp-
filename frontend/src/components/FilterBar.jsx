import { useEffect, useState, useRef, useMemo } from 'react';
import { Calendar, X, ChevronDown, Database, Clock } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { filterAPI } from '../services/api';

const PRESETS = [
  { key: '7d',  label: 'Son 7 Gün' },
  { key: '30d', label: 'Son 30 Gün' },
  { key: '90d', label: 'Son 90 Gün' },
  { key: 'ytd', label: 'YBB' },
  { key: 'all', label: 'Tümü' },
  { key: 'custom', label: 'Özel' },
];

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
                     'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const fromYYYYMMDD = (s) => s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
const toYYYYMMDD = (s) => s ? s.replaceAll('-', '') : '';
const parseYYYYMMDD = (s) => {
  if (!s || s.length !== 8) return null;
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
};

const PLATFORMS = [
  { key: 'all',    label: 'Tüm Platformlar' },
  { key: 'meta',   label: 'Meta' },
  { key: 'google', label: 'Google' },
];

export default function FilterBar({ showChannel = true, showDevice = true, showBrand = false, showCategory = false, showPlatform = true }) {
  const { filters, updateFilter, applyPreset, applyMonth, resetFilters,
          anchorDate, anchorMode, setAnchorMode, effectiveAnchor } = useFilters();
  const [options, setOptions] = useState({
    channels: [], devices: [], brands: [], categories: [],
    minDate: null, maxDate: null,
  });
  const [monthOpen, setMonthOpen] = useState(false);
  const monthRef = useRef(null);

  useEffect(() => {
    filterAPI.options()
      .then(({ data }) => setOptions({
        channels: data.channels || [],
        devices: data.devices || [],
        brands: data.brands || [],
        categories: data.categories || [],
        minDate: parseYYYYMMDD(String(data?.dateRange?.minDate || '').replace(/-/g, '')),
        maxDate: parseYYYYMMDD(String(data?.dateRange?.maxDate || '').replace(/-/g, '')),
      }))
      .catch(() => {});
  }, []);

  // Click-outside ile ay popup'ı kapat
  useEffect(() => {
    if (!monthOpen) return;
    const handler = (e) => {
      if (monthRef.current && !monthRef.current.contains(e.target)) setMonthOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [monthOpen]);

  // Veri aralığındaki yıllar ve aktif aylar
  const monthsByYear = useMemo(() => {
    const result = {};
    const min = options.minDate;
    const max = options.maxDate;
    if (!min || !max) return result;
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    const end = new Date(max.getFullYear(), max.getMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      if (!result[y]) result[y] = new Set();
      result[y].add(m);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }, [options.minDate, options.maxDate]);

  // Aktif ay (filter preset 'month-YYYY-MM' formatındaysa)
  const activeMonth = useMemo(() => {
    if (!filters.preset?.startsWith('month-')) return null;
    const parts = filters.preset.split('-');
    if (parts.length !== 3) return null;
    return { year: parseInt(parts[1]), monthIndex: parseInt(parts[2]) - 1 };
  }, [filters.preset]);

  const activeMonthLabel = activeMonth
    ? `${MONTH_SHORT[activeMonth.monthIndex]} ${activeMonth.year}`
    : 'Ay Seç';

  const handleMonthClick = (year, monthIndex) => {
    applyMonth(year, monthIndex);
    setMonthOpen(false);
  };

  const anchorRefDate = anchorMode === 'today' ? new Date() : anchorDate;
  const anchorLabel = anchorRefDate
    ? `${anchorMode === 'today' ? 'Bugün' : 'Veri kaynağı'}: ${anchorRefDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : '';

  return (
    <div className="filter-bar">
      {/* Anchor mode toggle: "Son N gün" hesaplamasının başlangıç noktası */}
      <div className="anchor-toggle" role="radiogroup" aria-label="Tarih referansı">
        <button
          type="button"
          role="radio"
          aria-checked={anchorMode === 'data'}
          className={`anchor-toggle-btn ${anchorMode === 'data' ? 'active' : ''}`}
          onClick={() => setAnchorMode('data')}
          title="'Son N gün' hesaplamasını veride en son eklenen günden geriye sayar — statik snapshot için doğru seçim."
        >
          <Database size={13} />
          <span>Son veriden</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={anchorMode === 'today'}
          className={`anchor-toggle-btn ${anchorMode === 'today' ? 'active' : ''}`}
          onClick={() => setAnchorMode('today')}
          title="'Son N gün' hesaplamasını bugünden geriye sayar — canlı veri akışı için doğru seçim."
        >
          <Clock size={13} />
          <span>Bugünden</span>
        </button>
      </div>

      <div className="filter-presets">
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            className={`chip ${filters.preset === p.key ? 'chip-active' : ''}`}
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </button>
        ))}

        {/* Ay seçici */}
        <div ref={monthRef} className="month-picker-wrapper">
          <button
            type="button"
            className={`chip ${activeMonth ? 'chip-active' : ''}`}
            onClick={() => setMonthOpen(o => !o)}
          >
            <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {activeMonthLabel}
            <ChevronDown size={11} style={{ marginLeft: 4, verticalAlign: 'middle', transform: monthOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
          </button>

          {monthOpen && (
            <div className="month-picker-popup">
              {Object.keys(monthsByYear).length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  Veri aralığı yükleniyor...
                </div>
              ) : (
                Object.keys(monthsByYear).sort((a, b) => b - a).map(year => (
                  <div key={year} className="month-picker-year-block">
                    <div className="month-picker-year">{year}</div>
                    <div className="month-picker-grid">
                      {MONTH_SHORT.map((name, idx) => {
                        const enabled = monthsByYear[year].has(idx);
                        const isActive = activeMonth?.year === parseInt(year) && activeMonth?.monthIndex === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={!enabled}
                            className={`month-picker-cell ${isActive ? 'month-picker-cell-active' : ''} ${!enabled ? 'month-picker-cell-disabled' : ''}`}
                            onClick={() => enabled && handleMonthClick(parseInt(year), idx)}
                            title={enabled ? `${MONTH_NAMES[idx]} ${year}` : 'Bu ayda veri yok'}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showPlatform && (
        <div className="filter-presets filter-platform-group">
          {PLATFORMS.map(p => (
            <button
              key={p.key}
              type="button"
              className={`chip chip-platform ${filters.platform === p.key ? 'chip-active' : ''}`}
              onClick={() => updateFilter('platform', p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {filters.preset === 'custom' && (
        <div className="filter-item filter-date-range">
          <Calendar size={14} />
          <input
            type="date"
            value={fromYYYYMMDD(filters.startDate)}
            onChange={e => updateFilter('startDate', toYYYYMMDD(e.target.value))}
          />
          <span style={{ opacity: 0.5 }}>→</span>
          <input
            type="date"
            value={fromYYYYMMDD(filters.endDate)}
            onChange={e => updateFilter('endDate', toYYYYMMDD(e.target.value))}
          />
        </div>
      )}

      {showChannel && (
        <div className="filter-item">
          <select
            value={filters.channel}
            onChange={e => updateFilter('channel', e.target.value)}
          >
            <option value="">Tüm Kanallar</option>
            {options.channels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {showDevice && (
        <div className="filter-item">
          <select
            value={filters.device}
            onChange={e => updateFilter('device', e.target.value)}
          >
            <option value="">Tüm Cihazlar</option>
            {options.devices.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {showBrand && (
        <div className="filter-item">
          <select
            value={filters.brand}
            onChange={e => updateFilter('brand', e.target.value)}
          >
            <option value="">Tüm Markalar</option>
            {options.brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {showCategory && (
        <div className="filter-item">
          <select
            value={filters.category}
            onChange={e => updateFilter('category', e.target.value)}
          >
            <option value="">Tüm Kategoriler</option>
            {options.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      <button type="button" className="btn-reset" onClick={resetFilters}>
        <X size={14} /> Sıfırla
      </button>

      <span className="filter-anchor-label">{anchorLabel}</span>
    </div>
  );
}
