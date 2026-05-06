import { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useFilters } from '../context/FilterContext';
import { kpiAPI } from '../services/api';
import FilterBar from '../components/FilterBar';

const fmtTL = (n) => '₺' + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtX = (n) => n == null ? '–' : `${Number(n).toFixed(2)}x`;
const fmtPct = (n) => `%${(Number(n || 0) * 100).toFixed(2)}`;

const PLATFORM_COLORS = {
  Meta: '#1877f2',
  Google: '#fbbc05',
  Organic: '#22c55e',
  Direct: '#a855f7',
};

export default function PlatformsOverview() {
  const { filters } = useFilters();
  const [data, setData] = useState({ platform: null, products: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Platform sayfası 4 platformu zaten karşılaştırıyor — platform filter'ı ignore et
    const { platform: _, ...filtersForAll } = filters;
    Promise.all([
      kpiAPI.platformOverview(filtersForAll),
      kpiAPI.productPlatformBreakdown({ ...filtersForAll, limitProducts: 30 }),
    ])
      .then(([p, pp]) => {
        if (cancelled) return;
        setData({ platform: p.data, products: pp.data });
      })
      .catch(err => console.error('Platforms load error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const platforms = data.platform?.platforms || [];
  const corePlatforms = useMemo(
    () => platforms.filter(p => ['Meta', 'Google', 'Organic', 'Direct'].includes(p.platform)),
    [platforms]
  );

  // Günlük trend chart
  const trendChart = useMemo(() => {
    const days = data.platform?.dailyTrend || [];
    const series = ['Meta', 'Google', 'Organic', 'Direct'].map(name => ({
      name,
      data: days.map(d => Math.round(d[name] || 0)),
    }));
    return { series, categories: days.map(d => d.day) };
  }, [data.platform]);

  // Spend vs revenue grouped bar (paid only)
  const spendVsRevenueChart = useMemo(() => {
    const paid = corePlatforms.filter(p => (p.adSpend || 0) > 0);
    return {
      series: [
        { name: 'Reklam Harcama', data: paid.map(p => Math.round(p.adSpend || 0)) },
        { name: 'Ciro',           data: paid.map(p => Math.round(p.revenue || 0)) },
      ],
      categories: paid.map(p => p.platform),
    };
  }, [corePlatforms]);

  // Her platformdan top 3 ürün
  const topProductsByPlatform = useMemo(() => {
    if (!data.products?.products) return {};
    const result = { Meta: [], Google: [], Organic: [], Direct: [] };
    for (const p of data.products.products) {
      for (const platform of Object.keys(result)) {
        const rev = p.platforms?.[platform]?.revenue || 0;
        if (rev > 0) {
          result[platform].push({ ...p, platformRevenue: rev });
        }
      }
    }
    for (const k of Object.keys(result)) {
      result[k].sort((a, b) => b.platformRevenue - a.platformRevenue);
      result[k] = result[k].slice(0, 3);
    }
    return result;
  }, [data.products]);

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={true} showPlatform={false} />

      {loading ? (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="kpi-card skeleton" style={{ height: 200 }} />)}
        </div>
      ) : (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {corePlatforms.map(p => (
              <div key={p.platform} className="kpi-card" style={{
                borderTop: `3px solid ${PLATFORM_COLORS[p.platform]}`,
              }}>
                <div className="kpi-card-label" style={{ color: PLATFORM_COLORS[p.platform], fontWeight: 700, fontSize: 13 }}>
                  {p.platform}
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ciro</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtTL(p.revenue)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Sipariş</div>
                      <div style={{ fontWeight: 600 }}>{fmtNum(p.orders)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>AOV</div>
                      <div style={{ fontWeight: 600 }}>{fmtTL(p.aov)}</div>
                    </div>
                    {p.adSpend > 0 && (
                      <>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Spend</div>
                          <div style={{ fontWeight: 600 }}>{fmtTL(p.adSpend)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>ROAS</div>
                          <div style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{fmtX(p.roas)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>CTR</div>
                          <div style={{ fontWeight: 600 }}>{fmtPct(p.ctr)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Tıklama</div>
                          <div style={{ fontWeight: 600 }}>{fmtNum(p.clicks)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="chart-card" style={{ marginBottom: 20 }}>
            <div className="chart-card-header">
              <div className="chart-card-title">Platform Bazlı Günlük Ciro Trendi</div>
            </div>
            <ReactApexChart
              type="line"
              height={340}
              series={trendChart.series}
              options={{
                chart: { toolbar: { show: false }, zoom: { enabled: false }, foreColor: '#a1a1aa' },
                stroke: { curve: 'smooth', width: 2 },
                colors: ['#1877f2', '#fbbc05', '#22c55e', '#a855f7'],
                dataLabels: { enabled: false },
                xaxis: { categories: trendChart.categories, labels: { style: { fontSize: '11px' } } },
                yaxis: { labels: { formatter: (v) => fmtTL(v) } },
                tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                legend: { position: 'top', fontSize: '12px' },
                grid: { borderColor: 'rgba(255,255,255,0.06)' },
              }}
            />
          </div>

          <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Reklam Harcama vs Ciro</div>
              </div>
              {spendVsRevenueChart.categories.length > 0 ? (
                <ReactApexChart
                  type="bar"
                  height={300}
                  series={spendVsRevenueChart.series}
                  options={{
                    chart: { toolbar: { show: false }, foreColor: '#a1a1aa' },
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
                    dataLabels: { enabled: false },
                    colors: ['#f59e0b', '#22c55e'],
                    xaxis: { categories: spendVsRevenueChart.categories },
                    yaxis: { labels: { formatter: (v) => fmtTL(v) } },
                    tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                    legend: { position: 'top', fontSize: '12px' },
                    grid: { borderColor: 'rgba(255,255,255,0.06)' },
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Reklam veri yok.
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Her Platformdan Top 3 Ürün</div>
              </div>
              <div className="card-body" style={{ padding: '0 0 12px' }}>
                {Object.entries(topProductsByPlatform).map(([plat, products]) => (
                  <div key={plat} style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, marginBottom: 8,
                      color: PLATFORM_COLORS[plat], textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{plat}</div>
                    {products.length > 0 ? products.map((p, i) => (
                      <div key={p.sku} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '4px 0', fontSize: 12,
                      }}>
                        <span style={{ color: 'var(--text-primary)' }}>{i + 1}. {p.item_name}</span>
                        <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(p.platformRevenue)}</span>
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>—</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
