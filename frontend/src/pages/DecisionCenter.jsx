import { useEffect, useState, useMemo } from 'react';
import {
  Target, TrendingUp, TrendingDown, AlertTriangle, ShoppingCart,
  Package, Award, DollarSign, ArrowUpRight, ArrowDownRight, Sparkles,
} from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { kpiAPI } from '../services/api';
import FilterBar from '../components/FilterBar';
import HelpTooltip from '../components/HelpTooltip';

const fmtTL = (n) => '₺' + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtX = (n) => n == null ? '–' : `${Number(n).toFixed(1)}x`;

export default function DecisionCenter() {
  const { filters } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('status');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    kpiAPI.decisionCenter(filters)
      .then(({ data }) => !cancelled && setData(data))
      .catch(err => console.error('decision-center error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  // Defensive null guards
  const status            = data?.status || {};
  const profitable        = data?.profitable || [];
  const losing            = data?.losing || [];
  const noAdStars         = data?.noAdStars || [];
  const pareto            = data?.pareto || { top: [], ratio: 0, totalCampaigns: 0 };
  const abandonedProducts = data?.abandonedProducts || [];
  const rising            = data?.rising || [];
  const falling           = data?.falling || [];
  const runningOut        = data?.runningOut || [];
  const overstocked       = data?.overstocked || [];

  // Kart tanımları + özet özetler
  const sections = useMemo(() => [
    {
      key: 'status',
      icon: <Target size={20} />,
      title: 'Bu Ayki Durum',
      subtitle: 'Hedef + Tahmin',
      color: 'var(--accent-red)',
      summary: data
        ? `${fmtTL(status.currentRevenue)} ciro · Hedefe %${status.goalProgress || 0} ulaşıldı`
        : '...',
      badge: data ? `${status.goalProgress || 0}%` : null,
      badgeColor: (status.goalProgress || 0) >= 100 ? 'var(--accent-green)'
        : (status.goalProgress || 0) >= 70 ? 'var(--accent-amber)'
        : 'var(--accent-red)',
    },
    {
      key: 'products',
      icon: <DollarSign size={20} />,
      title: 'Kazandıran / Yutan Ürünler',
      subtitle: 'Hangi ürüne reklam, hangisinden kes',
      color: 'var(--accent-green)',
      summary: data
        ? `${profitable.length} kâr getiren · ${losing.length} para yutan`
        : '...',
      badge: data ? `${profitable.length + losing.length}` : null,
      badgeColor: losing.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)',
    },
    {
      key: 'pareto',
      icon: <Award size={20} />,
      title: 'Bütçeyi Burada Yoğunlaştır',
      subtitle: 'Cironun %80\'ini yapan kampanyalar',
      color: 'var(--accent-amber)',
      summary: data
        ? `${pareto.top.length}/${pareto.totalCampaigns} kampanya cironun %80'ini yapıyor`
        : '...',
      badge: data ? `${pareto.top.length}` : null,
      badgeColor: 'var(--accent-amber)',
    },
    {
      key: 'cart',
      icon: <ShoppingCart size={20} />,
      title: 'Kaybedilen Satışlar',
      subtitle: 'Sepete atılıp alınmayan',
      color: 'var(--accent-amber)',
      summary: data
        ? abandonedProducts.length > 0
          ? `${abandonedProducts.length} ürün, toplam ${fmtNum(abandonedProducts.reduce((s, p) => s + p.lost, 0))} kayıp müşteri`
          : 'Kayıp yok 🎉'
        : '...',
      badge: data ? `${abandonedProducts.length}` : null,
      badgeColor: abandonedProducts.length > 0 ? 'var(--accent-amber)' : 'var(--accent-green)',
    },
    {
      key: 'trend',
      icon: <TrendingUp size={20} />,
      title: 'Yükselen / Sönen Ürünler',
      subtitle: 'Son 7 gün vs önceki 7 gün',
      color: 'var(--accent-blue)',
      summary: data
        ? `📈 ${rising.length} yükseliyor · 📉 ${falling.length} sönüyor`
        : '...',
      badge: data ? `${rising.length}↑` : null,
      badgeColor: 'var(--accent-blue)',
    },
    {
      key: 'stock',
      icon: <Package size={20} />,
      title: 'Stok Alarmları',
      subtitle: 'Tükenenler ve yığılanlar',
      color: 'var(--accent-red)',
      summary: data
        ? `🚨 ${runningOut.length} tükeniyor · 📦 ${overstocked.length} yığılan`
        : '...',
      badge: data ? `${runningOut.length}` : null,
      badgeColor: runningOut.length > 0 ? 'var(--accent-red)' : 'var(--text-muted)',
    },
  ], [data, status, profitable, losing, pareto, abandonedProducts, rising, falling, runningOut, overstocked]);

  const renderActiveContent = () => {
    if (loading) {
      return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Veriler hazırlanıyor...</div>;
    }
    if (!data) {
      return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Veri yok</div>;
    }

    switch (activeSection) {
      case 'status':   return <StatusSection status={status} />;
      case 'products': return <ProductsSection profitable={profitable} losing={losing} noAdStars={noAdStars} />;
      case 'pareto':   return <ParetoSection pareto={pareto} />;
      case 'cart':     return <CartAbandonSection abandoned={abandonedProducts} />;
      case 'trend':    return <TrendSection rising={rising} falling={falling} />;
      case 'stock':    return <StockSection runningOut={runningOut} overstocked={overstocked} />;
      default:         return null;
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={false} />

      {/* Üst banner */}
      <div style={{
        padding: '16px 22px', marginBottom: 20, borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(227,6,19,0.10), rgba(20,20,22,0.6))',
        border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Target size={24} style={{ color: 'var(--accent-red)' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Karar Merkezi</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Bir karta tıkla → o konunun detayı ve aksiyon önerisi açılır.
          </div>
        </div>
      </div>

      {/* 6 KART GRİD'İ */}
      <div className="dc-cards-grid">
        {sections.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSection(s.key)}
            className={`dc-card ${activeSection === s.key ? 'dc-card-active' : ''}`}
            style={{ '--dc-color': s.color }}
          >
            <div className="dc-card-header">
              <div className="dc-card-icon">{s.icon}</div>
              {s.badge != null && (
                <div className="dc-card-badge" style={{ background: s.badgeColor }}>{s.badge}</div>
              )}
            </div>
            <div className="dc-card-title">{s.title}</div>
            <div className="dc-card-subtitle">{s.subtitle}</div>
            <div className="dc-card-summary">{s.summary}</div>
          </button>
        ))}
      </div>

      {/* DETAY ALANI */}
      <div className="dc-detail-panel" key={activeSection}>
        {renderActiveContent()}
      </div>
    </div>
  );
}

// ============================================================
// 6 ALT BÖLÜM — her biri ayrı içerik
// ============================================================

function StatusSection({ status }) {
  return (
    <SectionWrapper
      icon={<Target size={18} />}
      title="Bu Ayki Durum"
      help={<>Hedef = önceki 30 günün <strong>%110'u</strong> (otomatik).<br />
              Tahmin = son 7 günün ortalaması × 30.</>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <BigStat
          label="Mevcut Ciro"
          value={fmtTL(status.currentRevenue || 0)}
          sub={(status.revenueChange ?? 0) >= 0
            ? <span style={{ color: 'var(--accent-green)' }}><ArrowUpRight size={12} /> %{status.revenueChange ?? 0} (önceki)</span>
            : <span style={{ color: 'var(--accent-red)' }}><ArrowDownRight size={12} /> %{Math.abs(status.revenueChange ?? 0)}</span>}
        />
        <BigStat
          label="Hedef"
          value={fmtTL(status.goal || 0)}
          sub={`${(status.goalProgress ?? 0) >= 100 ? '🎉' : (status.goalProgress ?? 0) >= 70 ? '🟢' : '🔴'} %${status.goalProgress ?? 0} tamamlandı`}
        />
        <BigStat
          label="30 Gün Tahmini"
          value={fmtTL(status.forecast30Days || 0)}
          sub={`Günlük ort: ${fmtTL(status.dailyAverage || 0)}`}
          color="var(--accent-amber)"
        />
        <BigStat
          label="Sipariş Sayısı"
          value={fmtNum(status.currentOrders || 0)}
          sub={(status.currentOrders || 0) > 0
            ? `Ortalama: ${fmtTL(Math.round((status.currentRevenue || 0) / status.currentOrders))} / sipariş`
            : ''}
        />
      </div>

      <div style={{
        height: 12, background: 'var(--bg-glass)', borderRadius: 999,
        overflow: 'hidden', border: '1px solid var(--border-color)',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, status.goalProgress || 0))}%`,
          background: (status.goalProgress || 0) >= 100
            ? 'var(--gradient-success)'
            : (status.goalProgress || 0) >= 70
            ? 'var(--gradient-warning)'
            : 'var(--gradient-primary)',
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
        {fmtTL(status.currentRevenue || 0)} / {fmtTL(status.goal || 0)}
      </div>
    </SectionWrapper>
  );
}

function ProductsSection({ profitable, losing, noAdStars }) {
  return (
    <SectionWrapper
      icon={<DollarSign size={18} />}
      title="Para Kazandıran vs Para Yutan Ürünler"
      help={<>Spend, kampanya cirosundaki paya göre orantısal dağıtılır.<br />
              <strong>Kâr getiren:</strong> ROAS ≥ 3x. <strong>Para yutan:</strong> ROAS &lt; 2x.</>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InsightCard
          color="var(--accent-green)" icon={<TrendingUp size={16} />}
          title={`💰 Kâr Getiren ${profitable.length} Ürün`}
          action={profitable.length > 0
            ? `Bu ürünlerin reklam bütçesini %20 artırmak ek ${fmtTL(profitable.reduce((s, p) => s + p.netProfit, 0) * 0.2)} kâr getirebilir.`
            : 'Bu dönem ROAS ≥ 3x kâr getiren ürün yok.'}
        >
          {profitable.map(p => (
            <ProductRow key={p.sku} product={p}
              metric={<>ROAS <strong style={{ color: 'var(--accent-green)' }}>{fmtX(p.roas)}</strong> · Net kâr <strong>{fmtTL(p.netProfit)}</strong></>}
            />
          ))}
          {profitable.length === 0 && <Empty>—</Empty>}
        </InsightCard>

        <InsightCard
          color="var(--accent-red)" icon={<TrendingDown size={16} />}
          title={`🚨 Para Yutan ${losing.length} Ürün`}
          action={losing.length > 0
            ? `Bu ürünlerin reklamlarını durdurmak ${fmtTL(losing.reduce((s, p) => s + p.spend, 0))} bütçe tasarrufu sağlar.`
            : 'Tebrikler — para yutan ürün yok!'}
        >
          {losing.map(p => (
            <ProductRow key={p.sku} product={p}
              metric={<>Spend <strong>{fmtTL(p.spend)}</strong> · ROAS <strong style={{ color: 'var(--accent-red)' }}>{fmtX(p.roas)}</strong></>}
            />
          ))}
          {losing.length === 0 && <Empty>Hiç para yutan ürün yok!</Empty>}
        </InsightCard>
      </div>

      {noAdStars.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <InsightCard
            color="var(--accent-blue)" icon={<Sparkles size={16} />}
            title="⭐ Reklamsız Satan Yıldızlar"
            action="Bu ürünler organik trafikten satıyor. Ücretli reklama alırsan satışları katlayabilirsin."
          >
            {noAdStars.map(p => (
              <ProductRow key={p.sku} product={p}
                metric={<>{fmtTL(p.organicRev)} cironun <strong style={{ color: 'var(--accent-blue)' }}>%{p.organicShare}'i</strong> reklamsız</>}
              />
            ))}
          </InsightCard>
        </div>
      )}
    </SectionWrapper>
  );
}

function ParetoSection({ pareto }) {
  return (
    <SectionWrapper
      icon={<Award size={18} />}
      title="Bütçeyi Burada Yoğunlaştır"
      help={<>"<strong>80/20 kuralı</strong>" — ciro genelde az sayıda kampanyadan gelir. Bu liste cironun %80'ini yapan kampanyalardır.</>}
    >
      <div style={{
        padding: 14, marginBottom: 14,
        background: 'rgba(34, 197, 94, 0.08)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
      }}>
        ✨ <strong>{pareto.totalCampaigns}</strong> kampanyadan sadece <strong>{pareto.top.length}</strong> tanesi <strong>cironun %80'ini</strong> yapıyor.
        Bu {pareto.top.length} kampanyaya odaklan, diğerleri için indirim/durdurma değerlendir.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pareto.top.map((c, idx) => (
          <div key={c.campaign_name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 999,
              background: 'var(--accent-red)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>{idx + 1}</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.campaign_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.orders} sipariş</div>
            <div style={{ minWidth: 120, textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtTL(c.revenue)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>cironun %{c.share}'i</div>
            </div>
          </div>
        ))}
        {pareto.top.length === 0 && <Empty>Bu dönem kampanya verisi yok</Empty>}
      </div>
    </SectionWrapper>
  );
}

function CartAbandonSection({ abandoned }) {
  return (
    <SectionWrapper
      icon={<ShoppingCart size={18} />}
      title="Kaybedilen Satışlar"
      help={<>Sepete eklenen ama satın alınmayan ürünler. Genelde fiyat, kargo veya görsel sorunundan.<br />
              <strong>Aksiyon:</strong> %5-10 indirim kuponu veya ücretsiz kargo testi.</>}
    >
      {abandoned.length > 0 ? (
        <>
          <div style={{
            padding: 14, marginBottom: 14,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
          }}>
            💡 <strong>Aksiyon:</strong> Bu ürünlere fiyat denetimi yap, kargo ücretini gözden geçir. %5-10 indirim kuponu otomatik gönder.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {abandoned.map(p => (
              <div key={p.sku} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
              }}>
                <AlertTriangle size={20} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.item_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.item_brand} · {p.sku}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, color: 'var(--accent-amber)', fontWeight: 700 }}>
                    {fmtNum(p.lost)} müşteri kaybedildi
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {fmtNum(p.added)} sepete attı, {fmtNum(p.purchased)} aldı (%{p.conversionRate})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : <Empty>Sepete atılan ürünlerin çoğu satışa dönüşüyor 🎉</Empty>}
    </SectionWrapper>
  );
}

function TrendSection({ rising, falling }) {
  return (
    <SectionWrapper
      icon={<TrendingUp size={18} />}
      title="Yükselen ve Sönen Ürünler"
      help={<>Son 7 gün vs önceki 7 gün karşılaştırması.<br />
              <strong>Yükselen:</strong> %30+ artış. <strong>Sönen:</strong> %30+ düşüş.</>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InsightCard
          color="var(--accent-green)" icon={<ArrowUpRight size={16} />}
          title={`📈 Yükselen ${rising.length} Ürün`}
          action={rising.length > 0 ? 'Bu ürünlerin stoklarını kontrol et, reklam bütçesi yönlendir.' : ''}
        >
          {rising.map(p => (
            <ProductRow key={p.sku} product={p}
              metric={<>{fmtNum(p.prev7)} → <strong style={{ color: 'var(--accent-green)' }}>{fmtNum(p.recent7)}</strong> adet (<strong>+%{p.changePercent}</strong>)</>}
            />
          ))}
          {rising.length === 0 && <Empty>—</Empty>}
        </InsightCard>

        <InsightCard
          color="var(--accent-red)" icon={<ArrowDownRight size={16} />}
          title={`📉 Sönen ${falling.length} Ürün`}
          action={falling.length > 0 ? 'Bu ürünlere indirim/kampanya değerlendir.' : ''}
        >
          {falling.map(p => (
            <ProductRow key={p.sku} product={p}
              metric={<>{fmtNum(p.prev7)} → <strong style={{ color: 'var(--accent-red)' }}>{fmtNum(p.recent7)}</strong> adet (<strong>%{p.changePercent}</strong>)</>}
            />
          ))}
          {falling.length === 0 && <Empty>—</Empty>}
        </InsightCard>
      </div>
    </SectionWrapper>
  );
}

function StockSection({ runningOut, overstocked }) {
  return (
    <SectionWrapper
      icon={<Package size={18} />}
      title="Stok Alarmları"
      help={<>Mevcut satış hızıyla stoğun ne zaman biteceğini gösterir.<br />
              <strong>Tükeniyor:</strong> &lt;14 gün. <strong>Yığılan:</strong> &gt;90 gün.</>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InsightCard
          color="var(--accent-red)" icon={<AlertTriangle size={16} />}
          title={`🚨 Tükeniyor (${runningOut.length})`}
          action={runningOut.length > 0
            ? `Acil sipariş ver. Bu ürünlerin günlük velocity'si toplam ${runningOut.reduce((s, p) => s + (p.dailyVelocity || 0), 0).toFixed(1)} adet.`
            : 'Stoklar şu an güvende.'}
        >
          {runningOut.map(p => (
            <ProductRow key={p.sku} product={p}
              metric={<>Stok: <strong>{fmtNum(p.stock)}</strong> · <strong style={{ color: 'var(--accent-red)' }}>{p.daysLeft} gün kaldı</strong></>}
            />
          ))}
          {runningOut.length === 0 && <Empty>—</Empty>}
        </InsightCard>

        <InsightCard
          color="var(--accent-amber)" icon={<Package size={16} />}
          title={`📦 Yığılan (${overstocked.length})`}
          action={overstocked.length > 0 ? 'Bu ürünlere %15 indirim veya bundle stratejisi.' : ''}
        >
          {overstocked.map(p => (
            <ProductRow key={p.sku} product={p}
              metric={<>Stok: <strong>{fmtNum(p.stock)}</strong> · <strong style={{ color: 'var(--accent-amber)' }}>{p.daysLeft >= 999 ? '900+' : p.daysLeft} gün</strong> yetiyor</>}
            />
          ))}
          {overstocked.length === 0 && <Empty>—</Empty>}
        </InsightCard>
      </div>
    </SectionWrapper>
  );
}

// ============================================================
// Yardımcılar
// ============================================================

function SectionWrapper({ icon, title, help, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: 'rgba(227, 6, 19, 0.12)', color: 'var(--accent-red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
        {help && <HelpTooltip>{help}</HelpTooltip>}
      </div>
      {children}
    </div>
  );
}

function BigStat({ label, value, sub, color }) {
  return (
    <div style={{
      padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', marginTop: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function InsightCard({ color, icon, title, action, children }) {
  return (
    <div style={{
      padding: 16, background: 'var(--bg-card)',
      border: `1px solid ${color}30`, borderTop: `3px solid ${color}`,
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color, fontWeight: 700, fontSize: 13 }}>
        {icon} {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
      {action && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: `${color}10`, border: `1px solid ${color}30`,
          borderRadius: 'var(--radius-sm)',
          fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5,
        }}>
          💡 <strong>Aksiyon:</strong> {action}
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, metric }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px',
      background: 'var(--bg-glass)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.item_name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {product.item_brand}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{metric}</div>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{children}</div>;
}
