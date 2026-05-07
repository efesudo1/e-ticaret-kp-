import { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import toast from 'react-hot-toast';
import { ChevronLeft, Download, Megaphone } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { kpiAPI, reportsAPI } from '../services/api';
import FilterBar from '../components/FilterBar';
import DataTable from '../components/DataTable';

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

const PLATFORM_TO_BACKEND = {
  Meta: 'meta',
  Google: 'google',
  Organic: 'organic',
  Direct: 'direct',
};

export default function PlatformsOverview() {
  const { filters } = useFilters();
  const [data, setData] = useState({ platform: null, products: null });
  const [loading, setLoading] = useState(true);
  // Drill-down state
  const [selectedPlatform, setSelectedPlatform] = useState(null); // 'Meta' | 'Google' | ...
  const [campaignsData, setCampaignsData] = useState(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [campaignDetailLoading, setCampaignDetailLoading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // ----- Platform Genel Bakış -----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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

  // ----- Drill-down: platform seçildiğinde kampanyaları çek -----
  useEffect(() => {
    if (!selectedPlatform) {
      setCampaignsData(null);
      return;
    }
    let cancelled = false;
    setCampaignsLoading(true);
    setSelectedCampaign(null); // platform değişince kampanya sıfırla
    setCampaignDetail(null);

    const backendPlatform = PLATFORM_TO_BACKEND[selectedPlatform];
    // Meta/Google için backend platform filter çalışıyor (campaigns.platform=meta/google)
    // Organic/Direct için orders.channel/campaign_name CASE'i ile gelmiyor → backend filter desteklemiyor.
    // Bu yüzden Organic/Direct için tüm kampanyalardan o platforma denk gelen sıraları frontend'de filtrelerim.

    const params = {
      ...filters,
      topCampaigns: 200,
      limitPerCampaign: 5,
      ...(backendPlatform === 'meta' || backendPlatform === 'google'
        ? { platform: backendPlatform }
        : {}),
    };

    kpiAPI.campaignProductBreakdown(params)
      .then(({ data }) => {
        if (cancelled) return;
        let camps = data.campaigns || [];
        // Organic/Direct için: backend filter yok, kampanya bazlı satış zaten sadece campaign_name dolu olan orders'dan geliyor.
        // Yani Organic/Direct için kampanya bazlı satış genelde boş — bu durumda boş array beklenir.
        // Yine de filter yapmaya gerek yok: kampanya satışı varsa o kampanya zaten bir platform kartına denk gelir.
        if (backendPlatform === 'organic' || backendPlatform === 'direct') {
          camps = camps.filter(c => !c.platform); // platform=null/empty olanlar (organic/direct attribution)
        }
        setCampaignsData({ campaigns: camps });
      })
      .catch(err => console.error('Drill-down error:', err))
      .finally(() => !cancelled && setCampaignsLoading(false));
    return () => { cancelled = true; };
  }, [selectedPlatform, filters]);

  // ----- Drill-down 2: kampanya seçildiğinde tüm ürünleri çek -----
  useEffect(() => {
    if (!selectedCampaign) {
      setCampaignDetail(null);
      return;
    }
    let cancelled = false;
    setCampaignDetailLoading(true);
    kpiAPI.campaignProductBreakdown({
      ...filters,
      topCampaigns: 1,
      limitPerCampaign: 1000,
      campaign: selectedCampaign,
    })
      .then(({ data }) => {
        if (cancelled) return;
        const c = data.campaigns?.find(c => c.campaign_name === selectedCampaign) || data.campaigns?.[0];
        setCampaignDetail(c || null);
      })
      .catch(err => console.error('Campaign detail error:', err))
      .finally(() => !cancelled && setCampaignDetailLoading(false));
    return () => { cancelled = true; };
  }, [selectedCampaign, filters]);

  const handleDownloadExcel = async () => {
    if (!selectedPlatform) return;
    setDownloadingExcel(true);
    const tid = toast.loading('Excel hazırlanıyor...');
    try {
      const params = {
        ...filters,
        platform: PLATFORM_TO_BACKEND[selectedPlatform],
      };
      if (selectedCampaign) params.campaign = selectedCampaign;
      const response = await reportsAPI.downloadPlatformDetailExcel(params);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPlatform}${selectedCampaign ? '_' + selectedCampaign.replace(/[^a-zA-Z0-9]/g, '_') : ''}.xlsx`;
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

  // ----- Üst kısım: kartlar (drill-down kapalıysa) -----
  const renderTopCards = () => (
    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {corePlatforms.map(p => (
        <div
          key={p.platform}
          className="kpi-card"
          style={{
            borderTop: `3px solid ${PLATFORM_COLORS[p.platform]}`,
            cursor: 'pointer',
          }}
          onClick={() => setSelectedPlatform(p.platform)}
          title={`${p.platform} kampanyalarını gör`}
        >
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
              {p.adSpend > 0 && <>
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
              </>}
            </div>
            <div style={{
              fontSize: 11, color: PLATFORM_COLORS[p.platform], fontWeight: 600,
              marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border-color)',
              textAlign: 'right',
            }}>
              Detayları gör →
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ----- Drill-down: platform için kampanyalar -----
  const campaignColumns = useMemo(() => [
    {
      key: 'campaign_name', label: 'Kampanya', sortable: true,
      render: (c) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.campaign_name}</span>,
    },
    { key: 'spend', label: 'Maliyet', sortable: true, align: 'right', format: (v) => fmtTL(v) },
    {
      key: 'totalRevenue', label: 'Kazanç', sortable: true, align: 'right',
      render: (c) => <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(c.totalRevenue)}</span>,
    },
    {
      key: 'profit', label: 'Net Kâr', sortable: true, align: 'right',
      sortFn: (a, b) => ((a.totalRevenue || 0) - (a.spend || 0)) - ((b.totalRevenue || 0) - (b.spend || 0)),
      render: (c) => {
        const profit = (c.totalRevenue || 0) - (c.spend || 0);
        return <span style={{ color: profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
          {fmtTL(profit)}
        </span>;
      },
    },
    {
      key: 'roas', label: 'ROAS', sortable: true, align: 'right',
      render: (c) => <span style={{ fontWeight: 600 }}>{fmtX(c.roas)}</span>,
    },
    { key: 'orderCount', label: 'Sipariş', sortable: true, align: 'right', format: (v) => fmtNum(v) },
    { key: 'totalUnits', label: 'Adet', sortable: true, align: 'right', format: (v) => fmtNum(v) },
  ], []);

  // ----- Detay: kampanya için ürünler -----
  const productColumns = useMemo(() => [
    {
      key: 'sku', label: 'SKU', sortable: true,
      render: (p) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</span>,
    },
    {
      key: 'item_name', label: 'Ürün Adı', sortable: true,
      render: (p) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.item_name}</span>,
    },
    { key: 'item_brand', label: 'Marka', sortable: true },
    { key: 'item_category', label: 'Kategori', sortable: true },
    { key: 'units_sold', label: 'Adet', sortable: true, align: 'right', format: (v) => fmtNum(v) },
    {
      key: 'revenue', label: 'Ciro', sortable: true, align: 'right',
      render: (p) => <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(p.revenue)}</span>,
    },
    {
      key: 'avgPrice', label: 'Ort. Birim Fiyat', sortable: true, align: 'right',
      sortFn: (a, b) => {
        const av = a.units_sold > 0 ? a.revenue / a.units_sold : 0;
        const bv = b.units_sold > 0 ? b.revenue / b.units_sold : 0;
        return av - bv;
      },
      render: (p) => fmtTL(p.units_sold > 0 ? p.revenue / p.units_sold : 0),
    },
  ], []);

  // ----- Trend chart (sadece üst kartlar görünürken) -----
  const trendChart = useMemo(() => {
    const days = data.platform?.dailyTrend || [];
    const series = ['Meta', 'Google', 'Organic', 'Direct'].map(name => ({
      name,
      data: days.map(d => Math.round(d[name] || 0)),
    }));
    return { series, categories: days.map(d => d.day) };
  }, [data.platform]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={true} showPlatform={false} />

      {loading ? (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="kpi-card skeleton" style={{ height: 200 }} />)}
        </div>
      ) : !selectedPlatform ? (
        // ====== ÜST: Genel Bakış (4 platform kartı + trend) ======
        <>
          {renderTopCards()}

          <div className="chart-card" style={{ marginTop: 20 }}>
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
        </>
      ) : (
        // ====== DRILL-DOWN ======
        <>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13 }}>
            <button
              className="btn-secondary-mini"
              onClick={() => { setSelectedPlatform(null); setSelectedCampaign(null); }}
            >
              <ChevronLeft size={14} /> Tüm Platformlar
            </button>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <button
              className="btn-secondary-mini"
              style={{
                color: PLATFORM_COLORS[selectedPlatform],
                borderColor: PLATFORM_COLORS[selectedPlatform],
              }}
              onClick={() => setSelectedCampaign(null)}
            >
              {selectedPlatform}
            </button>
            {selectedCampaign && <>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedCampaign}</span>
            </>}
            <button
              className="btn-excel-mini"
              style={{ marginLeft: 'auto' }}
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
            >
              <Download size={13} /> {downloadingExcel ? 'Hazırlanıyor...' : 'Excel İndir'}
            </button>
          </div>

          {/* Platform özet */}
          {!selectedCampaign && (() => {
            const p = corePlatforms.find(x => x.platform === selectedPlatform);
            if (!p) return null;
            return (
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="kpi-card">
                  <div className="kpi-card-label">Toplam Ciro</div>
                  <div className="kpi-card-value" style={{ color: 'var(--accent-green)' }}>{fmtTL(p.revenue)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-card-label">Reklam Harcaması</div>
                  <div className="kpi-card-value">{fmtTL(p.adSpend)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-card-label">ROAS</div>
                  <div className="kpi-card-value" style={{ color: 'var(--accent-amber)' }}>{fmtX(p.roas)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-card-label">Sipariş Sayısı</div>
                  <div className="kpi-card-value">{fmtNum(p.orders)}</div>
                </div>
              </div>
            );
          })()}

          {/* Kampanya tablosu */}
          {!selectedCampaign && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone size={14} /> {selectedPlatform} Kampanyaları
                {campaignsData && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto', fontSize: 11 }}>
                  Bir satıra tıkla → ürün detayı
                </span>}
              </div>
              {campaignsLoading ? (
                <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Yükleniyor...
                </div></div>
              ) : campaignsData?.campaigns?.length ? (
                <DataTable
                  rows={campaignsData.campaigns}
                  columns={[
                    ...campaignColumns,
                    {
                      key: '_action', label: '', sortable: false, align: 'right',
                      render: (c) => (
                        <button
                          className="btn-icon-mini"
                          onClick={(e) => { e.stopPropagation(); setSelectedCampaign(c.campaign_name); }}
                          title="Bu kampanyanın ürünlerini gör"
                        >→</button>
                      ),
                    },
                  ]}
                  searchable
                  searchPlaceholder="Kampanya ara..."
                  defaultSort={{ key: 'totalRevenue', dir: 'desc' }}
                  emptyMessage={`${selectedPlatform} için kampanya bulunamadı (organic/direct platformlarında kampanya bazlı satış olmayabilir).`}
                  rowKey={(c) => c.campaign_name}
                />
              ) : (
                <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {selectedPlatform === 'Organic' || selectedPlatform === 'Direct'
                    ? `${selectedPlatform} trafik kampanya bazlı atfedilmediği için kampanya listesi boş — bu kanal için ciro doğrudan üst kart KPI'larında görünür.`
                    : 'Bu tarih aralığında kampanya verisi yok.'}
                </div></div>
              )}
            </div>
          )}

          {/* Kampanya detayı: ürünler */}
          {selectedCampaign && (
            <div style={{ marginTop: 16 }}>
              {campaignDetailLoading ? (
                <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Yükleniyor...
                </div></div>
              ) : campaignDetail ? (
                <>
                  {/* Kampanya özeti */}
                  <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div className="kpi-card">
                      <div className="kpi-card-label">Maliyet</div>
                      <div className="kpi-card-value">{fmtTL(campaignDetail.spend)}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-card-label">Kazanç</div>
                      <div className="kpi-card-value" style={{ color: 'var(--accent-green)' }}>{fmtTL(campaignDetail.totalRevenue)}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-card-label">Net Kâr</div>
                      <div className="kpi-card-value" style={{ color: campaignDetail.totalRevenue - campaignDetail.spend >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {fmtTL((campaignDetail.totalRevenue || 0) - (campaignDetail.spend || 0))}
                      </div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-card-label">ROAS</div>
                      <div className="kpi-card-value" style={{ color: 'var(--accent-amber)' }}>{fmtX(campaignDetail.roas)}</div>
                    </div>
                  </div>

                  {/* Ürün tablosu */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                      {selectedCampaign} — Satılan Ürünler ({campaignDetail.topProducts?.length || 0})
                    </div>
                    {campaignDetail.topProducts?.length ? (
                      <DataTable
                        rows={campaignDetail.topProducts}
                        columns={productColumns}
                        searchable
                        searchPlaceholder="Ürün ara (SKU, isim, marka)..."
                        defaultSort={{ key: 'revenue', dir: 'desc' }}
                        rowKey={(p) => p.sku}
                      />
                    ) : (
                      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        Bu kampanyada satış yapılan ürün yok.
                      </div></div>
                    )}
                  </div>
                </>
              ) : (
                <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Kampanya verisi bulunamadı.
                </div></div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
