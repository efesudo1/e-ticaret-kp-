import { useEffect, useState } from 'react';
import { Calendar, X } from 'lucide-react';
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

const fromYYYYMMDD = (s) => s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
const toYYYYMMDD = (s) => s ? s.replaceAll('-', '') : '';

const PLATFORMS = [
  { key: 'all',    label: 'Tüm Platformlar' },
  { key: 'meta',   label: 'Meta' },
  { key: 'google', label: 'Google' },
];

export default function FilterBar({ showChannel = true, showDevice = true, showBrand = false, showCategory = false, showPlatform = true }) {
  const { filters, updateFilter, applyPreset, resetFilters, anchorDate } = useFilters();
  const [options, setOptions] = useState({ channels: [], devices: [], brands: [], categories: [] });

  useEffect(() => {
    filterAPI.options()
      .then(({ data }) => setOptions({
        channels: data.channels || [],
        devices: data.devices || [],
        brands: data.brands || [],
        categories: data.categories || [],
      }))
      .catch(() => {});
  }, []);

  const anchorLabel = anchorDate
    ? `Veri kaynağı: ${anchorDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : '';

  return (
    <div className="filter-bar">
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
