import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { Filter, X, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

const fmt = n => n == null ? '0' : Number(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Number(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺' + Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const chartBase = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', fontFamily: 'Futura PT, sans-serif', toolbar: { show: false } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
  xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } }, axisBorder: { color: 'rgba(255,255,255,0.08)' }, axisTicks: { color: 'rgba(255,255,255,0.08)' } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } } },
  tooltip: { theme: 'dark', style: { fontFamily: 'Futura PT' } },
  legend: { labels: { colors: '#94a3b8' }, fontFamily: 'Futura PT', fontSize: '12px' },
  colors: ['#22c55e', '#E30613', '#06b6d4', '#f59e0b', '#a855f7', '#ff2d3b'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

export default function Profitability() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('grossProfit');
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await kpiAPI.profitability(filters);
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const categoryChart = data?.categoryProfit?.length ? {
    series: [
      { name: 'Gelir', data: data.categoryProfit.map(c => Number(c.revenue) || 0) },
      { name: 'Maliyet', data: data.categoryProfit.map(c => Number(c.cost) || 0) },
      { name: 'Kâr', data: data.categoryProfit.map(c => Number(c.profit) || 0) },
    ],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 300 },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '70%' } },
      xaxis: { ...chartBase.xaxis, categories: data.categoryProfit.map(c => c.category || 'Diğer') },
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } },
    }
  } : null;

  const brandChart = data?.brandProfit?.length ? {
    series: [{ name: 'Kâr Marjı %', data: data.brandProfit.slice(0, 10).map(b => ({ x: b.brand || 'N/A', y: Number(b.marginPercent) || 0 })) }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 300 },
      plotOptions: { bar: { borderRadius: 6, horizontal: true, barHeight: '55%' } },
      xaxis: { ...chartBase.xaxis },
      colors: ['#22c55e'],
      yaxis: { labels: { style: { colors: '#94a3b8', fontFamily: 'Futura PT' } } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => v.toFixed(1) + '%' } },
    }
  } : null;

  const scatterData = data?.productProfit?.filter(p => Number(p.totalSold) > 0) || [];
  const marginVsVolumeChart = scatterData.length ? {
    series: [{
      name: 'Ürünler',
      data: scatterData.slice(0, 50).map(p => ({
        x: Number(p.totalSold) || 0,
        y: Number(p.marginPercent) || 0,
        name: p.product_name
      }))
    }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'scatter', height: 320 },
      xaxis: { ...chartBase.xaxis, title: { text: 'Satış Adedi', style: { color: '#94a3b8', fontFamily: 'Futura PT' } } },
      yaxis: { ...chartBase.yaxis, title: { text: 'Kâr Marjı (%)', style: { color: '#94a3b8', fontFamily: 'Futura PT' } } },
      markers: { size: 8, hover: { sizeOffset: 3 } },
      colors: ['#22c55e'],
      tooltip: {
        ...chartBase.tooltip,
        custom: ({ dataPointIndex }) => {
          const p = scatterData[dataPointIndex];
          return `<div style="padding:8px 12px;font-family:Futura PT;font-size:12px">
            <b>${p?.product_name || ''}</b><br/>
            Satış: ${fmt(p?.totalSold)} adet<br/>
            Marj: ${Number(p?.marginPercent || 0).toFixed(1)}%<br/>
            Kâr: ${fmtCur(p?.grossProfit)}
          </div>`;
        }
      },
    }
  } : null;

  const filteredProducts = data?.productProfit?.filter(p => {
    if (search && !p.product_name?.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0)) || [];

  return (
    <div className="animate-fade-in">
      <div className="filter-bar">
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e => updateFilter('startDate', e.target.value)} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e => updateFilter('endDate', e.target.value)} /></div>
        {activeFilters.length > 0 && <button className="btn btn-sm btn-secondary" onClick={resetFilters} style={{ marginLeft: 'auto' }}><X size={14} /> Temizle</button>}
      </div>

      {/* Summary KPIs */}
      {data?.summary && (
        <div className="kpi-grid">
          {[
            { label: 'Toplam Gelir', value: fmtCur(data.summary.totalRevenue), color: 'blue' },
            { label: 'Toplam Maliyet', value: fmtCur(data.summary.totalCost), color: 'amber' },
            { label: 'Brüt Kâr', value: fmtCur(data.summary.totalProfit), color: 'green' },
            { label: 'Genel Kâr Marjı', value: Number(data.summary.overallMargin).toFixed(1) + '%', color: Number(data.summary.overallMargin) > 30 ? 'green' : 'amber' },
            { label: 'Negatif Marjlı Ürün', value: data.negativeMargin?.length || 0, color: 'rose' },
          ].map((k, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-card-label">{k.label}</div>
              <div className="kpi-card-value">{loading ? <div className="skeleton" style={{ width: 120, height: 32 }} /> : k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'products', 'alerts'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'overview' ? 'Genel Kârlılık' : t === 'products' ? 'Ürün Detay' : 'Uyarılar'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="charts-grid">
          {categoryChart && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kategori Bazlı Kârlılık</div></div>
              <Chart options={categoryChart.options} series={categoryChart.series} type="bar" height={300} />
            </div>
          )}
          {brandChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Marka Bazlı Kâr Marjı (%)</div></div>
              <Chart options={brandChart.options} series={brandChart.series} type="bar" height={300} />
            </div>
          )}
          {marginVsVolumeChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kâr Marjı vs Satış Hacmi</div></div>
              <Chart options={marginVsVolumeChart.options} series={marginVsVolumeChart.series} type="scatter" height={320} />
            </div>
          )}

          {/* Brand profitability table */}
          {data?.brandProfit?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Marka Kârlılık Detayı</div></div>
              <table className="data-table">
                <thead><tr><th>Marka</th><th>Gelir</th><th>Maliyet</th><th>Kâr</th><th>Marj %</th><th>Satış Adedi</th><th>Sipariş</th></tr></thead>
                <tbody>
                  {data.brandProfit.map((b, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-purple">{b.brand || 'N/A'}</span></td>
                      <td>{fmtCur(b.revenue)}</td>
                      <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(b.cost)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtCur(b.profit)}</td>
                      <td style={{ fontWeight: 700, color: Number(b.marginPercent) > 30 ? 'var(--accent-green)' : Number(b.marginPercent) > 15 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                        {Number(b.marginPercent).toFixed(1)}%
                      </td>
                      <td>{fmt(b.totalSold)}</td>
                      <td>{fmt(b.orderCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input className="input" placeholder="Ürün ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
            <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ minWidth: 180 }}>
              <option value="grossProfit">Kâra Göre</option>
              <option value="marginPercent">Marj %'ye Göre</option>
              <option value="totalRevenue">Gelire Göre</option>
              <option value="totalSold">Satış Adedine Göre</option>
            </select>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Ürün Bazlı Kârlılık ({filteredProducts.length} ürün)</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>#</th><th>SKU</th><th>Ürün</th><th>Marka</th><th>Kategori</th><th>Fiyat</th><th>Maliyet</th><th>Satış</th><th>Gelir</th><th>Kâr</th><th>Marj %</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Yükleniyor...</td></tr>
                  ) : filteredProducts.slice(0, 50).map((p, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.sku}</td>
                      <td style={{ fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</td>
                      <td><span className="badge badge-purple">{p.brand}</span></td>
                      <td><span className="badge badge-blue">{p.category}</span></td>
                      <td>{fmtCur(p.price)}</td>
                      <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(p.cost_price)}</td>
                      <td>{fmt(p.totalSold)}</td>
                      <td>{fmtCur(p.totalRevenue)}</td>
                      <td style={{ color: Number(p.grossProfit) >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', fontWeight: 600 }}>{fmtCur(p.grossProfit)}</td>
                      <td style={{ fontWeight: 700, color: Number(p.marginPercent) > 30 ? 'var(--accent-green)' : Number(p.marginPercent) > 15 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                        {Number(p.marginPercent).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          {data?.negativeMargin?.length > 0 ? (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} style={{ color: 'var(--accent-rose)' }} />
                  <div className="card-title">Negatif Marjlı Ürünler ({data.negativeMargin.length})</div>
                </div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Bu ürünlerin satış fiyatı maliyet fiyatının altında. Her satışta zarar edilmektedir.</p>
                <table className="data-table">
                  <thead><tr><th>SKU</th><th>Ürün</th><th>Marka</th><th>Kategori</th><th>Fiyat</th><th>Maliyet</th><th>Birim Zarar</th><th>Marj %</th></tr></thead>
                  <tbody>
                    {data.negativeMargin.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{p.sku}</td>
                        <td style={{ fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</td>
                        <td><span className="badge badge-purple">{p.brand}</span></td>
                        <td>{p.category}</td>
                        <td>{fmtCur(p.price)}</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(p.cost_price)}</td>
                        <td style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{fmtCur(p.unitProfit)}</td>
                        <td style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{Number(p.marginPercent).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h3>Negatif Marjlı Ürün Bulunamadı</h3>
              <p style={{ color: 'var(--text-muted)' }}>Tüm aktif ürünler pozitif kâr marjına sahip.</p>
            </div></div>
          )}
        </div>
      )}
    </div>
  );
}
