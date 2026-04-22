import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { Filter, X, Smartphone, Monitor } from 'lucide-react';

const fmt = n => n==null?'0':Number(n)>=1e6?(n/1e6).toFixed(1)+'M':Number(n)>=1e3?(n/1e3).toFixed(1)+'K':Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺'+Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0});

const chartBase = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', fontFamily: 'Futura PT, sans-serif', toolbar: { show: false } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
  xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } }, axisBorder: { color: 'rgba(255,255,255,0.08)' }, axisTicks: { color: 'rgba(255,255,255,0.08)' } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } } },
  tooltip: { theme: 'dark', style: { fontFamily: 'Futura PT' } },
  legend: { labels: { colors: '#94a3b8' }, fontFamily: 'Futura PT', fontSize: '12px' },
  colors: ['#E30613', '#ff2d3b', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7', '#3b82f6'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

export default function Ads() {
  const [data, setData] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [main, breakws, budget] = await Promise.all([
        kpiAPI.ads(filters),
        kpiAPI.metaBreakdowns(filters),
        kpiAPI.budgetTracking(filters)
      ]);
      setData(main.data);
      setBreakdownData(breakws.data);
      setBudgetData(budget.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const metaSpendChart = data?.metaDaily?.length ? {
    series: [
      { name: 'Harcama', data: data.metaDaily.map(d => ({ x: d.date, y: Number(d.spend)||0 })) },
      { name: 'Dönüşüm Değeri', data: data.metaDaily.map(d => ({ x: d.date, y: Number(d.conversionValue)||0 })) },
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'line', height: 280 },
      colors: ['#3b82f6', '#22c55e'],
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } } }
  } : null;

  const googleSpendChart = data?.googleDaily?.length ? {
    series: [
      { name: 'Harcama', data: data.googleDaily.map(d => ({ x: d.date, y: Number(d.spend)||0 })) },
      { name: 'Dönüşüm Değeri', data: data.googleDaily.map(d => ({ x: d.date, y: Number(d.conversionValue)||0 })) },
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'line', height: 280 },
      colors: ['#06b6d4', '#22c55e'],
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } } }
  } : null;

  const roasTrendChart = data?.metaDaily?.length ? {
    series: [
      { name: 'Meta ROAS', data: data.metaDaily.map(d => ({ x: d.date, y: Number(d.roas||0).toFixed(2) })) },
      ...(data.googleDaily?.length ? [{ name: 'Google ROAS', data: data.googleDaily.map(d => ({ x: d.date, y: Number(d.roas||0).toFixed(2) })) }] : []),
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'area', height: 280 },
      colors: ['#3b82f6', '#06b6d4'],
      fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => v + 'x' } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => v + 'x' } } }
  } : null;

  const platformCompChart = data?.platformComparison ? {
    series: [{ 
      name: 'Harcama', 
      data: data.platformComparison.map(p => ({ x: p?.platform || 'N/A', y: Number(p?.spend||0) })) 
    }],
    options: { 
      ...chartBase, 
      chart: { ...chartBase.chart, type: 'bar', height: 220 },
      plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: true, barHeight: '50%' } },
      colors: ['#3b82f6', '#06b6d4'],
      legend: { show: false },
      dataLabels: { enabled: true, formatter: v => fmtCur(v), style: { fontSize: '11px', fontFamily: 'Futura PT', colors: ['#fff'] } },
      yaxis: { ...chartBase.yaxis },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } } 
    }
  } : null;

  const metaDeviceChart = breakdownData?.deviceDist?.length ? {
    series: breakdownData.deviceDist.map(d => Number(d.spend)||0),
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 260 },
      labels: breakdownData.deviceDist.map(d => d.device || 'N/A'),
      colors: ['#8b5cf6', '#d946ef', '#f43f5e'],
      plotOptions: { pie: { donut: { size: '65%' } } } }
  } : null;

  const metaPlatformChart = breakdownData?.platformDist?.length ? {
    series: breakdownData.platformDist.map(d => Number(d.spend)||0),
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 260 },
      labels: breakdownData.platformDist.map(d => d.platform || 'N/A'),
      colors: ['#3b82f6', '#ec4899', '#f59e0b', '#06b6d4'],
      plotOptions: { pie: { donut: { size: '65%' } } } }
  } : null;

  return (
    <div className="animate-fade-in">
      <div className="filter-bar">
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e=>updateFilter('startDate',e.target.value)} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e=>updateFilter('endDate',e.target.value)} /></div>
        {activeFilters.length>0 && <button className="btn btn-sm btn-secondary" onClick={resetFilters} style={{marginLeft:'auto'}}><X size={14} />Temizle</button>}
      </div>

      {data?.platformComparison && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {data.platformComparison.filter(p => p).map((p, i) => (
            <div key={i} className="kpi-card" style={{ borderLeft: `4px solid ${p.platform.toLowerCase() === 'meta' ? '#3b82f6' : '#06b6d4'}` }}>
              <div className="kpi-card-label">{p.platform} Harcama</div>
              <div className="kpi-card-value">{fmtCur(p.spend)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                ROAS: <strong style={{ color: Number(p.conversionValue) > 0 && Number(p.spend) > 0 ? 'var(--accent-green)' : 'inherit' }}>
                  {(Number(p.spend||1) > 0 ? Number(p.conversionValue||0)/Number(p.spend) : 0).toFixed(2)}x
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {['overview','meta','google'].map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {t==='overview'?'Platform Karşılaştırma & Bütçe':t==='meta'?'Meta Ads Detayları':'Google Ads Detayları'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="charts-grid">
          {roasTrendChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">ROAS Trendi (Meta vs Google)</div></div>
            <Chart options={roasTrendChart.options} series={roasTrendChart.series} type="area" height={280} />
          </div>}

          {platformCompChart && <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Toplam Harcama Karşılaştırma</div></div>
            <Chart options={platformCompChart.options} series={platformCompChart.series} type="bar" height={220} />
          </div>}

          {budgetData?.campaigns?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kampanya Bütçe Kullanımı</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>Kampanya</th><th>Platform</th><th>Durum</th><th>Bütçe</th><th>Harcama</th><th>ROAS</th><th>Kullanım</th><th style={{width: 100}}>Bar</th></tr></thead>
                  <tbody>
                    {budgetData.campaigns.slice(0, 15).map((b, i) => {
                      const util = b.total_budget > 0 ? ((b.actualSpend || 0) / b.total_budget * 100) : 0;
                      const roas = b.actualSpend > 0 ? ((b.totalConvValue || 0) / b.actualSpend) : 0;
                      const color = util > 100 ? 'var(--accent-rose)' : util > 80 ? 'var(--accent-amber)' : 'var(--accent-green)';
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{b.campaign_name}</td>
                          <td><span className={`badge ${b.platform === 'meta' ? 'badge-blue' : 'badge-cyan'}`}>{b.platform}</span></td>
                          <td><span className={`badge ${b.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{b.status}</span></td>
                          <td>{fmtCur(b.total_budget)}</td>
                          <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(b.actualSpend)}</td>
                          <td style={{ fontWeight: 700, color: roas > 2 ? 'var(--accent-green)' : 'inherit' }}>{roas.toFixed(2)}x</td>
                          <td style={{ fontWeight: 700, color }}>{util.toFixed(1)}%</td>
                          <td>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className="progress-bar-fill" style={{ width: `${Math.min(100, util)}%`, background: color }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'meta' && (
        <div className="charts-grid">
          {metaSpendChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Meta Ads — Günlük Harcama & Dönüşüm Değeri</div></div>
            <Chart options={metaSpendChart.options} series={metaSpendChart.series} type="line" height={280} />
          </div>}

          {metaPlatformChart && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Facebook size={16} /><Instagram size={16} />
                  <div className="chart-card-title">Ağ Dağılımı (Harcama)</div>
                </div>
              </div>
              <Chart options={metaPlatformChart.options} series={metaPlatformChart.series} type="donut" height={260} />
            </div>
          )}

          {metaDeviceChart && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Smartphone size={16} /><Monitor size={16} />
                  <div className="chart-card-title">Cihaz Dağılımı (Harcama)</div>
                </div>
              </div>
              <Chart options={metaDeviceChart.options} series={metaDeviceChart.series} type="donut" height={260} />
            </div>
          )}

          {breakdownData?.positionDist?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Pozisyon (Yerleşim) Başına Performans</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>Yerleşim (Position)</th><th>Gösterim</th><th>Tıklama</th><th>Harcama</th><th>CTR</th></tr></thead>
                  <tbody>
                    {breakdownData.positionDist.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{p.position}</td>
                        <td>{fmt(p.impressions)}</td>
                        <td>{fmt(p.clicks)}</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(p.spend)}</td>
                        <td style={{ fontWeight: 600 }}>{Number(p.ctr).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Meta Ads Günlük Detay</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Tarih</th><th>Gösterim</th><th>Tıklama</th><th>Harcama</th><th>Dönüşüm</th><th>Dön. Değer</th><th>ROAS</th><th>CTR</th></tr></thead>
                <tbody>
                  {data?.metaDaily?.slice(0,20).map((r,i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>{fmt(r.impressions)}</td><td>{fmt(r.clicks)}</td>
                      <td style={{color:'var(--accent-amber)'}}>{fmtCur(r.spend)}</td>
                      <td>{fmt(r.conversions)}</td>
                      <td style={{color:'var(--accent-green)', fontWeight: 600}}>{fmtCur(r.conversionValue)}</td>
                      <td style={{fontWeight:700, color: Number(r.roas||0)>2?'var(--accent-green)':Number(r.roas||0)>1?'var(--accent-amber)':'var(--accent-rose)'}}>{Number(r.roas||0).toFixed(2)}x</td>
                      <td>{Number(r.ctr||0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'google' && (
        <div className="charts-grid">
          {googleSpendChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Google Ads — Günlük Harcama & Dönüşüm Değeri</div></div>
            <Chart options={googleSpendChart.options} series={googleSpendChart.series} type="line" height={280} />
          </div>}

          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Google Ads Detay</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Tarih</th><th>Gösterim</th><th>Tıklama</th><th>Harcama</th><th>Dönüşüm</th><th>Dön. Değer</th><th>ROAS</th><th>CTR</th></tr></thead>
                <tbody>
                  {data?.googleDaily?.slice(0,20).map((r,i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>{fmt(r.impressions)}</td><td>{fmt(r.clicks)}</td>
                      <td style={{color:'var(--accent-amber)'}}>{fmtCur(r.spend)}</td>
                      <td>{fmt(r.conversions)}</td>
                      <td style={{color:'var(--accent-green)', fontWeight: 600}}>{fmtCur(r.conversionValue)}</td>
                      <td style={{fontWeight:700, color: Number(r.roas||0)>2?'var(--accent-green)':Number(r.roas||0)>1?'var(--accent-amber)':'var(--accent-rose)'}}>{Number(r.roas||0).toFixed(2)}x</td>
                      <td>{Number(r.ctr||0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
