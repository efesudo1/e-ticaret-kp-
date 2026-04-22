import { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { kpiAPI } from '../services/api';
import { Users, UserCheck, UserX, Heart, Mail, MapPin } from 'lucide-react';

const fmt = n => n == null ? '0' : Number(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Number(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Number(n).toLocaleString('tr-TR');
const fmtCur = n => '₺' + Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

const segmentColors = {
  'Şampiyonlar': '#22c55e',
  'Sadık Müşteriler': '#06b6d4',
  'Potansiyel Sadıklar': '#3b82f6',
  'Yeni Müşteriler': '#a855f7',
  'Umut Vaat Edenler': '#f59e0b',
  'Risk Altında': '#ef4444',
  'Kaybedilmek Üzere': '#dc2626',
  'Kayıp Müşteriler': '#64748b',
  'Uyuyanlar': '#475569',
};

export default function CustomerAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rfm');
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await kpiAPI.customers({});
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // RFM Segment donut
  const rfmDonut = data?.rfmSegments?.summary?.length ? {
    series: data.rfmSegments.summary.map(s => s.count),
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 340 },
      labels: data.rfmSegments.summary.map(s => s.segment),
      colors: data.rfmSegments.summary.map(s => segmentColors[s.segment] || '#64748b'),
      plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Toplam', color: '#94a3b8', fontFamily: 'Futura PT', formatter: w => fmt(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) } } } } },
      stroke: { colors: ['#0c0c0e'], width: 2 },
    }
  } : null;

  // CLV Distribution
  const clvChart = data?.clvDist?.length ? {
    series: [{ name: 'Müşteri Sayısı', data: data.clvDist.map(d => Number(d.count) || 0) }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      xaxis: { ...chartBase.xaxis, categories: data.clvDist.map(d => '₺' + d.clvBucket) },
      colors: ['#a855f7'],
      fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical', shadeIntensity: 0.3, opacityFrom: 0.9, opacityTo: 0.7 } },
    }
  } : null;

  // City distribution
  const cityChart = data?.cityDist?.length ? {
    series: [{ name: 'Müşteri', data: data.cityDist.slice(0, 10).map(c => ({ x: c.city || 'Bilinmeyen', y: Number(c.count) || 0 })) }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '55%' } },
      xaxis: { ...chartBase.xaxis },
      colors: ['#06b6d4'],
      yaxis: { labels: { style: { colors: '#94a3b8', fontFamily: 'Futura PT' } } },
    }
  } : null;

  // Age-Gender heatmap
  const ageGroups = [...new Set(data?.ageGender?.map(d => d.age_group))];
  const genders = [...new Set(data?.ageGender?.map(d => d.gender))];
  const ageGenderChart = ageGroups.length && genders.length ? {
    series: genders.map(g => ({
      name: g === 'M' ? 'Erkek' : g === 'F' ? 'Kadın' : g,
      data: ageGroups.map(ag => {
        const entry = data.ageGender.find(d => d.age_group === ag && d.gender === g);
        return Number(entry?.count || 0);
      })
    })),
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 280 },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      xaxis: { ...chartBase.xaxis, categories: ageGroups },
      colors: ['#E30613', '#a855f7'],
    }
  } : null;

  // New vs Returning
  const newVsRetChart = data?.newVsReturning?.length ? {
    series: data.newVsReturning.map(d => Number(d.count) || 0),
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'donut', height: 260 },
      labels: data.newVsReturning.map(d => d.type),
      colors: ['#E30613', '#22c55e'],
      plotOptions: { pie: { donut: { size: '65%' } } },
      stroke: { colors: ['#0c0c0e'], width: 2 },
    }
  } : null;

  // Registration source
  const regSourceChart = data?.regSource?.length ? {
    series: [{ name: 'Müşteri', data: data.regSource.map(r => Number(r.count) || 0) }],
    options: {
      ...chartBase, chart: { ...chartBase.chart, type: 'bar', height: 220 },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      xaxis: { ...chartBase.xaxis, categories: data.regSource.map(r => r.registration_source || 'N/A') },
      colors: ['#f59e0b'],
    }
  } : null;

  const filteredCustomers = data?.rfmSegments?.customers?.filter(c => {
    if (segmentFilter && c.segment !== segmentFilter) return false;
    if (search && !c.customer_name?.toLowerCase().includes(search.toLowerCase()) && !c.customer_id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  const segments = data?.rfmSegments?.summary || [];

  return (
    <div className="animate-fade-in">
      {/* Summary KPIs */}
      <div className="kpi-grid">
        {[
          { label: 'Toplam Müşteri', value: fmt(data?.totalCustomers), icon: Users },
          { label: 'Yeni Müşteri', value: fmt(data?.newVsReturning?.find(d => d.type === 'Yeni')?.count), icon: UserCheck },
          { label: 'Geri Dönen', value: fmt(data?.newVsReturning?.find(d => d.type === 'Geri Dönen')?.count), icon: Heart },
          { label: 'RFM Segment', value: segments.length, icon: UserX },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="kpi-card">
              <div className={`kpi-card-icon ${['blue', 'green', 'rose', 'purple'][i]}`}><Icon size={20} /></div>
              <div className="kpi-card-label">{k.label}</div>
              <div className="kpi-card-value">{loading ? <div className="skeleton" style={{ width: 80, height: 28 }} /> : k.value}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['rfm', 'demographics', 'behavior'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'rfm' ? 'RFM Segmentasyonu' : t === 'demographics' ? 'Demografik Analiz' : 'Davranış Analizi'}
          </button>
        ))}
      </div>

      {/* RFM Tab */}
      {activeTab === 'rfm' && (
        <div>
          <div className="charts-grid">
            {rfmDonut && (
              <div className="chart-card">
                <div className="chart-card-header"><div className="chart-card-title">RFM Segment Dağılımı</div></div>
                <Chart options={rfmDonut.options} series={rfmDonut.series} type="donut" height={340} />
              </div>
            )}

            {/* Segment summary table */}
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Segment Özeti</div></div>
              <div style={{ padding: '0 16px 16px' }}>
                {segments.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', marginBottom: 6,
                    background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${segmentColors[s.segment] || '#64748b'}`,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                    onClick={() => { setSegmentFilter(segmentFilter === s.segment ? '' : s.segment); }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.segment}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Ort. {Number(s.avgOrders).toFixed(1)} sipariş · {fmtCur(s.avgRevenue)} gelir
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: segmentColors[s.segment] }}>{s.count}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtCur(s.totalRevenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Detail Table */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, marginTop: 20 }}>
            <input className="input" placeholder="Müşteri ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
            <select className="select" value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">Tüm Segmentler</option>
              {segments.map(s => <option key={s.segment} value={s.segment}>{s.segment} ({s.count})</option>)}
            </select>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Müşteri Detayı ({filteredCustomers.length})</div></div>
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr><th>Müşteri ID</th><th>İsim</th><th>Şehir</th><th>Segment</th><th>R</th><th>F</th><th>M</th><th>Sipariş</th><th>Toplam Gelir</th><th>Son Sipariş</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Yükleniyor...</td></tr>
                  ) : filteredCustomers.slice(0, 50).map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.customer_id}</td>
                      <td style={{ fontWeight: 500 }}>{c.customer_name}</td>
                      <td>{c.city}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: (segmentColors[c.segment] || '#64748b') + '22',
                          color: segmentColors[c.segment] || '#94a3b8',
                        }}>{c.segment}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.rScore}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.fScore}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.mScore}</td>
                      <td>{c.total_orders}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtCur(c.total_revenue)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('tr-TR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Demographics Tab */}
      {activeTab === 'demographics' && (
        <div className="charts-grid">
          {ageGenderChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Yaş × Cinsiyet Dağılımı</div></div>
              <Chart options={ageGenderChart.options} series={ageGenderChart.series} type="bar" height={280} />
            </div>
          )}
          {cityChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Şehir Bazlı Müşteri Dağılımı</div></div>
              <Chart options={cityChart.options} series={cityChart.series} type="bar" height={280} />
            </div>
          )}
          {/* City Detail Table */}
          {data?.cityDist?.length > 0 && (
            <div className="chart-card full-width">
              <div className="chart-card-header"><div className="chart-card-title">Şehir Bazlı Detay</div></div>
              <table className="data-table">
                <thead><tr><th>#</th><th>Şehir</th><th>Müşteri Sayısı</th><th>Toplam Gelir</th><th>Ort. Sipariş</th><th>Gelir Payı</th></tr></thead>
                <tbody>
                  {(() => {
                    const totalRev = data.cityDist.reduce((s, c) => s + Number(c.revenue || 0), 0);
                    return data.cityDist.map((c, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{c.city || 'Bilinmeyen'}</td>
                        <td>{fmt(c.count)}</td>
                        <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{fmtCur(c.revenue)}</td>
                        <td>{Number(c.avgOrders || 0).toFixed(1)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className="progress-bar-fill" style={{ width: `${totalRev > 0 ? Number(c.revenue) / totalRev * 100 : 0}%` }} />
                            </div>
                            <span style={{ fontSize: 12 }}>{totalRev > 0 ? (Number(c.revenue) / totalRev * 100).toFixed(1) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Behavior Tab */}
      {activeTab === 'behavior' && (
        <div className="charts-grid">
          {newVsRetChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Yeni vs Geri Dönen Müşteri</div></div>
              <Chart options={newVsRetChart.options} series={newVsRetChart.series} type="donut" height={260} />
              {data?.newVsReturning && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '0 16px 16px' }}>
                  {data.newVsReturning.map((d, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.type}</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(d.count)}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>Ort: {fmtCur(d.avgRevenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {clvChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Müşteri Yaşam Boyu Değeri (CLV) Dağılımı</div></div>
              <Chart options={clvChart.options} series={clvChart.series} type="bar" height={280} />
            </div>
          )}

          {regSourceChart && (
            <div className="chart-card">
              <div className="chart-card-header"><div className="chart-card-title">Kayıt Kanalı Dağılımı</div></div>
              <Chart options={regSourceChart.options} series={regSourceChart.series} type="bar" height={220} />
            </div>
          )}

          {/* Newsletter Impact */}
          {data?.newsletter?.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <div className="chart-card-title">Newsletter Etkisi</div>
                </div>
              </div>
              <div style={{ padding: '16px' }}>
                {data.newsletter.map((n, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', marginBottom: 8,
                    background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {Number(n.subscribed) ? '📧 Abone' : '🚫 Abone Değil'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(n.count)} müşteri</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent-green)' }}>Ort: {fmtCur(n.avgRevenue)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ort: {Number(n.avgOrders || 0).toFixed(1)} sipariş</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
