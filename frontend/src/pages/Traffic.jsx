import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { Filter, X, Globe, Map, Target } from 'lucide-react';

const fmt = n => n == null ? '0' : Number(n) >= 1e6 ? (n/1e6).toFixed(1)+'M' : Number(n) >= 1e3 ? (n/1e3).toFixed(1)+'K' : Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺' + Number(n||0).toLocaleString('tr-TR', {minimumFractionDigits:0,maximumFractionDigits:0});
const fmtPct = n => (Number(n||0)*100).toFixed(1) + '%';

const chartBase = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', fontFamily: 'Futura PT, sans-serif', toolbar: { show: false } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
  xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } }, axisBorder: { color: 'rgba(255,255,255,0.08)' }, axisTicks: { color: 'rgba(255,255,255,0.08)' } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } } },
  tooltip: { theme: 'dark', style: { fontFamily: 'Futura PT' } },
  legend: { labels: { colors: '#94a3b8' }, fontFamily: 'Futura PT', fontSize: '12px' },
  colors: ['#E30613', '#ff2d3b', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

export default function Traffic() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  useEffect(() => { loadData(); }, [filters]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await kpiAPI.traffic(filters);
      setData(d);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const sessionsTrendChart = data?.dailyTrend?.length ? {
    series: [
      { name: 'Oturumlar', data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.sessions)||0 })) },
      { name: 'Kullanıcılar', data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.users)||0 })) },
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'area', height: 300 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } } }
  } : null;

  const engagementTrendChart = data?.dailyTrend?.length ? {
    series: [
      { name: 'Engagement Rate', data: data.dailyTrend.map(d => ({ x: d.date, y: Number((Number(d.engagementRate||0)*100).toFixed(2)) })) },
      { name: 'Bounce Rate', data: data.dailyTrend.map(d => ({ x: d.date, y: Number((Number(d.bounceRate||0)*100).toFixed(2)) })) },
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'area', height: 280 },
      colors: ['#22c55e', '#ef4444'],
      fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => v + '%' } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => v + '%' } } }
  } : null;

  const channelBarChart = data?.channelDist?.length ? {
    series: [
      { name: 'Oturumlar', type: 'column', data: data.channelDist.slice(0, 8).map(d => ({ x: d.channel || 'N/A', y: Number(d.sessions)||0 })) },
      { name: 'Gelir', type: 'line', data: data.channelDist.slice(0, 8).map(d => ({ x: d.channel || 'N/A', y: Number(d.revenue)||0 })) },
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'line', height: 320 },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '40%' } },
      colors: ['#06b6d4', '#E30613'],
      yaxis: [
        { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmt(v) } },
        { ...chartBase.yaxis, opposite: true, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } }
      ],
      tooltip: { ...chartBase.tooltip, shared: true, intersect: false, y: { formatter: (v, {seriesIndex}) => seriesIndex === 0 ? fmt(v) : fmtCur(v) } }
    }
  } : null;

  const newVsReturningChart = data?.userType?.length ? {
    series: data.userType.map(d => Number(d.sessions)||0),
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 280 },
      labels: data.userType.map(d => d.userType === 'new' ? 'Yeni' : 'Geri Dönen'),
      colors: ['#E30613','#f59e0b'], stroke: { colors: ['#0c0c0e'], width: 2 },
      plotOptions: { pie: { donut: { size: '65%' } } } }
  } : null;

  const sourceMediumBubbleChart = data?.sourceMediumDist?.length ? {
    series: [{
      name: 'Kaynak/Araç',
      data: data.sourceMediumDist.map(d => ({
        x: Number((Number(d.engagementRate||0)*100).toFixed(1)),
        y: Number(d.conversions||0),
        z: Math.max(10, Math.sqrt(Number(d.sessions||0))),
        details: d
      }))
    }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bubble', height: 340 },
      xaxis: { ...chartBase.xaxis, title: { text: 'Engagement Rate (%)', style: { color: '#64748b' } } },
      yaxis: { ...chartBase.yaxis, title: { text: 'Dönüşüm Sayısı', style: { color: '#64748b' } } },
      tooltip: {
        theme: 'dark',
        custom: function({series, seriesIndex, dataPointIndex, w}) {
          const item = w.globals.initialSeries[seriesIndex].data[dataPointIndex].details;
          return `<div class="p-3" style="font-family: Futura PT; background: var(--bg-glass);">
            <div style="font-weight:600;margin-bottom:4px;">${item.sourceMedium}</div>
            <div style="font-size:12px;color:#94a3b8">Oturum: <strong style="color:#f1f5f9">${fmt(item.sessions)}</strong></div>
            <div style="font-size:12px;color:#94a3b8">Kullanıcı: <strong style="color:#f1f5f9">${fmt(item.users)}</strong></div>
            <div style="font-size:12px;color:#94a3b8">Etkileşim: <strong style="color:#22c55e">${fmtPct(item.engagementRate)}</strong></div>
            <div style="font-size:12px;color:#94a3b8">Dönüşüm: <strong style="color:#f1f5f9">${fmt(item.conversions)}</strong></div>
            <div style="font-size:12px;color:#94a3b8">Gelir: <strong style="color:#06b6d4">${fmtCur(item.revenue)}</strong></div>
          </div>`;
        }
      },
      colors: ['#06b6d4'], fill: { type: 'solid', opacity: 0.7 }
    }
  } : null;

  const kpis = data?.dailyTrend ? [
    { label: 'Toplam Oturum', value: fmt(data.dailyTrend.reduce((s,d)=>s+Number(d.sessions||0),0)) },
    { label: 'Toplam Kullanıcı', value: fmt(data.dailyTrend.reduce((s,d)=>s+Number(d.users||0),0)) },
    { label: 'Yeni Kullanıcı (Gelişim)', value: fmt(data.dailyTrend.reduce((s,d)=>s+Number(d.newUsers||0),0)) },
    { label: 'Ort. Engagement Rate', value: fmtPct(data.dailyTrend.reduce((s,d)=>s+Number(d.engagementRate||0),0)/Math.max(data.dailyTrend.length,1)) },
    { label: 'Ort. Bounce Rate', value: fmtPct(data.dailyTrend.reduce((s,d)=>s+Number(d.bounceRate||0),0)/Math.max(data.dailyTrend.length,1)) },
    { label: 'Oturum Ort. Süresi', value: (data.dailyTrend.reduce((s,d)=>s+Number(d.avgDuration||0),0)/Math.max(data.dailyTrend.length,1)).toFixed(0) + 's' },
  ] : [];

  return (
    <div className="animate-fade-in">
      <div className="filter-bar">
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e=>updateFilter('startDate',e.target.value)} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e=>updateFilter('endDate',e.target.value)} /></div>
        {activeFilters.length>0 && <button className="btn btn-sm btn-secondary" onClick={resetFilters} style={{marginLeft:'auto'}}><X size={14} />Temizle</button>}
      </div>

      <div className="kpi-grid">
        {kpis.map((k,i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-card-label">{k.label}</div>
            <div className="kpi-card-value">{loading ? <div className="skeleton" style={{width:120,height:32}} /> : k.value}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {['overview', 'channels', 'sourcemedium', 'cities'].map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {t==='overview'?'Genel Bakış':t==='channels'?'Kanal Grubu Analizi':t==='sourcemedium'?'Source / Medium Detay':'Şehir Analizi'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="charts-grid">
          {sessionsTrendChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Oturum & Kullanıcı Trendi</div></div>
            <Chart options={sessionsTrendChart.options} series={sessionsTrendChart.series} type="area" height={300} />
          </div>}

          {engagementTrendChart && <div className="chart-card">
            <div className="chart-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={16} style={{ color: 'var(--accent-green)' }} /><div className="chart-card-title">Etkileşim (Engagement) vs Hemen Çıkma (Bounce)</div>
              </div>
            </div>
            <Chart options={engagementTrendChart.options} series={engagementTrendChart.series} type="area" height={280} />
          </div>}

          {newVsReturningChart && <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Yeni vs Geri Dönen Kullanıcı</div></div>
            <Chart options={newVsReturningChart.options} series={newVsReturningChart.series} type="donut" height={280} />
          </div>}
        </div>
      )}

      {activeTab === 'channels' && data?.channelDist && (
        <div className="charts-grid">
          {channelBarChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Kanal Grubu Performansı</div></div>
            <Chart options={channelBarChart.options} series={channelBarChart.series} type="bar" height={300} />
          </div>}
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Kanal Detay Tablosu</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Kanal</th><th>Oturumlar</th><th>Kullanıcılar</th><th>Dönüşüm</th><th>Gelir</th></tr></thead>
                <tbody>
                  {data.channelDist.map((c,i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600}}><span className="badge badge-blue">{c.channel||'N/A'}</span></td>
                      <td>{fmt(c.sessions)}</td><td>{fmt(c.users)}</td>
                      <td>{fmt(c.conversions)}</td>
                      <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sourcemedium' && data?.sourceMediumDist && (
        <div className="charts-grid">
          {sourceMediumBubbleChart && <div className="chart-card full-width">
            <div className="chart-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={16} /><div className="chart-card-title">Source / Medium: Etkileşim × Dönüşüm (Balon Büyüklüğü: Oturum)</div>
              </div>
            </div>
            <Chart options={sourceMediumBubbleChart.options} series={sourceMediumBubbleChart.series} type="bubble" height={340} />
          </div>}
          
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Tüm Source / Medium Kırılımları</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Source / Medium</th><th>Oturum</th><th>Kullanıcı</th><th>Engagement Rate</th><th>Bounce Rate</th><th>Dönüşüm</th><th>Gelir</th></tr></thead>
                <tbody>
                  {data.sourceMediumDist.map((s, i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{s.sourceMedium}</td>
                      <td>{fmt(s.sessions)}</td>
                      <td>{fmt(s.users)}</td>
                      <td style={{ color: Number(s.engagementRate) > 0.5 ? 'var(--accent-green)' : 'inherit', fontWeight: 500 }}>{fmtPct(s.engagementRate)}</td>
                      <td>{fmtPct(s.bounceRate)}</td>
                      <td>{fmt(s.conversions)}</td>
                      <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cities' && data?.topCities && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Map size={16} /><div className="card-title">Şehir Bazlı Performans</div>
            </div>
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead><tr><th>#</th><th>Şehir</th><th>Oturumlar</th><th>Kullanıcılar</th><th>Gelir</th></tr></thead>
              <tbody>
                {data.topCities.map((c,i) => (
                  <tr key={i}>
                    <td style={{color:'var(--text-muted)'}}>{i+1}</td>
                    <td style={{fontWeight:600}}>{c.city||'Bilinmeyen'}</td>
                    <td>{fmt(c.sessions)}</td><td>{fmt(c.users)}</td>
                    <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
