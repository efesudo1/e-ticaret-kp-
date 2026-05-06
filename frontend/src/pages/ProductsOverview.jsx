import { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { Package, Award, Tag, Search } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { kpiAPI } from '../services/api';
import FilterBar from '../components/FilterBar';

const fmtTL = (n) => '₺' + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR');

const PLATFORM_COLORS = {
  Meta: '#1877f2',
  Google: '#fbbc05',
  Organic: '#22c55e',
  Direct: '#a855f7',
};

export default function ProductsOverview() {
  const { filters } = useFilters();
  const [data, setData] = useState({ products: null, platforms: null });
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      kpiAPI.productCampaignBreakdown({ ...filters, limitProducts: 30, limitCampaignsPerProduct: 5 }),
      kpiAPI.productPlatformBreakdown({ ...filters, limitProducts: 30 }),
    ])
      .then(([pc, pp]) => {
        if (cancelled) return;
        setData({ products: pc.data, platforms: pp.data });
        // ilk ürünü otomatik seç
        if (pc.data?.products?.[0]) setSelectedSku(pc.data.products[0].sku);
      })
      .catch(err => console.error('Products load error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  // Seçili ürün değişince detay çek
  useEffect(() => {
    if (!selectedSku) return;
    let cancelled = false;
    kpiAPI.productCampaignBreakdown({ ...filters, sku: selectedSku, limitCampaignsPerProduct: 20 })
      .then(({ data }) => {
        if (cancelled) return;
        setSelectedDetail(data?.products?.[0] || null);
      })
      .catch(err => console.error('Product detail error:', err));
    return () => { cancelled = true; };
  }, [selectedSku, filters]);

  const filteredProducts = useMemo(() => {
    const list = data.products?.products || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(p =>
      p.item_name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.item_brand?.toLowerCase().includes(q)
    );
  }, [data.products, search]);

  const summary = useMemo(() => {
    const list = data.products?.products || [];
    const totalRevenue = list.reduce((s, p) => s + (p.totalRevenue || 0), 0);
    const totalUnits = list.reduce((s, p) => s + (p.totalUnits || 0), 0);
    const top = list[0];
    return { totalUnits, totalRevenue, top };
  }, [data.products]);

  const selectedPlatformData = useMemo(() => {
    if (!selectedSku || !data.platforms?.products) return null;
    return data.platforms.products.find(p => p.sku === selectedSku);
  }, [selectedSku, data.platforms]);

  const campaignBarChart = useMemo(() => {
    if (!selectedDetail?.campaigns) return { series: [], categories: [] };
    const top = selectedDetail.campaigns.slice(0, 8);
    return {
      series: [{ name: 'Ciro', data: top.map(c => Math.round(c.revenue || 0)) }],
      categories: top.map(c => c.campaign_name),
    };
  }, [selectedDetail]);

  const platformDonut = useMemo(() => {
    if (!selectedPlatformData?.platforms) return { series: [], labels: [] };
    const entries = Object.entries(selectedPlatformData.platforms)
      .filter(([, v]) => (v?.revenue || 0) > 0);
    return {
      series: entries.map(([, v]) => Math.round(v.revenue)),
      labels: entries.map(([k]) => k),
    };
  }, [selectedPlatformData]);

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={false} showBrand={true} showCategory={true} />

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-card-icon cyan"><Package size={22} /></div>
          <div className="kpi-card-label">Toplam Satılan Adet</div>
          <div className="kpi-card-value">{fmtNum(summary.totalUnits)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon green"><Tag size={22} /></div>
          <div className="kpi-card-label">Top {data.products?.products?.length || 0} Ürün Cirosu</div>
          <div className="kpi-card-value">{fmtTL(summary.totalRevenue)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon amber"><Award size={22} /></div>
          <div className="kpi-card-label">En Çok Kazandıran</div>
          <div className="kpi-card-value" style={{ fontSize: 16, lineHeight: 1.4 }}>
            {summary.top?.item_name || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {summary.top ? fmtTL(summary.top.totalRevenue) : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20 }}>
        {/* Sol: ürün listesi */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ürünler</div>
          </div>
          <div className="card-body" style={{ padding: '0 0 12px' }}>
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Ürün/SKU/marka ara..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 34px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
            </div>
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
              ) : filteredProducts.length ? filteredProducts.map(p => (
                <div
                  key={p.sku}
                  onClick={() => setSelectedSku(p.sku)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderLeft: selectedSku === p.sku ? '3px solid var(--accent-red)' : '3px solid transparent',
                    background: selectedSku === p.sku ? 'rgba(227,6,19,.05)' : 'transparent',
                    transition: 'all 150ms',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {p.item_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{p.item_brand} · {p.sku}</span>
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(p.totalRevenue)}</span>
                  </div>
                </div>
              )) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sonuç bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sağ: seçili ürün detay */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selectedDetail ? (
            <>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">{selectedDetail.item_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {selectedDetail.item_brand} · {selectedDetail.item_category} · SKU: {selectedDetail.sku}
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Toplam Ciro</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtTL(selectedDetail.totalRevenue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Adet</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(selectedDetail.totalUnits)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sipariş Sayısı</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(selectedDetail.orderCount)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="chart-card" style={{ minHeight: 260 }}>
                <div className="chart-card-header">
                  <div className="chart-card-title">En Kazandıran Kampanyalar</div>
                </div>
                {campaignBarChart.categories.length > 0 ? (
                  <ReactApexChart
                    type="bar"
                    height={Math.max(220, campaignBarChart.categories.length * 32)}
                    series={campaignBarChart.series}
                    options={{
                      chart: { toolbar: { show: false }, foreColor: '#a1a1aa' },
                      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
                      dataLabels: { enabled: false },
                      colors: ['#E30613'],
                      xaxis: { categories: campaignBarChart.categories, labels: { formatter: (v) => fmtTL(v) } },
                      yaxis: { labels: { style: { fontSize: '10px' } } },
                      tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                      grid: { borderColor: 'rgba(255,255,255,0.06)' },
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Kampanya satışı yok.</div>
                )}
              </div>

              <div className="chart-card" style={{ minHeight: 260 }}>
                <div className="chart-card-header">
                  <div className="chart-card-title">Platform Dağılımı</div>
                </div>
                {platformDonut.series.length > 0 ? (
                  <ReactApexChart
                    type="donut"
                    height={260}
                    series={platformDonut.series}
                    options={{
                      chart: { foreColor: '#a1a1aa' },
                      labels: platformDonut.labels,
                      colors: platformDonut.labels.map(l => PLATFORM_COLORS[l] || '#71717a'),
                      legend: { position: 'bottom', fontSize: '12px' },
                      dataLabels: { formatter: (v) => `${v.toFixed(0)}%` },
                      tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                      stroke: { colors: ['#0c0c0e'], width: 2 },
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Platform verisi yok.</div>
                )}
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                Detay görüntülemek için bir ürün seçin.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
