import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { Filter, X, Zap, PieChart } from 'lucide-react';

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
  colors: ['#E30613', '#ff2d3b', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7'],
  stroke: { curve: 'smooth', width: 2 },
  dataLabels: { enabled: false },
};

export default function Campaigns() {
  const [data, setData] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [marketing, setMarketing] = useState(null);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [platform, setPlatform] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campRes, cohortRes, mktRes, budgetRes] = await Promise.all([
        kpiAPI.campaignPerformance(filters),
        kpiAPI.cohort(filters),
        kpiAPI.marketing(filters),
        kpiAPI.budgetTracking(filters)
      ]);
      setData(campRes.data);
      setCohort(cohortRes.data);
      setMarketing(mktRes.data);
      setBudget(budgetRes.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const roasScatterChart = data?.campaigns?.length ? {
    series: [
      {
        name: 'Meta',
        data: data.campaigns.filter(c=>c.platform==='Meta').map(c=>({ x: Number(c.spend||0), y: Number(c.conversionValue||0), label: c.campaign_name }))
      },
      {
        name: 'Google',
        data: data.campaigns.filter(c=>c.platform==='Google').map(c=>({ x: Number(c.spend||0), y: Number(c.conversionValue||0), label: c.campaign_name }))
      },
    ],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'scatter', height: 320 },
      colors: ['#3b82f6', '#06b6d4'],
      xaxis: { ...chartBase.xaxis, title: { text: 'Harcama (₺)', style: { color: '#94a3b8', fontFamily: 'Futura PT' } } },
      yaxis: { ...chartBase.yaxis, title: { text: 'Dönüşüm Değeri (₺)', style: { color: '#94a3b8', fontFamily: 'Futura PT' } },
        labels: { ...chartBase.yaxis.labels, formatter: v => fmtCur(v) } },
      tooltip: { ...chartBase.tooltip, y: { formatter: v => fmtCur(v) }, custom: function({series, seriesIndex, dataPointIndex, w}) {
        const item = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        return `<div class="p-3" style="font-family: Futura PT; background: var(--bg-glass);">
          <div style="font-weight:600;margin-bottom:4px;">${item.label}</div>
          <div style="font-size:12px;color:#94a3b8">Harcama: <strong style="color:#f1f5f9">${fmtCur(item.x)}</strong></div>
          <div style="font-size:12px;color:#94a3b8">Değer: <strong style="color:#22c55e">${fmtCur(item.y)}</strong></div>
          <div style="font-size:12px;color:#94a3b8">ROAS: <strong style="color:#06b6d4">${(item.x>0?item.y/item.x:0).toFixed(2)}x</strong></div>
        </div>`;
      }},
      markers: { size: 8, hover: { sizeOffset: 3 } },
    }
  } : null;

  const cohortChart = cohort?.length ? {
    series: [
      { name: 'Kohort Boyutu', data: cohort.slice(-12).map(c => Number(c.cohort_size||0)) },
      { name: 'Tekrar Alım', data: cohort.slice(-12).map(c => Number(c.repeat_customers||0)) },
    ],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      colors: ['#E30613', '#22c55e'],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      xaxis: { ...chartBase.xaxis, categories: cohort.slice(-12).map(c => c.cohort_month) },
    }
  } : null;

  const mktKardData = marketing ? [
    { label: 'Müşteri Edinme Maliyeti (CAC)', value: fmtCur(marketing.cac) },
    { label: 'Müşteri Yaşam Boyu Değeri (CLV)', value: fmtCur(marketing.clv) },
    { label: 'CLV/CAC Oranı', value: Number(marketing.clvCacRatio||0).toFixed(1) + 'x' },
    { label: 'Tekrar Satın Alma Oranı', value: (Number(marketing.repeatPurchaseRate||0)*100).toFixed(1) + '%' },
    { label: 'Toplam Müşteri', value: fmt(marketing.totalCustomers) },
    { label: 'Ort. Sipariş/Müşteri', value: Number(marketing.avgOrdersPerCustomer||0).toFixed(1) },
  ] : [];

  const filteredCampaigns = data?.campaigns?.filter(c => {
    if (platform && c.platform !== platform) return false;
    if (search && !c.campaign_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  return (
    <div className="animate-fade-in">
      <div className="filter-bar">
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <div className="filter-item"><label>Başlangıç</label><input type="date" className="input" value={filters.startDate} onChange={e=>setFilters(p=>({...p,startDate:e.target.value}))} /></div>
        <div className="filter-item"><label>Bitiş</label><input type="date" className="input" value={filters.endDate} onChange={e=>setFilters(p=>({...p,endDate:e.target.value}))} /></div>
        {(filters.startDate || filters.endDate) && <button className="btn btn-sm btn-secondary" onClick={()=>setFilters({startDate:'',endDate:''})} style={{marginLeft:'auto'}}><X size={14} />Temizle</button>}
      </div>

      {marketing && (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {mktKardData.map((k,i) => (
            <div key={i} className="kpi-card" style={i===2 && Number(marketing.clvCacRatio||0) > 3 ? { borderLeft: '4px solid var(--accent-green)' } : undefined}>
              <div className="kpi-card-label">{k.label}</div>
              <div className="kpi-card-value">{loading?<div className="skeleton" style={{width:100,height:28}}/>:k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {['campaigns','budget','cohort','attribution'].map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {t==='campaigns'?'Kampanya Performansı':t==='budget'?'Master Data & Bütçe':t==='cohort'?'Kohort Analizi':'Kanal Attribution'}
          </button>
        ))}
      </div>

      {activeTab==='campaigns' && (
        <div>
          <div style={{ display:'flex', gap:12, marginBottom:16 }}>
            <input className="input" placeholder="Kampanya ara..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}} />
            <select className="select" value={platform} onChange={e=>setPlatform(e.target.value)} style={{minWidth:160}}>
              <option value="">Tüm Platformlar</option>
              <option value="Meta">Meta</option>
              <option value="Google">Google</option>
            </select>
          </div>

          {roasScatterChart && (
            <div className="chart-card" style={{ marginBottom: 20 }}>
              <div className="chart-card-header"><div className="chart-card-title">Harcama vs Dönüşüm Değeri (Scatter)</div></div>
              <Chart options={roasScatterChart.options} series={roasScatterChart.series} type="scatter" height={320} />
            </div>
          )}

          <div className="card">
            <div className="card-header"><div className="card-title">Düzenlenmiş Kampanya Performansı Detay ({filteredCampaigns.length})</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kampanya</th><th>Platform</th><th>Gösterim</th><th>Tıklama</th>
                    <th>Harcama</th><th>Dönüşüm</th><th>Dön. Değer</th><th>ROAS</th><th>CTR</th><th>CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Yükleniyor...</td></tr>
                  ) : filteredCampaigns.slice(0,30).map((c,i)=>(
                    <tr key={i}>
                      <td style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{c.campaign_name}</td>
                      <td><span className={`badge ${c.platform==='Meta'?'badge-blue':'badge-cyan'}`}>{c.platform}</span></td>
                      <td>{fmt(c.impressions)}</td>
                      <td>{fmt(c.clicks)}</td>
                      <td style={{color:'var(--accent-amber)'}}>{fmtCur(c.spend)}</td>
                      <td>{fmt(c.conversions)}</td>
                      <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(c.conversionValue)}</td>
                      <td style={{fontWeight:700,color:Number(c.roas||0)>3?'var(--accent-green)':Number(c.roas||0)>1?'var(--accent-amber)':'var(--accent-rose)'}}>
                        {Number(c.roas||0).toFixed(2)}x
                      </td>
                      <td>{Number(c.ctr||0).toFixed(2)}%</td>
                      <td>{fmtCur(c.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'budget' && budget?.campaigns && (
        <div className="charts-grid">
          <div className="chart-card full-width">
            <div className="chart-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={16} /><div className="chart-card-title">Kampanya Master Data & Bütçe Utilization</div>
              </div>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kampanya Adı</th><th>Platform</th><th>Tür</th><th>Durum</th><th>Bütçe</th><th>Harcanan</th><th>Kullanım</th><th>ROAS (Tahmini)</th><th style={{width: 100}}>Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {budget.campaigns.map((b, i) => {
                    const util = b.total_budget > 0 ? (Number(b.actualSpend || 0) / Number(b.total_budget)) * 100 : 0;
                    const roas = b.actualSpend > 0 ? (Number(b.totalConvValue || 0) / Number(b.actualSpend)) : 0;
                    const cColor = util > 100 ? 'var(--accent-rose)' : util > 80 ? 'var(--accent-amber)' : 'var(--accent-green)';
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.campaign_name}</td>
                        <td><span className={`badge ${b.platform === 'meta' ? 'badge-blue' : 'badge-cyan'}`}>{b.platform}</span></td>
                        <td>{b.campaign_type}</td>
                        <td><span className={`badge ${b.status === 'active' ? 'badge-green' : b.status === 'paused' ? 'badge-amber' : 'badge-rose'}`}>{b.status}</span></td>
                        <td>{fmtCur(b.total_budget)}</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{fmtCur(b.actualSpend)}</td>
                        <td style={{ fontWeight: 600, color: cColor }}>{util.toFixed(1)}%</td>
                        <td style={{ fontWeight: 600, color: roas > 2 ? 'var(--accent-green)' : 'inherit' }}>{roas.toFixed(2)}x</td>
                        <td>
                          <div className="progress-bar" style={{ width: 80 }}>
                            <div className="progress-bar-fill" style={{ width: `${Math.min(100, util)}%`, background: cColor }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab==='cohort' && (
        <div>
          {cohortChart && (
            <div className="chart-card" style={{ marginBottom: 20 }}>
              <div className="chart-card-header"><div className="chart-card-title">Aylık Kohort — Yeni ve Tekrar Alım Müşteri</div></div>
              <Chart options={cohortChart.options} series={cohortChart.series} type="bar" height={280} />
            </div>
          )}
          <div className="card">
            <div className="card-header"><div className="card-title">Kohort Detay</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Cohort Ayı</th><th>Kohort Boyutu</th><th>Ort. Sipariş</th><th>Ort. Gelir</th><th>Geri Dön. Müşteri</th><th>Retention (Sürdürme Oranı)</th></tr>
                </thead>
                <tbody>
                  {cohort?.map((c,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{c.cohort_month}</td>
                      <td>{fmt(c.cohort_size)}</td>
                      <td>{Number(c.avg_orders||0).toFixed(1)}</td>
                      <td style={{color:'var(--accent-green)'}}>{fmtCur(c.avg_revenue)}</td>
                      <td>{fmt(c.repeat_customers)}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div className="progress-bar" style={{width:80}}>
                            <div className="progress-bar-fill" style={{width:`${Math.min(100,Number(c.repeat_customers||0)/Math.max(1,Number(c.cohort_size||1))*100)}%`}} />
                          </div>
                          <span style={{fontSize:12, fontWeight: 600}}>{(Number(c.repeat_customers||0)/Math.max(1,Number(c.cohort_size||1))*100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab==='attribution' && marketing?.channelAttribution && (
        <div className="card">
          <div className="card-header">
             <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PieChart size={16} /><div className="card-title">Kanal Attribution (Son Temas)</div>
            </div>
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead><tr><th>Kanal</th><th>Sipariş</th><th>Gelir</th><th>Tekil Müşteri</th><th>Gelir Payı</th></tr></thead>
              <tbody>
                {(() => {
                  const total = marketing.channelAttribution.reduce((s,c)=>s+Number(c.revenue||0),0);
                  return marketing.channelAttribution.map((c,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:600}}><span className="badge badge-blue">{c.channel||'N/A'}</span></td>
                      <td>{fmt(c.orders)}</td>
                      <td style={{color:'var(--accent-green)',fontWeight:600}}>{fmtCur(c.revenue)}</td>
                      <td>{fmt(c.uniqueCustomers)}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div className="progress-bar" style={{width:100}}>
                            <div className="progress-bar-fill" style={{width:`${total>0?Number(c.revenue||0)/total*100:0}%`}} />
                          </div>
                          <span style={{fontSize:12, fontWeight: 600}}>{total>0?(Number(c.revenue||0)/total*100).toFixed(1):0}%</span>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
