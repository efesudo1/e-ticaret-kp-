import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Activity,
  DollarSign, ShoppingCart, Users, Target, Percent, Filter, X, BarChart3, Zap
} from 'lucide-react';

const fmt = n => n == null ? '0' : Number(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Number(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺' + Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = n => (Number(n || 0)).toFixed(1) + '%';

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

const HealthGauge = ({ score, label }) => {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#E30613';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize="20" fontWeight="700" fontFamily="Futura PT">{score}</text>
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
};

const ChangeIndicator = ({ value, suffix = '%' }) => {
  const v = Number(value || 0);
  const isPositive = v >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 12, fontWeight: 600,
      color: isPositive ? 'var(--accent-green)' : 'var(--accent-rose)',
      background: isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(227,6,19,0.1)',
      padding: '2px 8px', borderRadius: 12
    }}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {isPositive ? '+' : ''}{v.toFixed(1)}{suffix}
    </span>
  );
};

export default function ExecutiveSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await kpiAPI.executiveSummary(filters);
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const weeklyChart = data?.weeklyTrend?.length ? {
    series: [
      { name: 'Gelir', data: data.weeklyTrend.map(w => ({ x: w.weekStart, y: Number(w.revenue) || 0 })) },
      { name: 'Net Gelir', data: data.weeklyTrend.map(w => ({ x: w.weekStart, y: Number(w.netRevenue) || 0 })) },
    ],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'area', height: 280 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } },
      colors: ['#22c55e', '#06b6d4'],
    }
  } : null;

  const weeklyOrdersChart = data?.weeklyTrend?.length ? {
    series: [{ name: 'Sipariş', data: data.weeklyTrend.map(w => ({ x: w.weekStart, y: Number(w.orders) || 0 })) }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 220 },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      colors: ['#E30613'],
    }
  } : null;

  const channelChart = data?.channelWaterfall?.length ? {
    series: [{ name: 'Gelir', data: data.channelWaterfall.map(c => Number(c.revenue) || 0) }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      plotOptions: { bar: { borderRadius: 6, horizontal: true, barHeight: '55%' } },
      xaxis: { ...chartBase.xaxis, categories: data.channelWaterfall.map(c => c.channel || 'N/A') },
      colors: ['#E30613'],
      fill: { type: 'gradient', gradient: { shade: 'dark', type: 'horizontal', shadeIntensity: 0.3, opacityFrom: 1, opacityTo: 0.7 } },
      yaxis: { labels: { style: { colors: '#94a3b8', fontFamily: 'Futura PT' } } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } },
    }
  } : null;

  const budgetData = data?.budgetVsActual?.filter(b => b.total_budget > 0) || [];

  return (
    <div className="animate-fade-in">
      {/* Filter Bar */}
      <div className="filter-bar">
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e => updateFilter('startDate', e.target.value)} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e => updateFilter('endDate', e.target.value)} /></div>
        {activeFilters.length > 0 && <button className="btn btn-sm btn-secondary" onClick={resetFilters} style={{ marginLeft: 'auto' }}><X size={14} /> Temizle</button>}
      </div>

      {/* Health Scores */}
      {data?.healthScores && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Zap size={18} style={{ color: 'var(--accent-amber)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>İş Sağlığı Skoru</h3>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 24 }}>
              <HealthGauge score={data.healthScores.trafficScore} label="Trafik Skoru" />
              <HealthGauge score={data.healthScores.salesScore} label="Satış Skoru" />
              <HealthGauge score={data.healthScores.marketingScore} label="Pazarlama Skoru" />
              <HealthGauge score={Math.round((data.healthScores.trafficScore + data.healthScores.salesScore + data.healthScores.marketingScore) / 3)} label="Genel Skor" />
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards with Change Indicators */}
      {data && !loading ? (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[
            { label: 'Toplam Oturum', value: fmt(data.current?.traffic?.totalSessions), change: data.changes?.sessions, icon: Users, color: 'blue' },
            { label: 'Toplam Sipariş', value: fmt(data.current?.sales?.totalOrders), change: data.changes?.orders, icon: ShoppingCart, color: 'cyan' },
            { label: 'Toplam Gelir', value: fmtCur(data.current?.sales?.totalRevenue), change: data.changes?.revenue, icon: DollarSign, color: 'green' },
            { label: 'Reklam Harcama', value: fmtCur(data.current?.combinedAds?.totalSpend), change: data.changes?.adSpend, icon: TrendingUp, color: 'amber' },
            { label: 'ROAS', value: (data.current?.combinedAds?.overallRoas || 0).toFixed(2) + 'x', change: data.changes?.roas, icon: Target, color: 'rose' },
            { label: 'Dönüşüm Oranı', value: fmtPct(data.derivedKpis?.currentCVR * 100), change: data.derivedKpis?.cvrChange, icon: Percent, color: 'purple' },
            { label: 'Ort. Sipariş Değeri', value: fmtCur(data.derivedKpis?.currentAOV), change: data.derivedKpis?.aovChange, icon: BarChart3, color: 'blue' },
            { label: 'Sepet Dönüşüm', value: fmtPct(data.derivedKpis?.cartRate * 100), change: data.derivedKpis?.cartRateChange, icon: Activity, color: 'green' },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="kpi-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className={`kpi-card-icon ${card.color}`}><Icon size={20} /></div>
                  {card.change !== undefined && <ChangeIndicator value={card.change} />}
                </div>
                <div className="kpi-card-label" style={{ marginTop: 12 }}>{card.label}</div>
                <div className="kpi-card-value">{card.value}</div>
              </div>
            );
          })}
        </div>
      ) : loading ? (
        <div className="kpi-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="kpi-card"><div className="skeleton" style={{ width: 44, height: 44, marginBottom: 16 }} /><div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 12 }} /><div className="skeleton" style={{ width: '80%', height: 28 }} /></div>
          ))}
        </div>
      ) : null}

      {/* Charts */}
      {!loading && data && (
        <div className="charts-grid" style={{ marginTop: 24 }}>
          {/* Weekly Revenue Trend */}
          {weeklyChart && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Haftalık Gelir Trendi (Son 12 Hafta)</div></div>
              <Chart options={weeklyChart.options} series={weeklyChart.series} type="area" height={280} />
            </div>
          )}

          {/* Channel Waterfall */}
          {channelChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Gelir Dağılımı</div></div>
              <Chart options={channelChart.options} series={channelChart.series} type="bar" height={280} />
            </div>
          )}

          {/* Weekly Orders */}
          {weeklyOrdersChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Haftalık Sipariş Trendi</div></div>
              <Chart options={weeklyOrdersChart.options} series={weeklyOrdersChart.series} type="bar" height={220} />
            </div>
          )}

          {/* Budget vs Actual */}
          {budgetData.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Bütçe vs Gerçek Harcama</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>Kampanya</th><th>Platform</th><th>Durum</th><th>Bütçe</th><th>Harcama</th><th>Kullanım</th><th style={{ width: 120 }}>Bütçe Durumu</th></tr></thead>
                  <tbody>
                    {budgetData.slice(0, 15).map((b, i) => {
                      const pct = Number(b.utilizationPct || 0);
                      const color = pct > 100 ? 'var(--accent-rose)' : pct > 80 ? 'var(--accent-amber)' : 'var(--accent-green)';
                      return (
                        <tr key={i}>
                          <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{b.campaign_name}</td>
                          <td><span className={`badge ${b.platform === 'meta' ? 'badge-blue' : 'badge-green'}`}>{b.platform}</span></td>
                          <td><span className={`badge ${b.status === 'active' ? 'badge-green' : b.status === 'paused' ? 'badge-amber' : 'badge-rose'}`}>{b.status}</span></td>
                          <td>{fmtCur(b.total_budget)}</td>
                          <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(b.actualSpend)}</td>
                          <td style={{ fontWeight: 700, color }}>{pct.toFixed(1)}%</td>
                          <td>
                            <div className="progress-bar" style={{ width: 100 }}>
                              <div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
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

          {/* Gross Profit Margin */}
          {data.derivedKpis?.grossMargin > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Brüt Kâr Marjı</div></div>
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: data.derivedKpis.grossMargin > 30 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  %{(data.derivedKpis.grossMargin * 100).toFixed(1)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Brüt Kâr Marjı</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>(Gelir - Ürün Maliyeti) / Gelir</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
