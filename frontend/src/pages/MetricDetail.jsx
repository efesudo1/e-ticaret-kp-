import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { kpiAPI, filterAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import {
  ArrowLeft, Users, Eye, ShoppingCart, DollarSign, TrendingUp,
  Target, Percent, Activity, Filter, X, ArrowUpRight, ArrowDownRight,
  Monitor, Smartphone, Tablet, Globe, Clock, Tag
} from 'lucide-react';

/* ── Helpers ──────────────────────────────────────────── */
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

const formatPercent = (n, mul = false) => {
  if (isNaN(n) || n === null || n === undefined) return '%0';
  const v = mul ? Number(n) * 100 : Number(n);
  return '%' + v.toFixed(1);
};

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}dk ${s}s` : `${s}s`;
};

/* ── Chart theme (matching dashboard) ──────────────── */
const chartTheme = {
  theme: { mode: 'dark' },
  chart: {
    background: 'transparent',
    fontFamily: 'Futura PT, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false },
  },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
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
  },
  legend: {
    labels: { colors: '#94a3b8' },
    fontFamily: 'Futura PT',
    fontSize: '12px',
  },
  colors: ['#E30613', '#ff2d3b', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7', '#3b82f6'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

/* ── Metric Configuration Map ─────────────────────── */
const metricConfig = {
  sessions: { title: 'Oturum Analizi', icon: Users, color: 'blue' },
  users: { title: 'Kullanıcı Analizi', icon: Eye, color: 'purple' },
  orders: { title: 'Sipariş Analizi', icon: ShoppingCart, color: 'cyan' },
  revenue: { title: 'Gelir Analizi', icon: DollarSign, color: 'green' },
  adspend: { title: 'Reklam Harcama Analizi', icon: TrendingUp, color: 'amber' },
  roas: { title: 'ROAS Analizi', icon: Target, color: 'rose' },
  conversion: { title: 'Dönüşüm Analizi', icon: Percent, color: 'purple' },
  aov: { title: 'Ort. Sipariş Değeri Analizi', icon: Activity, color: 'green' },
};

const dayNames = ['', 'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/* ── Mini KPI Card Component ──────────────────────── */
function MiniKpiCard({ label, value, subLabel, subValue, icon: Icon, color }) {
  return (
    <div className="metric-summary-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {Icon && (
          <div className={`kpi-card-icon ${color || 'blue'}`} style={{ width: 36, height: 36 }}>
            <Icon size={16} />
          </div>
        )}
        <span className="kpi-card-label" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="kpi-card-value" style={{ fontSize: 24 }}>{value}</div>
      {subLabel && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {subLabel}: <strong style={{ color: 'var(--text-secondary)' }}>{subValue}</strong>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function MetricDetail() {
  const { metricType } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState(null);
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  const config = metricConfig[metricType] || metricConfig.sessions;
  const Icon = config.icon;

  useEffect(() => {
    filterAPI.options().then(r => setFilterOptions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    kpiAPI.metricDetail(metricType, filters)
      .then(res => setData(res.data))
      .catch(e => console.error('Metric detail load error:', e))
      .finally(() => setLoading(false));
  }, [metricType, filters]);

  /* ── Render helpers ─────────────────────────────── */
  const renderAreaChart = (series, opts = {}) => {
    const options = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'area', height: opts.height || 300 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } },
      ...(opts.yFormatter ? { yaxis: { ...chartTheme.yaxis, labels: { ...chartTheme.yaxis.labels, formatter: opts.yFormatter } } } : {}),
      ...(opts.tooltipY ? { tooltip: { ...chartTheme.tooltip, y: { formatter: opts.tooltipY } } } : {}),
      ...(opts.colors ? { colors: opts.colors } : {}),
    };
    return <Chart options={options} series={series} type="area" height={opts.height || 300} />;
  };

  const renderBarChart = (series, categories, opts = {}) => {
    const options = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'bar', height: opts.height || 300 },
      plotOptions: { bar: { borderRadius: 6, columnWidth: opts.columnWidth || '55%', horizontal: opts.horizontal || false } },
      xaxis: { ...chartTheme.xaxis, categories },
      ...(opts.yFormatter ? { yaxis: { ...chartTheme.yaxis, labels: { ...chartTheme.yaxis.labels, formatter: opts.yFormatter } } } : {}),
      ...(opts.tooltipY ? { tooltip: { ...chartTheme.tooltip, y: { formatter: opts.tooltipY } } } : {}),
      ...(opts.colors ? { colors: opts.colors } : {}),
      fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical', shadeIntensity: 0.3, opacityFrom: 0.9, opacityTo: 0.7 } },
    };
    return <Chart options={options} series={series} type="bar" height={opts.height || 300} />;
  };

  const renderDonutChart = (series, labels, opts = {}) => {
    const options = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'donut', height: opts.height || 300 },
      labels,
      plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Toplam', color: '#94a3b8', fontFamily: 'Futura PT', formatter: (w) => formatNumber(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) } } } } },
      stroke: { colors: ['#0c0c0e'], width: 2 },
      ...(opts.colors ? { colors: opts.colors } : {}),
    };
    return <Chart options={options} series={series} type="donut" height={opts.height || 300} />;
  };

  const renderLineChart = (series, opts = {}) => {
    const options = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'line', height: opts.height || 300 },
      ...(opts.yFormatter ? { yaxis: { ...chartTheme.yaxis, labels: { ...chartTheme.yaxis.labels, formatter: opts.yFormatter } } } : {}),
      ...(opts.tooltipY ? { tooltip: { ...chartTheme.tooltip, y: { formatter: opts.tooltipY } } } : {}),
      ...(opts.colors ? { colors: opts.colors } : {}),
    };
    return <Chart options={options} series={series} type="line" height={opts.height || 300} />;
  };

  /* ═══════════════════════════════════════════════════
     METRIC-SPECIFIC RENDERS
     ═══════════════════════════════════════════════════ */

  const renderSessions = () => {
    const s = data.summary;
    return (
      <>
        {/* Summary Cards */}
        <div className="metric-summary-grid">
          <MiniKpiCard label="Toplam Oturum" value={formatNumber(s.totalSessions)} icon={Users} color="blue" />
          <MiniKpiCard label="Ort. Bounce Rate" value={formatPercent(s.avgBounce)} icon={ArrowDownRight} color="rose" />
          <MiniKpiCard label="Engagement Rate" value={formatPercent(s.avgEngagement)} icon={ArrowUpRight} color="green" />
          <MiniKpiCard label="Ort. Süre" value={formatDuration(s.avgDuration)} icon={Clock} color="cyan" />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          {/* Daily Trend */}
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Oturum Trendi</div></div>
            {renderAreaChart([{
              name: 'Oturumlar',
              data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.sessions) || 0 }))
            }], { colors: ['#E30613'] })}
          </div>

          {/* Channel Distribution */}
          {data.channelDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Oturumlar</div></div>
              {renderDonutChart(
                data.channelDist.map(d => Number(d.sessions) || 0),
                data.channelDist.map(d => d.channel || 'Bilinmeyen')
              )}
            </div>
          )}

          {/* Device Distribution */}
          {data.deviceDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Cihaz Bazlı Oturumlar</div></div>
              {renderBarChart(
                [{ name: 'Oturum', data: data.deviceDist.map(d => Number(d.sessions) || 0) }],
                data.deviceDist.map(d => d.device),
                { colors: ['#3b82f6'] }
              )}
            </div>
          )}

          {/* Weekly Trend */}
          {data.weeklyTrend?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Haftalık Oturum Trendi</div></div>
              {renderBarChart(
                [{ name: 'Oturum', data: data.weeklyTrend.map(d => Number(d.sessions) || 0) }],
                data.weeklyTrend.map(d => d.weekStart),
                { colors: ['#a855f7'] }
              )}
            </div>
          )}

          {/* Bounce & Engagement Trend */}
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Bounce Rate & Engagement Rate Trendi</div></div>
            {renderLineChart([
              { name: 'Bounce Rate', data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.bounceRate * 100).toFixed(1) })) },
              { name: 'Engagement Rate', data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.engagementRate * 100).toFixed(1) })) },
            ], { colors: ['#E30613', '#22c55e'], tooltipY: v => '%' + Number(v).toFixed(1) })}
          </div>

          {/* Source/Medium Table */}
          {data.sourceMedium?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kaynak / Ortam Dağılımı (Top 20)</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Kaynak / Ortam</th><th>Oturum</th><th>Bounce Rate</th><th>Engagement</th><th>Dönüşüm</th></tr></thead>
                  <tbody>
                    {data.sourceMedium.map((d, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.sourceMedium}</td>
                        <td style={{ fontWeight: 600 }}>{formatNumber(d.sessions)}</td>
                        <td>{formatPercent(d.bounceRate)}</td>
                        <td>{formatPercent(d.engagementRate)}</td>
                        <td style={{ color: 'var(--accent-green)' }}>{formatNumber(d.conversions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderUsers = () => {
    const s = data.summary;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Toplam Kullanıcı" value={formatNumber(s.totalUsers)} icon={Users} color="purple" />
          <MiniKpiCard label="Yeni Kullanıcı" value={formatNumber(s.totalNew)} icon={ArrowUpRight} color="green" subLabel="Oran" subValue={formatPercent(s.newRatio, true)} />
          <MiniKpiCard label="Geri Dönen" value={formatNumber(s.returningUsers)} icon={ArrowDownRight} color="amber" />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Kullanıcı Trendi</div></div>
            {renderAreaChart([
              { name: 'Toplam Kullanıcı', data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.users) || 0 })) },
              { name: 'Yeni Kullanıcı', data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.newUsers) || 0 })) },
            ], { colors: ['#a855f7', '#22c55e'] })}
          </div>

          {data.newVsReturning?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Yeni vs Geri Dönen</div></div>
              {renderDonutChart(
                data.newVsReturning.map(d => Number(d.users) || 0),
                data.newVsReturning.map(d => d.userType || 'Bilinmeyen'),
                { colors: ['#22c55e', '#a855f7'] }
              )}
            </div>
          )}

          {data.channelDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Kullanıcılar</div></div>
              {renderBarChart(
                [
                  { name: 'Toplam', data: data.channelDist.map(d => Number(d.users) || 0) },
                  { name: 'Yeni', data: data.channelDist.map(d => Number(d.newUsers) || 0) },
                ],
                data.channelDist.map(d => d.channel),
                { colors: ['#a855f7', '#22c55e'] }
              )}
            </div>
          )}

          {data.topCities?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Şehir Bazlı Kullanıcılar (Top 15)</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Şehir</th><th>Kullanıcı</th><th>Yeni</th><th>Oturum</th></tr></thead>
                  <tbody>
                    {data.topCities.map((d, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.city}</td>
                        <td style={{ fontWeight: 600 }}>{formatNumber(d.users)}</td>
                        <td style={{ color: 'var(--accent-green)' }}>{formatNumber(d.newUsers)}</td>
                        <td>{formatNumber(d.sessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderOrders = () => {
    const s = data.summary;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Toplam Sipariş" value={formatNumber(s.totalOrders)} icon={ShoppingCart} color="cyan" />
          <MiniKpiCard label="Toplam Gelir" value={formatCurrency(s.totalRevenue)} icon={DollarSign} color="green" />
          <MiniKpiCard label="Ort. Sipariş Değeri" value={formatCurrency(s.avgOrderValue)} icon={Activity} color="amber" />
          <MiniKpiCard label="Ort. Ürün/Sipariş" value={Number(s.avgItemsPerOrder || 0).toFixed(1)} icon={Tag} color="purple" />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Sipariş Trendi</div></div>
            {renderAreaChart([{
              name: 'Sipariş',
              data: data.dailyTrend.map(d => ({ x: d.date, y: Number(d.orders) || 0 }))
            }], { colors: ['#06b6d4'] })}
          </div>

          {data.statusDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Sipariş Durumu Dağılımı</div></div>
              {renderDonutChart(
                data.statusDist.map(d => Number(d.count) || 0),
                data.statusDist.map(d => d.status),
                { colors: ['#22c55e', '#06b6d4', '#f59e0b', '#E30613', '#a855f7'] }
              )}
            </div>
          )}

          {data.paymentDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Ödeme Yöntemi Dağılımı</div></div>
              {renderDonutChart(
                data.paymentDist.map(d => Number(d.count) || 0),
                data.paymentDist.map(d => d.payment_method || 'Diğer')
              )}
            </div>
          )}

          {data.hourlyDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Saatlik Sipariş Dağılımı</div></div>
              {renderBarChart(
                [{ name: 'Sipariş', data: data.hourlyDist.map(d => Number(d.orders) || 0) }],
                data.hourlyDist.map(d => `${d.hour}:00`),
                { colors: ['#06b6d4'], columnWidth: '70%' }
              )}
            </div>
          )}

          {data.dayOfWeekDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Gün Bazlı Sipariş Dağılımı</div></div>
              {renderBarChart(
                [{ name: 'Sipariş', data: data.dayOfWeekDist.map(d => Number(d.orders) || 0) }],
                data.dayOfWeekDist.map(d => dayNames[d.dayOfWeek] || d.dayOfWeek),
                { colors: ['#a855f7'] }
              )}
            </div>
          )}

          {data.channelDist?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Siparişler</div></div>
              {renderBarChart(
                [
                  { name: 'Sipariş', data: data.channelDist.map(d => Number(d.orders) || 0) },
                ],
                data.channelDist.map(d => d.channel),
                { colors: ['#22c55e'] }
              )}
            </div>
          )}

          {data.couponAnalysis?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kupon Analizi</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>Tür</th><th>Sipariş</th><th>Gelir</th><th>Ort. Sipariş</th><th>Toplam İndirim</th></tr></thead>
                  <tbody>
                    {data.couponAnalysis.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.type}</td>
                        <td style={{ fontWeight: 600 }}>{formatNumber(d.orders)}</td>
                        <td style={{ color: 'var(--accent-green)' }}>{formatCurrency(d.revenue)}</td>
                        <td>{formatCurrency(d.aov)}</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{formatCurrency(d.totalDiscount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderRevenue = () => {
    const s = data.summary;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Brüt Gelir" value={formatCurrency(s.totalRevenue)} icon={DollarSign} color="green" />
          <MiniKpiCard label="Net Gelir" value={formatCurrency(s.totalNet)} icon={DollarSign} color="cyan" />
          <MiniKpiCard label="İndirimler" value={formatCurrency(s.totalDiscounts)} icon={Tag} color="amber" />
          <MiniKpiCard label="İadeler" value={formatCurrency(s.totalRefunds)} icon={ArrowDownRight} color="rose" />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Gelir Trendi (Brüt vs Net)</div></div>
            {renderAreaChart([
              { name: 'Brüt Gelir', data: data.dailyRevenue.map(d => ({ x: d.date, y: Number(d.revenue) || 0 })) },
              { name: 'Net Gelir', data: data.dailyRevenue.map(d => ({ x: d.date, y: Number(d.netRevenue) || 0 })) },
            ], { colors: ['#22c55e', '#06b6d4'], tooltipY: v => formatCurrency(v), yFormatter: v => formatCurrency(v) })}
          </div>

          {data.weeklyRevenue?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Haftalık Gelir Karşılaştırma</div></div>
              {renderBarChart(
                [{ name: 'Gelir', data: data.weeklyRevenue.map(d => Number(d.revenue) || 0) }],
                data.weeklyRevenue.map(d => d.weekStart),
                { colors: ['#22c55e'], tooltipY: v => formatCurrency(v) }
              )}
            </div>
          )}

          {data.channelRevenue?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Gelir</div></div>
              {renderBarChart(
                [
                  { name: 'Brüt', data: data.channelRevenue.map(d => Number(d.revenue) || 0) },
                  { name: 'Net', data: data.channelRevenue.map(d => Number(d.netRevenue) || 0) },
                ],
                data.channelRevenue.map(d => d.channel),
                { colors: ['#22c55e', '#06b6d4'], tooltipY: v => formatCurrency(v) }
              )}
            </div>
          )}

          {data.categoryRevenue?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kategori Bazlı Gelir</div></div>
              {renderBarChart(
                [{ name: 'Gelir', data: data.categoryRevenue.map(d => Number(d.revenue) || 0) }],
                data.categoryRevenue.map(d => d.category),
                { colors: ['#a855f7'], tooltipY: v => formatCurrency(v) }
              )}
            </div>
          )}

          {data.refundByBrand?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Marka Bazlı İade Analizi</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Marka</th><th>Gelir</th><th>İade</th><th>İade Oranı</th></tr></thead>
                  <tbody>
                    {data.refundByBrand.map((d, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.brand}</td>
                        <td style={{ color: 'var(--accent-green)' }}>{formatCurrency(d.revenue)}</td>
                        <td style={{ color: 'var(--accent-rose)' }}>{formatCurrency(d.refunds)}</td>
                        <td>%{Number(d.refundRate || 0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderAdSpend = () => {
    const s = data.summary;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Toplam Harcama" value={formatCurrency(s.totalSpend)} icon={TrendingUp} color="amber" />
          <MiniKpiCard label="Meta Harcama" value={formatCurrency(s.metaSpend)} icon={Globe} color="blue" />
          <MiniKpiCard label="Google Harcama" value={formatCurrency(s.googleSpend)} icon={Globe} color="green" />
          <MiniKpiCard label="Ort. CPC" value={formatCurrency(s.avgCPC)} icon={Monitor} color="cyan" subLabel="CTR" subValue={'%' + Number(s.avgCTR || 0).toFixed(2)} />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Harcama Trendi (Meta vs Google)</div></div>
            {renderAreaChart([
              { name: 'Meta', data: data.metaDaily.map(d => ({ x: d.date, y: Number(d.spend) || 0 })) },
              { name: 'Google', data: data.googleDaily.map(d => ({ x: d.date, y: Number(d.spend) || 0 })) },
            ], { colors: ['#3b82f6', '#22c55e'], tooltipY: v => formatCurrency(v), yFormatter: v => formatCurrency(v) })}
          </div>

          <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Platform Dağılımı</div></div>
            {renderDonutChart(
              [s.metaSpend || 0, s.googleSpend || 0],
              ['Meta', 'Google'],
              { colors: ['#3b82f6', '#22c55e'] }
            )}
          </div>

          {/* CPC Trend */}
          <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">CPC Trendi</div></div>
            {renderLineChart([
              { name: 'Meta CPC', data: data.metaDaily.map(d => ({ x: d.date, y: Number(d.cpc) || 0 })) },
              { name: 'Google CPC', data: data.googleDaily.map(d => ({ x: d.date, y: Number(d.cpc) || 0 })) },
            ], { colors: ['#3b82f6', '#22c55e'], tooltipY: v => formatCurrency(v) })}
          </div>

          {/* Campaign Table */}
          {data.campaigns?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kampanya Bazlı Harcama</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Kampanya</th><th>Platform</th><th>Harcama</th><th>Tıklama</th><th>Gösterim</th><th>CPC</th><th>CTR</th></tr></thead>
                  <tbody>
                    {data.campaigns.slice(0, 15).map((d, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.campaign_name}</td>
                        <td><span className={`badge ${d.platform === 'Meta' ? 'badge-blue' : 'badge-green'}`}>{d.platform}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{formatCurrency(d.spend)}</td>
                        <td>{formatNumber(d.clicks)}</td>
                        <td>{formatNumber(d.impressions)}</td>
                        <td>{formatCurrency(d.cpc)}</td>
                        <td>%{Number(d.ctr || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderRoas = () => {
    const s = data.summary;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Genel ROAS" value={Number(s.overallRoas || 0).toFixed(2) + 'x'} icon={Target} color="rose" />
          <MiniKpiCard label="Meta ROAS" value={Number(s.metaRoas || 0).toFixed(2) + 'x'} icon={Globe} color="blue" />
          <MiniKpiCard label="Google ROAS" value={Number(s.googleRoas || 0).toFixed(2) + 'x'} icon={Globe} color="green" />
          <MiniKpiCard label="Toplam Dönüşüm Değeri" value={formatCurrency(s.totalConvValue)} icon={DollarSign} color="amber" subLabel="Harcama" subValue={formatCurrency(s.totalSpend)} />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük ROAS Trendi</div></div>
            {renderLineChart([
              { name: 'Meta ROAS', data: data.metaDaily.map(d => ({ x: d.date, y: Number(d.roas) || 0 })) },
              { name: 'Google ROAS', data: data.googleDaily.map(d => ({ x: d.date, y: Number(d.roas) || 0 })) },
            ], { colors: ['#3b82f6', '#22c55e'], tooltipY: v => Number(v).toFixed(2) + 'x' })}
          </div>

          {/* Spend vs Revenue */}
          <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Harcama vs Getiri (Platform)</div></div>
            {renderBarChart(
              [
                { name: 'Harcama', data: data.platformComparison.map(d => Number(d.spend) || 0) },
                { name: 'Dönüşüm Değeri', data: data.platformComparison.map(d => Number(d.convValue) || 0) },
              ],
              data.platformComparison.map(d => d.platform),
              { colors: ['#E30613', '#22c55e'], tooltipY: v => formatCurrency(v) }
            )}
          </div>

          {/* ROAS by Platform */}
          <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Platform ROAS Karşılaştırma</div></div>
            {renderBarChart(
              [{ name: 'ROAS', data: data.platformComparison.map(d => Number(d.roas) || 0) }],
              data.platformComparison.map(d => d.platform),
              { colors: ['#f59e0b'], tooltipY: v => Number(v).toFixed(2) + 'x' }
            )}
          </div>

          {/* Campaign ROAS Table */}
          {data.campaignRoas?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kampanya Bazlı ROAS</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Kampanya</th><th>Platform</th><th>ROAS</th><th>Harcama</th><th>Dönüşüm Değeri</th><th>Dönüşüm</th></tr></thead>
                  <tbody>
                    {data.campaignRoas.slice(0, 15).map((d, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.campaign_name}</td>
                        <td><span className={`badge ${d.platform === 'Meta' ? 'badge-blue' : 'badge-green'}`}>{d.platform}</span></td>
                        <td style={{ fontWeight: 700, color: Number(d.roas) >= 1 ? 'var(--accent-green)' : 'var(--accent-rose)' }}>{Number(d.roas || 0).toFixed(2)}x</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{formatCurrency(d.spend)}</td>
                        <td style={{ color: 'var(--accent-green)' }}>{formatCurrency(d.convValue)}</td>
                        <td>{formatNumber(d.conversions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderConversion = () => {
    const s = data.summary;
    const f = data.funnel;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Genel Dönüşüm Oranı" value={formatPercent(s.overallCVR, true)} icon={Percent} color="purple" />
          <MiniKpiCard label="Toplam Oturum" value={formatNumber(s.totalSessions)} icon={Users} color="blue" />
          <MiniKpiCard label="Toplam Dönüşüm" value={formatNumber(s.totalConversions)} icon={ShoppingCart} color="green" />
          <MiniKpiCard label="Sepet → Ödeme" value={formatPercent(s.cartToCheckout, true)} icon={ArrowUpRight} color="cyan" subLabel="Ödeme → Satın Alma" subValue={formatPercent(s.checkoutToPurchase, true)} />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Dönüşüm Oranı Trendi</div></div>
            {renderLineChart([{
              name: 'CVR',
              data: data.dailyCVR.map(d => ({ x: d.date, y: (Number(d.cvr) * 100) || 0 }))
            }], { colors: ['#a855f7'], tooltipY: v => '%' + Number(v).toFixed(2) })}
          </div>

          {/* Funnel Chart */}
          <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Dönüşüm Hunisi</div></div>
            {renderBarChart(
              [{ name: 'Adet', data: [
                Number(f.listViews) || 0, Number(f.productViews) || 0,
                Number(f.addToCart) || 0, Number(f.checkout) || 0, Number(f.purchased) || 0
              ]}],
              ['Liste Görüntüleme', 'Ürün Görüntüleme', 'Sepete Ekle', 'Ödeme', 'Satın Alma'],
              { colors: ['#E30613'], horizontal: true }
            )}
          </div>

          {data.channelCVR?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Dönüşüm Oranı</div></div>
              {renderBarChart(
                [{ name: 'CVR %', data: data.channelCVR.map(d => (Number(d.cvr) * 100) || 0) }],
                data.channelCVR.map(d => d.channel),
                { colors: ['#a855f7'], tooltipY: v => '%' + Number(v).toFixed(2) }
              )}
            </div>
          )}

          {data.deviceCVR?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Cihaz Bazlı Dönüşüm Oranı</div></div>
              {renderBarChart(
                [{ name: 'CVR %', data: data.deviceCVR.map(d => (Number(d.cvr) * 100) || 0) }],
                data.deviceCVR.map(d => d.device),
                { colors: ['#06b6d4'], tooltipY: v => '%' + Number(v).toFixed(2) }
              )}
            </div>
          )}

          {/* CVR & Conversions dual line */}
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Oturum & Dönüşüm Trendi</div></div>
            {renderAreaChart([
              { name: 'Oturum', data: data.dailyCVR.map(d => ({ x: d.date, y: Number(d.sessions) || 0 })) },
              { name: 'Dönüşüm', data: data.dailyCVR.map(d => ({ x: d.date, y: Number(d.conversions) || 0 })) },
            ], { colors: ['#3b82f6', '#22c55e'] })}
          </div>
        </div>
      </>
    );
  };

  const renderAov = () => {
    const s = data.summary;
    return (
      <>
        <div className="metric-summary-grid">
          <MiniKpiCard label="Ort. Sipariş Değeri" value={formatCurrency(s.overallAOV)} icon={Activity} color="green" />
          <MiniKpiCard label="Toplam Sipariş" value={formatNumber(s.totalOrders)} icon={ShoppingCart} color="cyan" />
          <MiniKpiCard label="Ort. Ürün/Sipariş" value={Number(s.avgItemsPerOrder || 0).toFixed(1)} icon={Tag} color="purple" />
        </div>

        <div className="charts-grid" style={{ marginTop: 20 }}>
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük AOV Trendi</div></div>
            {renderLineChart([{
              name: 'AOV',
              data: data.dailyAOV.map(d => ({ x: d.date, y: Number(d.aov) || 0 }))
            }], { colors: ['#22c55e'], tooltipY: v => formatCurrency(v), yFormatter: v => formatCurrency(v) })}
          </div>

          {data.channelAOV?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı AOV</div></div>
              {renderBarChart(
                [{ name: 'AOV', data: data.channelAOV.map(d => Number(d.aov) || 0) }],
                data.channelAOV.map(d => d.channel),
                { colors: ['#22c55e'], tooltipY: v => formatCurrency(v) }
              )}
            </div>
          )}

          {data.itemCountDist?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Siparişteki Ürün Sayısı vs AOV</div></div>
              {renderBarChart(
                [
                  { name: 'Sipariş Sayısı', data: data.itemCountDist.map(d => Number(d.orders) || 0) },
                ],
                data.itemCountDist.map(d => d.itemCount + ' ürün'),
                { colors: ['#a855f7'] }
              )}
            </div>
          )}

          {data.deviceAOV?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Cihaz Bazlı AOV</div></div>
              {renderBarChart(
                [{ name: 'AOV', data: data.deviceAOV.map(d => Number(d.aov) || 0) }],
                data.deviceAOV.map(d => d.device),
                { colors: ['#06b6d4'], tooltipY: v => formatCurrency(v) }
              )}
            </div>
          )}

          {data.paymentAOV?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Ödeme Yöntemi Bazlı AOV</div></div>
              {renderBarChart(
                [{ name: 'AOV', data: data.paymentAOV.map(d => Number(d.aov) || 0) }],
                data.paymentAOV.map(d => d.payment_method || 'Diğer'),
                { colors: ['#f59e0b'], tooltipY: v => formatCurrency(v) }
              )}
            </div>
          )}

          {data.couponAOV?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Kuponlu vs Kuponsuz AOV Karşılaştırma</div></div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>Tür</th><th>AOV</th><th>Sipariş</th><th>Toplam İndirim</th></tr></thead>
                  <tbody>
                    {data.couponAOV.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.type}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(d.aov)}</td>
                        <td>{formatNumber(d.orders)}</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{formatCurrency(d.totalDiscount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  /* ── Metric content router ─────────────────────── */
  const renderMetricContent = () => {
    if (!data) return null;
    switch (metricType) {
      case 'sessions': return renderSessions();
      case 'users': return renderUsers();
      case 'orders': return renderOrders();
      case 'revenue': return renderRevenue();
      case 'adspend': return renderAdSpend();
      case 'roas': return renderRoas();
      case 'conversion': return renderConversion();
      case 'aov': return renderAov();
      default: return <p>Bilinmeyen metrik tipi: {metricType}</p>;
    }
  };

  /* ═══════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════ */
  return (
    <div className="animate-fade-in">
      {/* Back Button & Header */}
      <div className="metric-detail-header">
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ gap: 6 }}>
          <ArrowLeft size={16} /> Dashboard'a Dön
        </button>
        <div className="metric-detail-title">
          <div className={`kpi-card-icon ${config.color}`}>
            <Icon size={20} />
          </div>
          <h2>{config.title}</h2>
        </div>
      </div>

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

      {/* Content */}
      {loading ? (
        <div className="metric-summary-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="metric-summary-card">
              <div className="skeleton" style={{ width: 120, height: 14, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '70%', height: 28 }} />
            </div>
          ))}
        </div>
      ) : (
        renderMetricContent()
      )}
    </div>
  );
}
