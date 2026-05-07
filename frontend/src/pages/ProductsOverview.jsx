import { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import toast from 'react-hot-toast';
import { Package, Award, Tag, X, Download } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { kpiAPI, reportsAPI } from '../services/api';
import FilterBar from '../components/FilterBar';
import DataTable from '../components/DataTable';

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
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // ---- Tüm ürünleri çek (DB'deki) ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    kpiAPI.allProducts(filters)
      .then(({ data }) => {
        if (cancelled) return;
        setAllProducts(data.products || []);
      })
      .catch(err => console.error('All products error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  // ---- Ürün seçilince detay çek (kampanya breakdown + platform breakdown) ----
  useEffect(() => {
    if (!selectedSku) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([
      kpiAPI.productCampaignBreakdown({ ...filters, sku: selectedSku, limitCampaignsPerProduct: 50 }),
      kpiAPI.productPlatformBreakdown({ ...filters, limitProducts: 200 }),
    ])
      .then(([pc, pp]) => {
        if (cancelled) return;
        const product = pc.data?.products?.[0];
        const platformData = pp.data?.products?.find(p => p.sku === selectedSku);
        setDetail({ product, platformData });
      })
      .catch(err => console.error('Product detail error:', err))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => { cancelled = true; };
  }, [selectedSku, filters]);

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    const tid = toast.loading('Excel hazırlanıyor...');
    try {
      const response = await reportsAPI.downloadProductsExcel(filters);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
      a.download = `tum_urunler${dateSuffix ? '_' + dateSuffix : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('İndirildi', { id: tid });
    } catch {
      toast.error('İndirilemedi', { id: tid });
    } finally {
      setDownloadingExcel(false);
    }
  };

  const summary = useMemo(() => {
    const totalProducts = allProducts.length;
    const totalRevenue = allProducts.reduce((s, p) => s + (p.totalRevenue || 0), 0);
    const totalUnits = allProducts.reduce((s, p) => s + (p.totalUnits || 0), 0);
    const top = [...allProducts].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
    const sellingProducts = allProducts.filter(p => p.totalUnits > 0).length;
    return { totalProducts, totalRevenue, totalUnits, top, sellingProducts };
  }, [allProducts]);

  const columns = useMemo(() => [
    {
      key: 'sku', label: 'SKU', sortable: true,
      render: (p) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.sku}</span>,
    },
    {
      key: 'item_name', label: 'Ürün Adı', sortable: true,
      render: (p) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.item_name}</span>,
    },
    { key: 'item_brand', label: 'Marka', sortable: true },
    { key: 'item_category', label: 'Kategori', sortable: true },
    { key: 'price', label: 'Fiyat', sortable: true, align: 'right', format: (v) => fmtTL(v) },
    {
      key: 'marginPercent', label: 'Marj', sortable: true, align: 'right',
      render: (p) => (
        <span style={{
          color: p.marginPercent >= 30 ? 'var(--accent-green)' : p.marginPercent >= 15 ? 'var(--accent-amber)' : 'var(--accent-red)',
          fontWeight: 600,
        }}>%{p.marginPercent}</span>
      ),
    },
    { key: 'stock_quantity', label: 'Stok', sortable: true, align: 'right', format: (v) => fmtNum(v) },
    { key: 'totalUnits', label: 'Satılan', sortable: true, align: 'right', format: (v) => fmtNum(v) },
    {
      key: 'totalRevenue', label: 'Ciro', sortable: true, align: 'right',
      render: (p) => p.totalRevenue > 0
        ? <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(p.totalRevenue)}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: '_action', label: '', sortable: false, align: 'right',
      render: (p) => (
        <button
          className="btn-icon-mini"
          onClick={(e) => { e.stopPropagation(); setSelectedSku(p.sku); }}
          title="Kampanya detaylarını gör"
        >→</button>
      ),
    },
  ], []);

  const selectedProduct = detail?.product;

  // Detail modal — kampanya bar chart + platform donut
  const campaignBarChart = useMemo(() => {
    if (!selectedProduct?.campaigns) return { series: [], categories: [] };
    const top = selectedProduct.campaigns.slice(0, 10);
    return {
      series: [{ name: 'Ciro', data: top.map(c => Math.round(c.revenue || 0)) }],
      categories: top.map(c => c.campaign_name),
    };
  }, [selectedProduct]);

  const platformDonut = useMemo(() => {
    const platformData = detail?.platformData?.platforms;
    if (!platformData) return { series: [], labels: [] };
    const entries = Object.entries(platformData).filter(([, v]) => (v?.revenue || 0) > 0);
    return {
      series: entries.map(([, v]) => Math.round(v.revenue)),
      labels: entries.map(([k]) => k),
    };
  }, [detail]);

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={true} showBrand={true} showCategory={true} />

      {/* KPI'lar */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-card-icon cyan"><Package size={22} /></div>
          <div className="kpi-card-label">Toplam Ürün</div>
          <div className="kpi-card-value">{fmtNum(summary.totalProducts)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.sellingProducts} ürün satış yaptı
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon green"><Tag size={22} /></div>
          <div className="kpi-card-label">Toplam Ciro</div>
          <div className="kpi-card-value">{fmtTL(summary.totalRevenue)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon amber"><Package size={22} /></div>
          <div className="kpi-card-label">Toplam Satılan Adet</div>
          <div className="kpi-card-value">{fmtNum(summary.totalUnits)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon rose"><Award size={22} /></div>
          <div className="kpi-card-label">En Çok Kazandıran</div>
          <div className="kpi-card-value" style={{ fontSize: 14, lineHeight: 1.4 }}>
            {summary.top?.item_name || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.top ? fmtTL(summary.top.totalRevenue) : ''}
          </div>
        </div>
      </div>

      {/* Üst başlık + indir butonu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Tüm Ürünler ({fmtNum(allProducts.length)})
        </div>
        <button className="btn-excel-mini" onClick={handleDownloadExcel} disabled={downloadingExcel || allProducts.length === 0}>
          <Download size={13} /> {downloadingExcel ? 'Hazırlanıyor...' : 'Excel İndir'}
        </button>
      </div>

      {/* Ürün tablosu (DataTable: arama + sort) */}
      {loading ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Yükleniyor...
        </div></div>
      ) : (
        <DataTable
          rows={allProducts}
          columns={columns}
          searchable
          searchPlaceholder="Ürün ara (SKU, ad, marka, kategori)..."
          defaultSort={{ key: 'totalRevenue', dir: 'desc' }}
          rowKey={(p) => p.sku}
          emptyMessage="Filtrelere uyan ürün bulunamadı."
        />
      )}

      {/* Detay Modal */}
      {selectedSku && (
        <div className="modal-overlay" onClick={() => setSelectedSku(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '92vh' }}>
            <div className="modal-header">
              <div className="modal-title">
                <Package size={18} />
                {selectedProduct?.item_name || selectedSku}
              </div>
              <button className="btn-icon-mini" onClick={() => setSelectedSku(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Yükleniyor...</div>
              ) : selectedProduct ? (
                <>
                  {/* Üst KPI'lar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>SKU</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 4, color: 'var(--text-primary)' }}>{selectedProduct.sku}</div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Marka / Kategori</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{selectedProduct.item_brand} / {selectedProduct.item_category}</div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Toplam Ciro</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>{fmtTL(selectedProduct.totalRevenue)}</div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Adet / Sipariş</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                        {fmtNum(selectedProduct.totalUnits)} adet · {fmtNum(selectedProduct.orderCount)} sipariş
                      </div>
                    </div>
                  </div>

                  {/* Kampanya bar + Platform donut */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
                    <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        En Kazandıran Kampanyalar
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
                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>Kampanya satışı yok</div>
                      )}
                    </div>
                    <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        Platform Dağılımı
                      </div>
                      {platformDonut.series.length > 0 ? (
                        <ReactApexChart
                          type="donut"
                          height={250}
                          series={platformDonut.series}
                          options={{
                            chart: { foreColor: '#a1a1aa' },
                            labels: platformDonut.labels,
                            colors: platformDonut.labels.map(l => PLATFORM_COLORS[l] || '#71717a'),
                            legend: { position: 'bottom', fontSize: '11px' },
                            dataLabels: { formatter: (v) => `${v.toFixed(0)}%` },
                            tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
                            stroke: { colors: ['#0c0c0e'], width: 2 },
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>Platform verisi yok</div>
                      )}
                    </div>
                  </div>

                  {/* Kampanya detay tablosu */}
                  {selectedProduct.campaigns?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        Tüm Kampanyalar — Detay
                      </div>
                      <DataTable
                        rows={selectedProduct.campaigns}
                        columns={[
                          {
                            key: 'campaign_name', label: 'Kampanya', sortable: true,
                            render: (c) => <span style={{ fontWeight: 600 }}>{c.campaign_name}</span>,
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
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>organic</span>,
                          },
                          { key: 'units', label: 'Adet', sortable: true, align: 'right', format: (v) => fmtNum(v) },
                          {
                            key: 'revenue', label: 'Ciro', sortable: true, align: 'right',
                            render: (c) => <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(c.revenue)}</span>,
                          },
                          { key: 'orders', label: 'Sipariş', sortable: true, align: 'right', format: (v) => fmtNum(v) },
                        ]}
                        searchable={false}
                        defaultSort={{ key: 'revenue', dir: 'desc' }}
                        rowKey={(c) => c.campaign_name}
                        compact
                      />
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Detay yüklenemedi.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
