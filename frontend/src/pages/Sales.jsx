import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { Filter, X, Tag, RotateCcw, CreditCard } from 'lucide-react';

const fmt = n => n==null?'0':Number(n)>=1e6?(n/1e6).toFixed(1)+'M':Number(n)>=1e3?(n/1e3).toFixed(1)+'K':Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺'+Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0});

const chartBase = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', fontFamily: 'Futura PT, sans-serif', toolbar: { show: false } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
  xaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } }, axisBorder: { color: 'rgba(255,255,255,0.08)' }, axisTicks: { color: 'rgba(255,255,255,0.08)' } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px', fontFamily: 'Futura PT' } } },
  tooltip: { theme: 'dark', style: { fontFamily: 'Futura PT' } },
  legend: { labels: { colors: '#94a3b8' }, fontFamily: 'Futura PT', fontSize: '12px' },
  colors: ['#22c55e', '#E30613', '#ff2d3b', '#f59e0b', '#a855f7', '#06b6d4'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

export default function Sales() {
  const [data, setData] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { filters, updateFilter, resetFilters, activeFilters } = useFilters();

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, heatRes] = await Promise.all([
        kpiAPI.sales(filters),
        kpiAPI.heatmap(filters),
      ]);
      setData(salesRes.data);
      setHeatmap(heatRes.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const revenueChart = data?.dailyRevenue?.length ? {
    series: [
      { name: 'Brüt Gelir', data: data.dailyRevenue.map(d => ({ x: d.date, y: Number(d.revenue)||0 })) },
      { name: 'Net Gelir', data: data.dailyRevenue.map(d => ({ x: d.date, y: Number(d.netRevenue)||0 })) },
    ],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'area', height: 300 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } } }
  } : null;

  const ordersChart = data?.dailyRevenue?.length ? {
    series: [{ name: 'Sipariş', data: data.dailyRevenue.map(d => ({ x: d.date, y: Number(d.orders)||0 })) }],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      colors: ['#E30613'] }
  } : null;

  const channelRevChart = data?.channelRevenue?.length ? {
    series: [{ name: 'Gelir', data: data.channelRevenue.slice(0,8).map(d => ({ x: d.channel||'N/A', y: Number(d.revenue)||0 })) }],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 300 },
      plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } },
      xaxis: { ...chartBase.xaxis },
      colors: ['#06b6d4'],
      yaxis: { ...chartBase.yaxis, labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) } } }
  } : null;

  const paymentChart = data?.paymentDist?.length ? {
    series: data.paymentDist.map(d => Number(d.count)||0),
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 280 },
      labels: data.paymentDist.map(d => {
        const map = { credit_card: 'Kredi Kartı', debit_card: 'Banka Kartı', bank_transfer: 'Havale', pay_at_door: 'Kapıda Ödeme' };
        return map[d.payment_method] || d.payment_method;
      }),
      colors: ['#a855f7','#3b82f6','#22c55e','#f59e0b'],
      stroke: { colors: ['#0c0c0e'], width: 2 },
      plotOptions: { pie: { donut: { size: '65%' } } } }
  } : null;

  const statusChart = data?.statusDist?.length ? {
    series: data.statusDist.map(d => Number(d.count)||0),
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 260 },
      labels: data.statusDist.map(d => ({completed:'Tamamlanan',cancelled:'İptal',refunded:'İade',pending:'Bekleyen',shipped:'Kargoda'}[d.order_status]||d.order_status)),
      colors: ['#22c55e','#E30613','#f59e0b','#3b82f6','#a855f7'],
      stroke: { colors: ['#0c0c0e'], width: 2 },
      plotOptions: { pie: { donut: { size:'65%' } } } }
  } : null;

  const couponChart = data?.couponAnalysis?.length ? {
    series: data.couponAnalysis.map(d => Number(d.orders)||0),
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 260 },
      labels: data.couponAnalysis.map(d => d.hasCoupon),
      colors: ['#22c55e', '#64748b'],
      stroke: { colors: ['#0c0c0e'], width: 2 },
      plotOptions: { pie: { donut: { size:'65%' } } } }
  } : null;

  const funnelChart = data?.orderFunnel?.length ? {
    series: [{ name: 'Sipariş Sayısı', data: data.orderFunnel.map(d => ({ x: d.stage || 'N/A', y: Number(d.count)||0 })) }],
    options: { ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      plotOptions: { bar: { borderRadius: 4, distributed: true, horizontal: true } },
      xaxis: { ...chartBase.xaxis },
      legend: { show: false },
      colors: ['#f59e0b', '#3b82f6', '#22c55e', '#E30613', '#64748b'] }
  } : null;

  // Heatmap: days x hours
  const DAYS = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const heatmapData = heatmap?.length ? {
    series: DAYS.map((day, dayIdx) => ({
      name: day,
      data: Array.from({length:24},(_,h)=>{
        const entry = heatmap.find(e => Number(e.dayOfWeek)===dayIdx+1 && Number(e.hour)===h);
        return { x: `${h}:00`, y: Number(entry?.orderCount||0) };
      })
    })),
    options: {
      ...chartBase,
      chart: { ...chartBase.chart, type: 'heatmap', height: 300 },
      colors: ['#E30613'],
      plotOptions: { heatmap: { shadeIntensity: 0.5, colorScale: {
        ranges: [
          { from:0, to:0, color:'#141416', name:'Sıfır' },
          { from:1, to:5, color:'#5c0208', name:'Düşük' },
          { from:6, to:20, color:'#b8050f', name:'Orta' },
          { from:21, to:999, color:'#ff2d3b', name:'Yüksek' },
        ]
      } } },
      dataLabels: { enabled: false },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => v + ' sipariş' } },
    }
  } : null;

  const totalRevenue = data?.dailyRevenue?.reduce((s,d)=>s+Number(d.revenue||0),0) || 0;
  const totalOrders = data?.dailyRevenue?.reduce((s,d)=>s+Number(d.orders||0),0) || 0;
  const totalDiscounts = data?.dailyRevenue?.reduce((s,d)=>s+Number(d.discounts||0),0) || 0;
  const totalRefunds = data?.dailyRevenue?.reduce((s,d)=>s+Number(d.refunds||0),0) || 0;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="animate-fade-in">
      <div className="filter-bar">
        <Filter size={16} style={{ color:'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e=>updateFilter('startDate',e.target.value)} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e=>updateFilter('endDate',e.target.value)} /></div>
        {activeFilters.length>0 && <button className="btn btn-sm btn-secondary" onClick={resetFilters} style={{marginLeft:'auto'}}><X size={14} />Temizle</button>}
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label:'Toplam Sipariş', value: fmt(totalOrders) },
          { label:'Toplam Gelir', value: fmtCur(totalRevenue) },
          { label:'Ort. Sipariş Değeri', value: fmtCur(aov) },
          { label:'Toplam İndirim', value: fmtCur(totalDiscounts) },
          { label:'Toplam İade', value: fmtCur(totalRefunds) },
          { label:'Net Gelir', value: fmtCur(totalRevenue-totalDiscounts-totalRefunds) },
        ].map((k,i) => (
          <div key={i} className="kpi-card" style={i===5 ? { borderLeft: '4px solid var(--accent-green)' } : undefined}>
            <div className="kpi-card-label">{k.label}</div>
            <div className="kpi-card-value">{loading ? <div className="skeleton" style={{width:120,height:32}} /> : k.value}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {['overview','analysis','channels','products'].map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {t==='overview'?'Genel Görünüm':t==='analysis'?'Detay Analizler':t==='channels'?'Kanallar & Zaman':'Ürünler'}
          </button>
        ))}
      </div>

      {activeTab==='overview' && (
        <div className="charts-grid">
          {revenueChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Gelir Trendi</div></div>
            <Chart options={revenueChart.options} series={revenueChart.series} type="area" height={300} />
          </div>}
          {ordersChart && <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Günlük Sipariş Sayısı</div></div>
            <Chart options={ordersChart.options} series={ordersChart.series} type="bar" height={280} />
          </div>}
          {statusChart && <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Sipariş Durumu</div></div>
            <Chart options={statusChart.options} series={statusChart.series} type="donut" height={260} />
          </div>}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="charts-grid">
          {funnelChart && <div className="chart-card">
            <div className="chart-card-header"><div className="chart-card-title">Sipariş Durum Funnelı</div></div>
            <Chart options={funnelChart.options} series={funnelChart.series} type="bar" height={280} />
            <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>Siparişlerin hangi aşamada olduğunu gösterir.</div>
          </div>}

          {couponChart && <div className="chart-card">
            <div className="chart-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={16} /><div className="chart-card-title">İndirim (Kupon) Etkinliği</div>
              </div>
            </div>
            <Chart options={couponChart.options} series={couponChart.series} type="donut" height={260} />
            {data?.couponAnalysis?.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
                {data.couponAnalysis.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.hasCoupon}</div>
                    <div style={{ fontWeight: 600 }}>{fmtCur(d.aov)} AOV</div>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {data?.refundAnalysis?.length > 0 && <div className="chart-card full-width">
            <div className="chart-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={16} /><div className="chart-card-title">Marka Bazlı İade Analizi</div>
              </div>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Marka</th><th>Satılan Ürün</th><th>Gelir</th><th>İade Tutarı</th><th>İade Oranı</th></tr></thead>
                <tbody>
                  {data.refundAnalysis.map((r, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-purple">{r.brand}</span></td>
                      <td>{fmt(r.soldQuantity)}</td>
                      <td>{fmtCur(r.totalRevenue)}</td>
                      <td style={{ color: 'var(--accent-rose)' }}>{fmtCur(r.totalRefunds)}</td>
                      <td style={{ fontWeight: 600, color: Number(r.refundRate) > 10 ? 'var(--accent-rose)' : 'inherit' }}>
                        {Number(r.refundRate).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          {data?.paymentByChannel?.length > 0 && <div className="chart-card full-width">
             <div className="chart-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={16} /><div className="chart-card-title">Kanal x Ödeme Yöntemi Matrisi</div>
              </div>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Kanal</th><th>Ödeme Yöntemi</th><th>Sipariş</th><th>Gelir Sayısı</th></tr></thead>
                <tbody>
                  {data.paymentByChannel.map((p, i) => (
                    <tr key={i}>
                      <td>{p.channel}</td>
                      <td>{p.payment_method === 'credit_card' ? 'Kredi Kartı' : p.payment_method === 'pay_at_door' ? 'Kapıda Ödeme' : p.payment_method}</td>
                      <td>{fmt(p.count)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 500 }}>{fmtCur(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
        </div>
      )}

      {activeTab==='channels' && (
        <div className="charts-grid">
          {channelRevChart && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Kanal Bazlı Gelir</div></div>
            <Chart options={channelRevChart.options} series={channelRevChart.series} type="bar" height={300} />
          </div>}
          <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Kanal Detay</div></div>
            <table className="data-table">
              <thead><tr><th>Kanal</th><th>Sipariş</th><th>Brüt Gelir</th><th>Net Gelir</th><th>Ort. Sipariş Değeri</th><th>Tekil Müşteri</th></tr></thead>
              <tbody>
                {data?.channelRevenue?.map((c,i)=>(
                  <tr key={i}>
                    <td><span className="badge badge-blue">{c.channel||'N/A'}</span></td>
                    <td>{fmt(c.orders)}</td>
                    <td style={{color:'var(--accent-amber)'}}>{fmtCur(c.revenue)}</td>
                    <td style={{color:'var(--accent-green)'}}>{fmtCur(c.netRevenue)}</td>
                    <td>{fmtCur(c.avgOrderValue)}</td>
                    <td>{fmt(c.uniqueCustomers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {heatmapData && <div className="chart-card full-width">
            <div className="chart-card-header"><div className="chart-card-title">Sipariş Yoğunluğu — Haftanın Günü × Saat</div></div>
            <Chart options={heatmapData.options} series={heatmapData.series} type="heatmap" height={300} />
          </div>}
        </div>
      )}

      {activeTab==='products' && data?.topProducts && (
        <div className="card">
          <div className="card-header"><div className="card-title">En Çok Satan Ürünler</div></div>
          <div className="card-body">
            <table className="data-table">
              <thead><tr><th>#</th><th>Ürün</th><th>Marka</th><th>Kategori</th><th>Adet</th><th>Gelir</th><th>Sipariş</th></tr></thead>
              <tbody>
                {data.topProducts.map((p,i)=>(
                  <tr key={i}>
                    <td style={{color:'var(--text-muted)'}}>{i+1}</td>
                    <td style={{fontWeight:500,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.item_name}</td>
                    <td><span className="badge badge-purple">{p.item_brand}</span></td>
                    <td>{p.item_category}</td>
                    <td>{fmt(p.totalQuantity)}</td>
                    <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(p.totalRevenue)}</td>
                    <td>{fmt(p.orderCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
