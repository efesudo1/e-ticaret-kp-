import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { kpiAPI, filterAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import {
  Users, ShoppingCart, TrendingUp, DollarSign, Eye, MousePointerClick,
  Target, Percent, ArrowUpRight, ArrowDownRight, Filter, X, Upload, Activity,
  UserPlus, RefreshCcw
} from 'lucide-react';

const formatNumber = (n) => {
  if (isNaN(n) || n === null || n === undefined) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Number(n).toLocaleString('tr-TR');
};

const formatCurrency = (n) => {
  if (isNaN(n) || n === null || n === undefined) return '₺0';
  return '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatPercent = (n) => {
  if (isNaN(n) || n === null || n === undefined) return '%0';
  return '%' + (Number(n) * 100).toFixed(1);
};

const chartTheme = {
  theme: { mode: 'dark' },
  chart: {
    background: 'transparent',
    fontFamily: 'Futura PT, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false }
  },
  grid: {
    borderColor: 'rgba(255,255,255,0.06)',
    strokeDashArray: 4,
  },
  xaxis: {
    labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } },
    axisBorder: { color: 'rgba(255,255,255,0.08)' },
    axisTicks: { color: 'rgba(255,255,255,0.08)' },
  },
  yaxis: {
    labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } },
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Futura PT' },
    y: { formatter: (val) => formatNumber(val) },
  },
  legend: {
    labels: { colors: '#94a3b8' },
    fontFamily: 'Futura PT',
    fontSize: '12px',
  },
  colors: ['#E30613', '#ff2d3b', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

const ChangeIndicator = ({ value, inverse = false }) => {
  const v = Number(value || 0);
  const isPositive = v >= 0;
  // If inverse is true, positive change is bad (red), negative change is good (green)
  let color = isPositive ? 'var(--accent-green)' : 'var(--accent-rose)';
  let bg = isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(227,6,19,0.1)';
  
  if (inverse) {
    color = isPositive ? 'var(--accent-rose)' : 'var(--accent-green)';
    bg = isPositive ? 'rgba(227,6,19,0.1)' : 'rgba(34,197,94,0.1)';
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 600,
      color: color,
      background: bg,
      padding: '2px 6px', borderRadius: 10,
    }}>
      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {isPositive ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [enhanced, setEnhanced] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [sales, setSales] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  useEffect(() => {
    loadData();
  }, [filters]);

  useEffect(() => {
    filterAPI.options().then(r => setFilterOptions(r.data)).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enhancedRes, trafficRes, salesRes] = await Promise.all([
        kpiAPI.enhancedSummary(filters),
        kpiAPI.traffic(filters),
        kpiAPI.sales(filters),
      ]);
      setEnhanced(enhancedRes.data);
      setTraffic(trafficRes.data);
      setSales(salesRes.data);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const summary = enhanced?.current;
  const changes = enhanced?.changes;
  const derived = enhanced?.derivedKpis;

  const kpiCards = summary ? [
    { label: 'Toplam Oturum', value: formatNumber(summary.traffic?.totalSessions), icon: Users, color: 'blue', change: changes?.sessions, metricType: 'sessions' },
    { label: 'Toplam Kullanıcı', value: formatNumber(summary.traffic?.totalUsers), icon: Eye, color: 'purple', change: changes?.users, metricType: 'users' },
    { label: 'Toplam Sipariş', value: formatNumber(summary.sales?.totalOrders), icon: ShoppingCart, color: 'cyan', change: changes?.orders, metricType: 'orders' },
    { label: 'Toplam Gelir', value: formatCurrency(summary.sales?.totalRevenue), icon: DollarSign, color: 'green', change: changes?.revenue, metricType: 'revenue' },
    { label: 'Reklam Harcama', value: formatCurrency(summary.combinedAds?.totalSpend), icon: TrendingUp, color: 'amber', change: changes?.adSpend, metricType: 'adspend' },
    { label: 'Genel ROAS', value: (isNaN(summary.combinedAds?.overallRoas) || summary.combinedAds?.overallRoas == null) ? '0.00x' : summary.combinedAds.overallRoas.toFixed(2) + 'x', icon: Target, color: 'rose', change: changes?.roas, metricType: 'roas' },
    { label: 'Dönüşüm Oranı', value: formatPercent(derived?.currentCVR), icon: Percent, color: 'purple', change: derived?.cvrChange, metricType: 'conversion' },
    { label: 'Ort. Sipariş Değeri', value: formatCurrency(derived?.currentAOV), icon: Activity, color: 'green', change: derived?.aovChange, metricType: 'aov' },
    { label: 'Müşteri Edinme Ml. (CAC)', value: formatCurrency(derived?.currentCAC), icon: UserPlus, color: 'rose', change: derived?.cacChange, metricType: 'adspend', inverseFactor: true },
    { label: 'İade Oranı', value: formatPercent(derived?.currentRefundRate), icon: RefreshCcw, color: 'red', change: derived?.refundRateChange, metricType: 'revenue', inverseFactor: true },
  ] : [];

  // Prepare chart data
  const revenueChartData = sales?.dailyRevenue ? {
    series: [{
      name: 'Gelir',
      data: sales.dailyRevenue.map(d => ({ x: d.date, y: Number(d.revenue) || 0 }))
    }, {
      name: 'Net Gelir',
      data: sales.dailyRevenue.map(d => ({ x: d.date, y: Number(d.netRevenue) || 0 }))
    }],
    options: {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'area', height: 300 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 }
      },
      yaxis: { ...chartTheme.yaxis, labels: { ...chartTheme.yaxis.labels, formatter: (v) => formatCurrency(v) } },
      tooltip: { ...chartTheme.tooltip, y: { formatter: (v) => formatCurrency(v) } },
    }
  } : null;

  const channelDonutData = traffic?.channelDist?.length ? {
    series: traffic.channelDist.map(d => Number(d.sessions) || 0),
    options: {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'donut', height: 300 },
      labels: traffic.channelDist.map(d => d.channel || 'Bilinmeyen'),
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Toplam',
                color: '#94a3b8',
                fontFamily: 'Futura PT',
                formatter: (w) => formatNumber(w.globals.seriesTotals.reduce((a, b) => a + b, 0))
              }
            }
          }
        }
      },
      stroke: { colors: ['#0c0c0e'], width: 2 },
    }
  } : null;

  const sessionsTrendData = traffic?.dailyTrend?.length ? {
    series: [{
      name: 'Oturumlar',
      data: traffic.dailyTrend.map(d => ({ x: d.date, y: Number(d.sessions) || 0 }))
    }],
    options: {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'area', height: 300 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 }
      },
      colors: ['#E30613'],
    }
  } : null;

  const deviceDonutData = traffic?.deviceDist?.length ? {
    series: traffic.deviceDist.map(d => Number(d.sessions) || 0),
    options: {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'donut', height: 300 },
      labels: traffic.deviceDist.map(d => d.device || 'Bilinmeyen'),
      colors: ['#E30613', '#ff2d3b', '#f59e0b'],
      plotOptions: {
        pie: { donut: { size: '65%' } }
      },
      stroke: { colors: ['#0c0c0e'], width: 2 },
    }
  } : null;

  const channelRevenueBarData = sales?.channelRevenue?.length ? {
    series: [{
      name: 'Gelir',
      data: sales.channelRevenue.slice(0, 8).map(d => Number(d.revenue) || 0)
    }],
    options: {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'bar', height: 300 },
      plotOptions: {
        bar: { borderRadius: 6, columnWidth: '55%' }
      },
      xaxis: {
        ...chartTheme.xaxis,
        categories: sales.channelRevenue.slice(0, 8).map(d => d.channel || 'N/A'),
      },
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark', type: 'vertical', shadeIntensity: 0.3, opacityFrom: 0.9, opacityTo: 0.7 }
      },
      colors: ['#22c55e'],
      yaxis: { ...chartTheme.yaxis, labels: { ...chartTheme.yaxis.labels, formatter: (v) => formatCurrency(v) } },
      tooltip: { ...chartTheme.tooltip, y: { formatter: (v) => formatCurrency(v) } },
    }
  } : null;

  const topProductsData = sales?.topProducts?.length ? sales.topProducts.slice(0, 10) : [];

  return (
    <div className="animate-fade-in">
      {/* Filter Bar */}
      <div className="filter-bar">
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="filter-item">
          <label>Başlangıç</label>
          <input type="date" className="input" value={filters.startDate} onChange={e => updateFilter('startDate', e.target.value)} style={{ minWidth: 140 }} />
        </div>
        <div className="filter-item">
          <label>Bitiş</label>
          <input type="date" className="input" value={filters.endDate} onChange={e => updateFilter('endDate', e.target.value)} style={{ minWidth: 140 }} />
        </div>
        {filterOptions?.channels?.length > 0 && (
          <div className="filter-item">
            <label>Kanal</label>
            <select className="select" value={filters.channel} onChange={e => updateFilter('channel', e.target.value)}>
              <option value="">Tümü</option>
              {filterOptions.channels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {filterOptions?.devices?.length > 0 && (
          <div className="filter-item">
            <label>Cihaz</label>
            <select className="select" value={filters.device} onChange={e => updateFilter('device', e.target.value)}>
              <option value="">Tümü</option>
              {filterOptions.devices.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {activeFilters.length > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={resetFilters} style={{ marginLeft: 'auto' }}>
            <X size={14} /> Temizle
          </button>
        )}
      </div>

      {/* KPI Cards with Period Comparison */}
      {loading ? (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="kpi-card">
              <div className="skeleton" style={{ width: 44, height: 44, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '80%', height: 28, marginBottom: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {kpiCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="kpi-card kpi-card-clickable" onClick={() => navigate(`/analytics/${card.metricType}`)} title={`${card.label} detayını görüntüle`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className={`kpi-card-icon ${card.color}`}>
                    <Icon size={20} />
                  </div>
                  {card.change !== undefined && <ChangeIndicator value={card.change} inverse={card.inverseFactor} />}
                </div>
                <div className="kpi-card-label" style={{ marginTop: 12 }}>{card.label}</div>
                <div className="kpi-card-value">{card.value}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gross Margin Badge */}
      {derived?.grossMargin > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', marginTop: 12,
          background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', fontSize: 13
        }}>
          <DollarSign size={14} style={{ color: 'var(--accent-green)' }} />
          <span style={{ color: 'var(--text-muted)' }}>Brüt Kâr Marjı:</span>
          <strong style={{ color: 'var(--accent-green)' }}>%{(derived.grossMargin * 100).toFixed(1)}</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>Sepet Dönüşüm:</span>
          <strong style={{ color: 'var(--accent-cyan)' }}>%{(derived.cartRate * 100).toFixed(1)}</strong>
        </div>
      )}

      {/* Charts */}
      {!loading && (
        <div className="charts-grid" style={{ marginTop: 20 }}>
          {/* Revenue Trend */}
          {revenueChartData && (
            <div className="chart-card full-width">
              <div className="chart-card-header">
                <div className="chart-card-title">Günlük Gelir Trendi</div>
              </div>
              <Chart options={revenueChartData.options} series={revenueChartData.series} type="area" height={300} />
            </div>
          )}

          {/* Channel Distribution */}
          {channelDonutData && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Kanal Dağılımı (Oturum)</div>
              </div>
              <Chart options={channelDonutData.options} series={channelDonutData.series} type="donut" height={300} />
            </div>
          )}

          {/* Device Distribution */}
          {deviceDonutData && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Cihaz Dağılımı</div>
              </div>
              <Chart options={deviceDonutData.options} series={deviceDonutData.series} type="donut" height={300} />
            </div>
          )}

          {/* Sessions Trend */}
          {sessionsTrendData && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Oturum Trendi</div>
              </div>
              <Chart options={sessionsTrendData.options} series={sessionsTrendData.series} type="area" height={300} />
            </div>
          )}

          {/* Channel Revenue */}
          {channelRevenueBarData && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Kanal Bazlı Gelir</div>
              </div>
              <Chart options={channelRevenueBarData.options} series={channelRevenueBarData.series} type="bar" height={300} />
            </div>
          )}

          {/* Top Products Table */}
          {topProductsData.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header">
                <div className="chart-card-title">En Çok Satan Ürünler</div>
              </div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ürün</th>
                      <th>Marka</th>
                      <th>Kategori</th>
                      <th>Adet</th>
                      <th>Gelir</th>
                      <th>Sipariş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductsData.map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.item_name}</td>
                        <td><span className="badge badge-blue">{p.item_brand}</span></td>
                        <td>{p.item_category}</td>
                        <td style={{ fontWeight: 600 }}>{formatNumber(p.totalQuantity)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(p.totalRevenue)}</td>
                        <td>{formatNumber(p.orderCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state if no data */}
          {!summary?.traffic?.totalSessions && !loading && (
            <div className="chart-card full-width">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Upload size={32} />
                </div>
                <h3 className="empty-state-title">Henüz Veri Yok</h3>
                <p className="empty-state-text">
                  Dashboard'ı görmek için önce veri import edin. Import sayfasından CSV, XLSX veya JSON dosyalarınızı yükleyebilirsiniz.
                </p>
                <a href="/import" className="btn btn-primary">
                  <Upload size={16} /> Veri Import Et
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
