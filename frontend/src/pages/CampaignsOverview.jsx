import { useEffect, useState, useMemo, Fragment } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ChevronDown, ChevronRight, Megaphone, DollarSign, TrendingUp, ArrowDownUp, Scale, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFilters } from '../context/FilterContext';
import { kpiAPI, reportsAPI } from '../services/api';
import FilterBar from '../components/FilterBar';

const fmtTL = (n) => '₺' + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtX = (n) => n == null ? '–' : `${Number(n).toFixed(2)}x`;

const PlatformBadge = ({ platform }) => {
  if (!platform) return null;
  const colors = {
    meta:   { bg: 'rgba(24,119,242,.15)',  text: '#1877f2' },
    google: { bg: 'rgba(251,188,5,.15)',   text: '#fbbc05' },
  };
  const c = colors[platform] || { bg: 'rgba(255,255,255,.08)', text: 'var(--text-muted)' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 11,
      background: c.bg, color: c.text,
      textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5,
    }}>{platform}</span>
  );
};

export default function CampaignsOverview() {
  const { filters } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [sortKey, setSortKey] = useState('totalRevenue');
  const [productDirection, setProductDirection] = useState('top'); // 'top' | 'bottom'
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [compareMetrics, setCompareMetrics] = useState({
    revenue: true, spend: true, roas: true, orders: true, units: true,
    aov: true, revenuePerUnit: true, profit: true, topProduct: true,
  });
  const [downloadingTable, setDownloadingTable] = useState(false);
  const [downloadingCompare, setDownloadingCompare] = useState(false);

  const triggerBlobDownload = (response, filename) => {
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadCampaigns = async () => {
    setDownloadingTable(true);
    const tid = toast.loading('Excel hazırlanıyor...');
    try {
      const response = await reportsAPI.downloadCampaignsExcel(filters);
      const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
      triggerBlobDownload(response, `kampanya_raporu${dateSuffix ? '_' + dateSuffix : ''}.xlsx`);
      toast.success('İndirildi', { id: tid });
    } catch (err) {
      toast.error('İndirilemedi', { id: tid });
    } finally {
      setDownloadingTable(false);
    }
  };

  const handleDownloadCompare = async () => {
    if (!compareA || !compareB) return;
    setDownloadingCompare(true);
    const tid = toast.loading('Karşılaştırma hazırlanıyor...');
    try {
      const activeMetrics = Object.entries(compareMetrics)
        .filter(([, on]) => on)
        .map(([k]) => k)
        .join(',');
      const response = await reportsAPI.downloadCampaignComparisonExcel({
        ...filters,
        campA: compareA,
        campB: compareB,
        metrics: activeMetrics,
      });
      const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      triggerBlobDownload(response, `karsilastirma_${safe(compareA)}_vs_${safe(compareB)}.xlsx`);
      toast.success('İndirildi', { id: tid });
    } catch (err) {
      toast.error('İndirilemedi', { id: tid });
    } finally {
      setDownloadingCompare(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    kpiAPI.campaignProductBreakdown({
      ...filters,
      topCampaigns: 50,
      limitPerCampaign: 5,
      direction: productDirection,
    })
      .then(({ data }) => !cancelled && setData(data))
      .catch(err => console.error('Campaigns load error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters, productDirection]);

  const campaigns = useMemo(() => {
    if (!data?.campaigns) return [];
    const sorted = [...data.campaigns].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return bv - av;
    });
    return sorted;
  }, [data, sortKey]);

  const summary = useMemo(() => {
    if (!campaigns.length) return { count: 0, totalRevenue: 0, totalSpend: 0 };
    return campaigns.reduce((acc, c) => ({
      count: acc.count + 1,
      totalRevenue: acc.totalRevenue + (c.totalRevenue || 0),
      totalSpend: acc.totalSpend + (c.spend || 0),
    }), { count: 0, totalRevenue: 0, totalSpend: 0 });
  }, [campaigns]);

  const top10Chart = useMemo(() => {
    const top10 = campaigns.slice(0, 10);
    return {
      series: [{ name: 'Ciro', data: top10.map(c => Math.round(c.totalRevenue || 0)) }],
      categories: top10.map(c => c.campaign_name),
    };
  }, [campaigns]);

  const toggle = (name) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name); else next.add(name);
    setExpanded(next);
  };

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={false} />

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-card-icon rose"><Megaphone size={22} /></div>
          <div className="kpi-card-label">Aktif Kampanya</div>
          <div className="kpi-card-value">{fmtNum(summary.count)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon amber"><DollarSign size={22} /></div>
          <div className="kpi-card-label">Toplam Reklam Harcama</div>
          <div className="kpi-card-value">{fmtTL(summary.totalSpend)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-icon green"><TrendingUp size={22} /></div>
          <div className="kpi-card-label">Toplam Kampanya Cirosu</div>
          <div className="kpi-card-value">{fmtTL(summary.totalRevenue)}</div>
        </div>
      </div>

      {/* ==== Kampanya Karşılaştırma ==== */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scale size={16} /> Kampanya Karşılaştırma
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              İki kampanyayı yan yana karşılaştır
            </span>
            <button
              type="button"
              onClick={handleDownloadCompare}
              disabled={!compareA || !compareB || downloadingCompare}
              className="btn-excel-mini"
              title={!compareA || !compareB ? 'Önce iki kampanya seçin' : 'Karşılaştırmayı Excel olarak indir'}
            >
              <Download size={13} />
              {downloadingCompare ? 'Hazırlanıyor...' : 'Excel'}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <select
              value={compareA}
              onChange={e => setCompareA(e.target.value)}
              style={{
                background: 'var(--bg-glass)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="">Birinci kampanya seç...</option>
              {campaigns.map(c => <option key={c.campaign_name} value={c.campaign_name}>{c.campaign_name}</option>)}
            </select>
            <select
              value={compareB}
              onChange={e => setCompareB(e.target.value)}
              style={{
                background: 'var(--bg-glass)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="">İkinci kampanya seç...</option>
              {campaigns.map(c => <option key={c.campaign_name} value={c.campaign_name}>{c.campaign_name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['revenue',        'Ciro'],
              ['spend',          'Reklam Harcama'],
              ['roas',           'ROAS'],
              ['orders',         'Sipariş'],
              ['units',          'Adet'],
              ['aov',            'AOV'],
              ['revenuePerUnit', 'Ürün Başı Ciro'],
              ['profit',         'Kâr (Ciro−Spend)'],
              ['topProduct',     'En Çok Satan Ürün'],
            ].map(([key, label]) => (
              <label
                key={key}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  background: compareMetrics[key] ? 'rgba(227,6,19,.12)' : 'var(--bg-glass)',
                  border: `1px solid ${compareMetrics[key] ? 'var(--accent-red)' : 'var(--border-color)'}`,
                  color: compareMetrics[key] ? 'var(--accent-red)' : 'var(--text-muted)',
                  fontWeight: 600,
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={compareMetrics[key]}
                  onChange={e => setCompareMetrics(m => ({ ...m, [key]: e.target.checked }))}
                  style={{ display: 'none' }}
                />
                {label}
              </label>
            ))}
          </div>

          {compareA && compareB ? (() => {
            const a = campaigns.find(c => c.campaign_name === compareA);
            const b = campaigns.find(c => c.campaign_name === compareB);
            if (!a || !b) return <div style={{ color: 'var(--text-muted)' }}>Veri yok.</div>;

            const metrics = (c) => ({
              revenue:        c.totalRevenue || 0,
              spend:          c.spend || 0,
              roas:           c.roas,
              orders:         c.orderCount || 0,
              units:          c.totalUnits || 0,
              aov:            c.orderCount > 0 ? (c.totalRevenue || 0) / c.orderCount : 0,
              revenuePerUnit: c.totalUnits > 0 ? (c.totalRevenue || 0) / c.totalUnits : 0,
              profit:         (c.totalRevenue || 0) - (c.spend || 0),
              topProduct:     c.topProducts?.[0]?.item_name || '—',
            });
            const ma = metrics(a);
            const mb = metrics(b);

            const fmt = (k, v) => {
              if (v == null) return '–';
              if (k === 'roas') return fmtX(v);
              if (k === 'topProduct') return v;
              if (k === 'orders' || k === 'units') return fmtNum(v);
              return fmtTL(v);
            };

            const diff = (k) => {
              if (k === 'topProduct') return null;
              if (ma[k] == null || mb[k] == null) return null;
              if (mb[k] === 0) return ma[k] === 0 ? 0 : null;
              return ((ma[k] - mb[k]) / Math.abs(mb[k])) * 100;
            };

            const labels = {
              revenue: 'Ciro', spend: 'Reklam Harcama', roas: 'ROAS',
              orders: 'Sipariş', units: 'Satılan Adet', aov: 'AOV',
              revenuePerUnit: 'Ürün Başı Ciro', profit: 'Net (Ciro−Spend)',
              topProduct: 'En Çok Satan',
            };

            const activeKeys = Object.keys(labels).filter(k => compareMetrics[k]);

            return (
              <div className="compare-grid" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.6fr' }}>
                <div className="compare-col">
                  <div className="compare-col-header" style={{ color: 'var(--text-muted)' }}>METRİK</div>
                  {activeKeys.map(k => (
                    <div key={k} className="compare-row">
                      <span className="compare-label">{labels[k]}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-col">
                  <div className="compare-col-header" style={{ color: 'var(--accent-red)' }}>{a.campaign_name}</div>
                  {activeKeys.map(k => (
                    <div key={k} className="compare-row">
                      <span className="compare-value">{fmt(k, ma[k])}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-col">
                  <div className="compare-col-header" style={{ color: 'var(--accent-blue)' }}>{b.campaign_name}</div>
                  {activeKeys.map(k => (
                    <div key={k} className="compare-row">
                      <span className="compare-value">{fmt(k, mb[k])}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-col">
                  <div className="compare-col-header" style={{ color: 'var(--text-muted)' }}>FARK</div>
                  {activeKeys.map(k => {
                    const d = diff(k);
                    if (d == null) {
                      return <div key={k} className="compare-row"><span className="compare-value" style={{ color: 'var(--text-muted)' }}>–</span></div>;
                    }
                    const positive = d >= 0;
                    return (
                      <div key={k} className="compare-row">
                        <span className="compare-value" style={{
                          color: positive ? 'var(--accent-green)' : 'var(--accent-red)',
                          fontSize: 12,
                        }}>
                          {positive ? '+' : ''}{d.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              Karşılaştırmak için iki kampanya seç.
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Kampanya Performansı</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <button
              type="button"
              onClick={handleDownloadCampaigns}
              disabled={downloadingTable || campaigns.length === 0}
              className="btn-excel-mini"
              title="Kampanya tablosunu (top 5 + bottom 5 dahil) Excel olarak indir"
            >
              <Download size={13} />
              {downloadingTable ? 'Hazırlanıyor...' : 'Excel'}
            </button>
            <button
              type="button"
              className="btn-toggle-direction"
              onClick={() => setProductDirection(d => d === 'top' ? 'bottom' : 'top')}
              title={productDirection === 'top' ? 'En az satan ürünleri göster' : 'En çok satan ürünleri göster'}
            >
              <ArrowDownUp size={13} />
              {productDirection === 'top' ? 'En Çok Satan 5' : 'En Az Satan 5'}
            </button>
            <span>
              Sıralama:&nbsp;
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value)}
                style={{
                  background: 'var(--bg-glass)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)', borderRadius: 6,
                  padding: '4px 8px', fontSize: 12, fontFamily: 'inherit',
                }}
              >
                <option value="totalRevenue">Ciro</option>
                <option value="spend">Reklam Harcama</option>
                <option value="roas">ROAS</option>
                <option value="totalUnits">Adet</option>
              </select>
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Kampanya</th>
                    <th>Platform</th>
                    <th style={{ textAlign: 'right' }}>Reklam Harcama</th>
                    <th style={{ textAlign: 'right' }}>Ciro</th>
                    <th style={{ textAlign: 'right' }}>ROAS</th>
                    <th style={{ textAlign: 'right' }}>Adet</th>
                    <th>En İyi Ürün</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length ? campaigns.map(c => (
                    <Fragment key={c.campaign_name}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggle(c.campaign_name)}>
                        <td>{expanded.has(c.campaign_name) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.campaign_name}</td>
                        <td><PlatformBadge platform={c.platform} /></td>
                        <td style={{ textAlign: 'right' }}>{fmtTL(c.spend)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(c.totalRevenue)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtX(c.roas)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(c.totalUnits)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {c.topProducts?.[0]?.item_name || '—'}
                        </td>
                      </tr>
                      {expanded.has(c.campaign_name) && (
                        <tr>
                          <td></td>
                          <td colSpan={7} style={{ padding: 0, background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ padding: '12px 20px' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {productDirection === 'top' ? 'En Çok' : 'En Az'} Satan {c.topProducts?.length || 0} Ürün
                              </div>
                              <table style={{ width: '100%', fontSize: 12 }}>
                                <tbody>
                                  {c.topProducts?.map(p => (
                                    <tr key={p.sku}>
                                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)', width: 30 }}>#{p.rank}</td>
                                      <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{p.item_name}</td>
                                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{p.item_brand}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtNum(p.units_sold)} adet</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--accent-green)', fontWeight: 600 }}>{fmtTL(p.revenue)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )) : (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      Veri yok.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">En İyi 10 Kampanya — Ciro</div>
          </div>
          <ReactApexChart
            type="bar"
            height={Math.max(280, top10Chart.categories.length * 36)}
            series={top10Chart.series}
            options={{
              chart: { toolbar: { show: false }, foreColor: '#a1a1aa' },
              plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
              dataLabels: { enabled: false },
              colors: ['#E30613'],
              xaxis: { categories: top10Chart.categories, labels: { formatter: (v) => fmtTL(v) } },
              yaxis: { labels: { style: { fontSize: '11px' } } },
              tooltip: { theme: 'dark', y: { formatter: (v) => fmtTL(v) } },
              grid: { borderColor: 'rgba(255,255,255,0.06)' },
            }}
          />
        </div>
      )}
    </div>
  );
}
