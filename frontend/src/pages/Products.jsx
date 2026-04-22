import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { Filter, X, PackageOpen, AlertTriangle, ArrowDown } from 'lucide-react';

const fmt = n => n==null?'0':Number(n)>=1e6?(n/1e6).toFixed(1)+'M':Number(n)>=1e3?(n/1e3).toFixed(1)+'K':Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺'+Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtPct = n => (Number(n||0)*100).toFixed(1)+'%';

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

export default function Products() {
  const [products, setProducts] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('totalRevenue');
  const [activeTab, setActiveTab] = useState('performance');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', category: '', brand: '' });

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, funnelRes, stockRes] = await Promise.all([
        kpiAPI.productPerformance(filters),
        kpiAPI.funnel(filters),
        kpiAPI.stockAnalysis(filters)
      ]);
      setProducts(prodRes.data);
      setFunnel(funnelRes.data);
      setStockInfo(stockRes.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const funnelChart = funnel ? {
    series: [
      { name: 'Dönüşüm Hunisi', data: [
        Number(funnel.listViews||0), Number(funnel.listClicks||0),
        Number(funnel.productViews||0), Number(funnel.addToCart||0),
        Number(funnel.checkout||0), Number(funnel.purchased||0),
      ]}
    ],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 320 },
      plotOptions: { bar: { borderRadius: 6, horizontal: true, barHeight: '60%',
        dataLabels: { position: 'bottom' } } },
      xaxis: { ...chartBase.xaxis, categories: [
        'Liste Görüntüleme','Liste Tıklama','Ürün Görüntüleme',
        'Sepete Ekle','Ödemeye Git','Satın Aldı'
      ]},
      colors: ['#E30613'], fill: {
        type: 'gradient',
        gradient: { shade: 'dark', type: 'horizontal', shadeIntensity: 0.5, opacityFrom: 1, opacityTo: 0.7 }
      },
      dataLabels: { enabled: true, formatter: v => fmt(v), style: { fontFamily: 'Futura PT', colors: ['#f1f5f9'], fontSize: '12px' } },
      tooltip: { ...chartBase.tooltip, x: { show: true } }
    }
  } : null;

  const abcChart = stockInfo?.abcAnalysis?.length ? {
    series: stockInfo.abcAnalysis.map(a => Number(a.revenue)),
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 260 },
      labels: stockInfo.abcAnalysis.map(a => `Sınıf ${a.grade}`),
      colors: ['#22c55e', '#3b82f6', '#f59e0b'],
      plotOptions: { pie: { donut: { size: '65%' } } }
    }
  } : null;

  const filteredProducts = products?.filter(p => {
    if (search && !p.product_name?.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.brand && p.brand !== filters.brand) return false;
    return true;
  }).sort((a, b) => Number(b[sortBy]||0) - Number(a[sortBy]||0)) || [];

  const categories = [...new Set(products?.map(p=>p.category).filter(Boolean))];
  const brands = [...new Set(products?.map(p=>p.brand).filter(Boolean))];

  return (
    <div className="animate-fade-in">
      <div className="filter-bar">
        <Filter size={16} style={{ color:'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e=>setFilters(p=>({...p,startDate:e.target.value}))} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e=>setFilters(p=>({...p,endDate:e.target.value}))} /></div>
        <div className="filter-item"><label>Kategori</label>
          <select className="select" value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))}>
            <option value="">Tümü</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-item"><label>Marka</label>
          <select className="select" value={filters.brand} onChange={e=>setFilters(p=>({...p,brand:e.target.value}))}>
            <option value="">Tümü</option>{brands.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="tabs">
        {['performance', 'stock'].map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {t==='performance' ? 'Performans & Hunisi' : 'Stok Analizi & Riskler'}
          </button>
        ))}
      </div>

      {activeTab === 'performance' && (
        <>
          {/* Funnel */}
          {funnelChart && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <div className="chart-card-header">
                <div className="chart-card-title">Ürün Dönüşüm Hunisi (GA4)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Toplam Gelir: <strong style={{color:'var(--accent-green)'}}>{fmtCur(funnel?.totalRevenue)}</strong>
                </div>
              </div>
              <Chart options={funnelChart.options} series={funnelChart.series} type="bar" height={320} />
              <div style={{ display:'flex', gap:16, padding:'0 16px 8px', flexWrap:'wrap' }}>
                {funnel?.listViews > 0 && [
                  { label:'Tıklama Oranı', value: fmtPct((funnel.listClicks||0)/(funnel.listViews||1)) },
                  { label:'Sepet Oranı', value: fmtPct((funnel.addToCart||0)/(funnel.productViews||1)) },
                  { label:'Satın Alma Oranı', value: fmtPct((funnel.purchased||0)/(funnel.addToCart||1)) },
                  { label:'Genel Dönüşüm', value: fmtPct((funnel.purchased||0)/(funnel.listViews||1)) },
                ].map((m,i)=>(
                  <div key={i} style={{ fontSize:12 }}>
                    <span style={{color:'var(--text-muted)'}}>{m.label}: </span>
                    <strong style={{color:'var(--accent-cyan)'}}>{m.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Sort */}
          <div style={{ display:'flex', gap:12, marginBottom:16 }}>
            <input className="input" placeholder="Ürün ara..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}} />
            <select className="select" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{minWidth:180}}>
              <option value="totalRevenue">Gelire Göre</option>
              <option value="totalSold">Adete Göre</option>
              <option value="orderCount">Siparişe Göre</option>
              <option value="totalViews">Görüntülenmeye Göre</option>
            </select>
          </div>

          {/* Products Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Ürün Performansı ({filteredProducts.length} ürün)</div>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>SKU</th><th>Ürün Adı</th><th>Marka</th><th>Kategori</th>
                    <th>Fiyat</th><th>Satış Adedi</th><th>Gelir</th><th>Sipariş</th>
                    <th>Görüntüleme</th><th>Sepete Ekle</th><th>Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={12} style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Yükleniyor...</td></tr>
                  ) : filteredProducts.slice(0,50).map((p,i)=>(
                    <tr key={i}>
                      <td style={{color:'var(--text-muted)'}}>{i+1}</td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.sku}</td>
                      <td style={{fontWeight:500,maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.product_name}</td>
                      <td><span className="badge badge-purple">{p.brand}</span></td>
                      <td><span className="badge badge-blue">{p.category}</span></td>
                      <td>{fmtCur(p.price)}</td>
                      <td style={{fontWeight:600}}>{fmt(p.totalSold)}</td>
                      <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(p.totalRevenue)}</td>
                      <td>{fmt(p.orderCount)}</td>
                      <td>{fmt(p.totalViews)}</td>
                      <td>{fmt(p.totalAddToCart)}</td>
                      <td>
                        <span style={{color: Number(p.conversionRate||0)>0.05?'var(--accent-green)':Number(p.conversionRate||0)>0.02?'var(--accent-amber)':'var(--accent-rose)'}}>
                          {fmtPct(p.conversionRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'stock' && (
        <div className="charts-grid">
          {abcChart && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PackageOpen size={16} /><div className="chart-card-title">ABC Sınıflandırması (Gelire Göre)</div>
                </div>
              </div>
              <Chart options={abcChart.options} series={abcChart.series} type="donut" height={260} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                {stockInfo.abcAnalysis.map((a, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600 }}>Sınıf {a.grade}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmt(a.count)} Ürün</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stockInfo?.stockoutRisk?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} style={{ color: 'var(--accent-rose)' }} /><div className="chart-card-title">Stok Tükenme Riski Taşıyanlar</div>
                </div>
              </div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>SKU</th><th>Ürün</th><th>Marka</th><th>Mevcut Stok</th><th>Günlük Hız (30G)</th><th>Kalan Gün</th></tr></thead>
                  <tbody>
                    {stockInfo.stockoutRisk.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{s.sku}</td>
                        <td style={{ fontWeight:500 }}>{s.name}</td>
                        <td><span className="badge badge-purple">{s.brand}</span></td>
                        <td style={{ fontWeight:600 }}>{fmt(s.current_stock)}</td>
                        <td>{Number(s.dailyVelocity).toFixed(1)}/gün</td>
                        <td style={{ fontWeight:700, color: 'var(--accent-rose)' }}>{fmt(s.daysRemaining)} Gün</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stockInfo?.deadStock?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowDown size={16} style={{ color: 'var(--accent-amber)' }} /><div className="chart-card-title">Atıl Stok (Dead Stock - Son 30 Günde Satış Yok)</div>
                </div>
              </div>
              <div className="data-table-container">
                <table className="data-table">
                  <thead><tr><th>SKU</th><th>Ürün</th><th>Kategori</th><th>Bekleyen Stok</th></tr></thead>
                  <tbody>
                    {stockInfo.deadStock.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{s.sku}</td>
                        <td style={{ fontWeight:500 }}>{s.name}</td>
                        <td>{s.category}</td>
                        <td style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{fmt(s.current_stock)} Adet</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
