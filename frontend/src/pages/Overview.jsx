import { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { DollarSign, ShoppingCart, TrendingUp, Tag } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { kpiAPI } from '../services/api';
import FilterBar from '../components/FilterBar';
import DataTable from '../components/DataTable';

const fmtTL = (n) => '₺' + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtX = (n) => n == null ? '–' : `${Number(n).toFixed(2)}x`;

const PLATFORM_COLORS = {
  Meta: '#1877f2',
  Google: '#fbbc05',
  Organic: '#22c55e',
  Direct: '#a855f7',
};

export default function Overview() {
  const { filters } = useFilters();
  const [data, setData] = useState({ platform: null, campaigns: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Platform karşılaştırma için her zaman tüm platformlar lazım (filter'dan bağımsız)
    const { platform: _, ...filtersForCompare } = filters;
    Promise.all([
      kpiAPI.platformOverview(filters),
      kpiAPI.campaignProductBreakdown({ ...filters, topCampaigns: 5, limitPerCampaign: 1 }),
      kpiAPI.platformOverview(filtersForCompare), // her zaman tüm platformlar
    ])
      .then(([p, c, allPlatforms]) => {
        if (cancelled) return;
        setData({ platform: p.data, campaigns: c.data, allPlatforms: allPlatforms.data });
      })
      .catch(err => console.error('Overview load error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const totals = useMemo(() => {
    if (!data.platform?.platforms) return { revenue: 0, orders: 0, adSpend: 0, aov: 0 };
    const sum = data.platform.platforms.reduce((acc, p) => ({
      revenue: acc.revenue + (p.revenue || 0),
      orders:  acc.orders + (p.orders || 0),
      adSpend: acc.adSpend + (p.adSpend || 0),
    }), { revenue: 0, orders: 0, adSpend: 0 });
    return {
      ...sum,
      aov: sum.orders > 0 ? sum.revenue / sum.orders : 0,
      roas: sum.adSpend > 0 ? sum.revenue / sum.adSpend : null,
    };
  }, [data.platform]);

  // Günlük ciro line chart (toplam, tüm platformlar)
  const dailyChart = useMemo(() => {
    if (!data.platform?.dailyTrend) return { series: [], categories: [] };
    const days = data.platform.dailyTrend;
    return {
      series: [{
        name: 'Toplam Ciro',
        data: days.map(d => Math.round((d.Meta || 0) + (d.Google || 0) + (d.Organic || 0) + (d.Direct || 0))),
      }],
      categories: days.map(d => d.day),
    };
  }, [data.platform]);

  // Platform pay donut
  const platformPie = useMemo(() => {
    if (!data.platform?.platforms) return { series: [], labels: [] };
    return {
      series: data.platform.platforms.map(p => Math.round(p.revenue || 0)),
      labels: data.platform.platforms.map(p => p.platform),
    };
  }, [data.platform]);

  return (
    <div className="page-container animate-fade-in">
      <FilterBar />

      {loading && (
        <div className="kpi-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="kpi-card skeleton" style={{ height: 130 }} />)}
        </div>
      )}

      {!loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-icon green"><DollarSign size={22} /></div>
              <div className="kpi-card-label">Toplam Ciro</div>
              <div className="kpi-card-value">{fmtTL(totals.revenue)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-icon cyan"><ShoppingCart size={22} /></div>
              <div className="kpi-card-label">Sipariş Sayısı</div>
              <div className="kpi-card-value">{fmtNum(totals.orders)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-icon rose"><TrendingUp size={22} /></div>
              <div className="kpi-card-label">Genel ROAS</div>
              <div className="kpi-card-value">{fmtX(totals.roas)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Reklam: {fmtTL(totals.adSpend)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-icon amber"><Tag size={22} /></div>
              <div className="kpi-card-label">Ort. Sipariş Değeri</div>
              <div className="kpi-card-value">{fmtTL(totals.aov)}</div>
            </div>
          </div>

          <div className="charts-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Günlük Ciro Trendi</div>
              </div>
              <ReactApexChart
                type="area"
                height={320}
                series={dailyChart.series}
                options={{
                  chart: { toolbar: { show: false }, zoom: { enabled: false }, foreColor: '#a1a1aa' },
                  stroke: { curve: 'smooth', width: 2 },
                  colors: ['#E30613'],
                  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
                  dataLabels: { enabled: false },
                  xaxis: { categories: dailyChart.categories, labels: { style: { fontSize: '11px' } } },
                  yaxis: { labels: { formatter: (v) => fmtTL(v) } },
                  tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                  grid: { borderColor: 'rgba(255,255,255,0.06)' },
                }}
              />
            </div>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Platform Payı</div>
              </div>
              <ReactApexChart
                type="donut"
                height={320}
                series={platformPie.series}
                options={{
                  chart: { foreColor: '#a1a1aa' },
                  labels: platformPie.labels,
                  colors: platformPie.labels.map(l => PLATFORM_COLORS[l] || '#71717a'),
                  legend: { position: 'bottom', fontSize: '12px' },
                  dataLabels: { formatter: (v) => `${v.toFixed(0)}%` },
                  tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                  stroke: { colors: ['#0c0c0e'], width: 2 },
                }}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Meta vs Google — Hızlı Karşılaştırma</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Filtreden bağımsız (toplam)</div>
            </div>
            <div className="card-body">
              {(() => {
                const meta = data.allPlatforms?.platforms?.find(p => p.platform === 'Meta');
                const google = data.allPlatforms?.platforms?.find(p => p.platform === 'Google');
                if (!meta || !google) return <div style={{ color: 'var(--text-muted)' }}>Veri yok.</div>;
                const rows = [
                  { label: 'Reklam Harcama', m: fmtTL(meta.adSpend), g: fmtTL(google.adSpend) },
                  { label: 'Ciro',            m: fmtTL(meta.revenue), g: fmtTL(google.revenue) },
                  { label: 'ROAS',            m: fmtX(meta.roas), g: fmtX(google.roas) },
                  { label: 'Sipariş',         m: fmtNum(meta.orders), g: fmtNum(google.orders) },
                  { label: 'AOV',             m: fmtTL(meta.aov), g: fmtTL(google.aov) },
                  { label: 'Tıklama',         m: fmtNum(meta.clicks), g: fmtNum(google.clicks) },
                ];
                return (
                  <div className="compare-grid">
                    <div className="compare-col">
                      <div className="compare-col-header" style={{ color: '#1877f2' }}>META</div>
                      {rows.map(r => (
                        <div key={r.label} className="compare-row">
                          <span className="compare-label">{r.label}</span>
                          <span className="compare-value">{r.m}</span>
                        </div>
                      ))}
                    </div>
                    <div className="compare-col">
                      <div className="compare-col-header" style={{ color: '#fbbc05' }}>GOOGLE</div>
                      {rows.map(r => (
                        <div key={r.label} className="compare-row">
                          <span className="compare-label">{r.label}</span>
                          <span className="compare-value">{r.g}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              En İyi 5 Kampanya
            </div>
            <DataTable
              rows={data.campaigns?.campaigns || []}
              columns={[
                {
                  key: 'campaign_name', label: 'Kampanya', sortable: true,
                  render: (c) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.campaign_name}</span>,
                },
                {
                  key: 'platform', label: 'Platform', sortable: true,
                  render: (c) => c.platform ? (
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11,
                      background: c.platform === 'meta' ? 'rgba(24,119,242,.15)' : 'rgba(251,188,5,.15)',
                      color: c.platform === 'meta' ? '#1877f2' : '#fbbc05',
                      textTransform: 'uppercase', fontWeight: 600,
                    }}>{c.platform}</span>
                  ) : '—',
                },
                {
                  key: 'totalRevenue', label: 'Ciro', sortable: true, align: 'right',
                  render: (c) => <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(c.totalRevenue)}</span>,
                },
                { key: 'spend', label: 'Spend', sortable: true, align: 'right', format: (v) => fmtTL(v) },
                {
                  key: 'roas', label: 'ROAS', sortable: true, align: 'right',
                  render: (c) => <span style={{ fontWeight: 600 }}>{fmtX(c.roas)}</span>,
                },
                {
                  key: 'topProductName', label: 'En Çok Satan', sortable: true,
                  sortFn: (a, b) => {
                    const an = a.topProducts?.[0]?.item_name || '';
                    const bn = b.topProducts?.[0]?.item_name || '';
                    return an.localeCompare(bn, 'tr');
                  },
                  render: (c) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.topProducts?.[0]?.item_name || '—'}</span>,
                },
              ]}
              searchable
              searchPlaceholder="Kampanyalar arasında ara..."
              defaultSort={{ key: 'totalRevenue', dir: 'desc' }}
              emptyMessage="Bu tarih aralığında kampanya verisi yok."
              rowKey={(c) => c.campaign_name}
              compact
            />
          </div>
        </>
      )}
    </div>
  );
}
