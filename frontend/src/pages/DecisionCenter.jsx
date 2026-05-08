import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    kpiAPI.decisionCenter(filters)
      .then(({ data }) => !cancelled && setData(data))
      .catch(err => console.error('decision-center error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  if (loading || !data) {
    return (
      <div className="page-container animate-fade-in">
        <FilterBar showChannel={false} showDevice={false} />
        <div className="card"><div className="card-body" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          {loading ? 'Veriler hazırlanıyor...' : 'Veri yok'}
        </div></div>
      </div>
    );
  }

  const { status, profitable, losing, noAdStars, pareto, abandonedProducts, rising, falling, runningOut, overstocked } = data;

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={false} showDevice={false} />

      {/* Hoş geldin başlığı */}
      <div style={{
        padding: '20px 24px', marginBottom: 24, borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(227,6,19,0.10), rgba(20,20,22,0.6))',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={28} style={{ color: 'var(--accent-red)' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Karar Merkezi</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Bu sayfa, hangi kampanyayı veya ürünü desteklemen, hangisinden bütçe çekmen gerektiğini söyler.
              Her bölümde somut aksiyon önerisi var.
            </div>
          </div>
        </div>
      </div>

      {/* ============ 1. BU AYKİ DURUM ============ */}
      <Section
        icon={<Target size={18} />}
        title="Bu Ayki Durum"
        subtitle="Hedefe ne kadar yaklaştığın ve önümüzdeki 30 gün için tahmin"
        help={<>Hedef = önceki 30 günün <strong>%110'u</strong> (otomatik hesaplanır).<br />
              Tahmin = son 7 günün günlük ortalaması × 30.<br />
              Kalan günde günlük ne kadar gerek = (Hedef − Mevcut) ÷ Kalan gün.</>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <BigStat
            label="Mevcut Ciro"
            value={fmtTL(status.currentRevenue)}
            sub={status.revenueChange >= 0
              ? <span style={{ color: 'var(--accent-green)' }}><ArrowUpRight size={12} /> %{status.revenueChange} (önceki dönem)</span>
              : <span style={{ color: 'var(--accent-red)' }}><ArrowDownRight size={12} /> %{Math.abs(status.revenueChange)} (önceki dönem)</span>}
          />
          <BigStat
            label="Hedef"
            value={fmtTL(status.goal)}
            sub={`${status.goalProgress >= 100 ? '🎉' : status.goalProgress >= 70 ? '🟢' : status.goalProgress >= 50 ? '🟡' : '🔴'} %${status.goalProgress} tamamlandı`}
          />
          <BigStat
            label="Sonraki 30 Gün Tahmini"
            value={fmtTL(status.forecast30Days)}
            sub={`Günlük ortalama: ${fmtTL(status.dailyAverage)}`}
            color="var(--accent-amber)"
          />
          <BigStat
            label="Sipariş Sayısı"
            value={fmtNum(status.currentOrders)}
            sub={status.currentOrders > 0
              ? `Ortalama: ${fmtTL(Math.round(status.currentRevenue / status.currentOrders))} / sipariş`
              : ''}
          />
        </div>

        {/* Hedef progress bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{
            height: 10, background: 'var(--bg-glass)', borderRadius: 999,
            overflow: 'hidden', border: '1px solid var(--border-color)',
          }}>
            <div style={{
              height: '100%', width: `${Math.min(100, status.goalProgress)}%`,
              background: status.goalProgress >= 100
                ? 'var(--gradient-success)'
                : status.goalProgress >= 70
                ? 'var(--gradient-warning)'
                : 'var(--gradient-primary)',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </Section>

      {/* ============ 2. PARA KAZANDIRAN VS PARA YUTAN ÜRÜNLER ============ */}
      <Section
        icon={<DollarSign size={18} />}
        title="Para Kazandıran vs Para Yutan Ürünler"
        subtitle="Hangi ürünlere reklam vermeye devam et, hangilerini durdur"
        help={<>Ürün başına spend, kampanyaların reklam harcamasının o ürünün kampanya cirosundaki payına göre orantısal dağıtılır.<br />
              <strong>Kâr getiren:</strong> ROAS ≥ 3x ve net kâr pozitif.<br />
              <strong>Para yutan:</strong> ROAS &lt; 2x — reklam parası yatırıldı ama dönüşü düşük.</>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Kâr eden */}
          <InsightCard
            color="var(--accent-green)"
            icon={<TrendingUp size={16} />}
            title={`💰 Kâr Getiren ${profitable.length} Ürün`}
            action={profitable.length > 0
              ? `Bu ürünlerin reklam bütçesini %20 artırmak ek ${fmtTL(profitable.reduce((s, p) => s + p.netProfit, 0) * 0.2)} ek kâr getirebilir.`
              : 'Bu dönem ROAS ≥ 3x kâr getiren ürün yok.'}
          >
            {profitable.map(p => (
              <ProductRow key={p.sku} product={p}
                metric={<>ROAS <strong style={{ color: 'var(--accent-green)' }}>{fmtX(p.roas)}</strong> · Net kâr <strong>{fmtTL(p.netProfit)}</strong></>}
              />
            ))}
            {profitable.length === 0 && <Empty>—</Empty>}
          </InsightCard>

          {/* Zarar eden */}
          <InsightCard
            color="var(--accent-red)"
            icon={<TrendingDown size={16} />}
            title={`🚨 Para Yutan ${losing.length} Ürün`}
            action={losing.length > 0
              ? `Bu ürünlerin reklamlarını durdurmak ${fmtTL(losing.reduce((s, p) => s + p.spend, 0))} bütçe tasarrufu sağlar.`
              : 'Bu dönem ROAS < 2x para yutan ürün yok 🎉'}
          >
            {losing.map(p => (
              <ProductRow key={p.sku} product={p}
                metric={<>Spend <strong>{fmtTL(p.spend)}</strong> · Ciro {fmtTL(p.revenue)} · ROAS <strong style={{ color: 'var(--accent-red)' }}>{fmtX(p.roas)}</strong></>}
              />
            ))}
            {losing.length === 0 && <Empty>Tebrikler — hiç para yutan ürün yok!</Empty>}
          </InsightCard>
        </div>

        {/* Reklamsız satan yıldızlar */}
        {noAdStars.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <InsightCard
              color="var(--accent-blue)"
              icon={<Sparkles size={16} />}
              title="⭐ Reklamsız Satan Yıldızlar"
              action="Bu ürünler ücretsiz organik trafikten çok satıyor. Ücretli reklama alırsan satışları katlayabilirsin."
            >
              {noAdStars.map(p => (
                <ProductRow key={p.sku} product={p}
                  metric={<>{fmtTL(p.organicRev)} cironun <strong style={{ color: 'var(--accent-blue)' }}>%{p.organicShare}'i</strong> reklamsız geliyor</>}
                />
              ))}
            </InsightCard>
          </div>
        )}
      </Section>

      {/* ============ 3. PARETO 80/20 ============ */}
      <Section
        icon={<Award size={18} />}
        title="Bütçeyi Burada Yoğunlaştır"
        subtitle="Cironun %80'ini hangi kampanyalar yapıyor"
        help={<>"<strong>80/20 kuralı</strong>": ciro genelde az sayıda kampanyadan gelir.<br />
              Bu liste cironun %80'ini yapan kampanyaları gösterir. Bu kampanyaların reklam bütçesini koruyup artırmak en yüksek getiriyi verir.</>}
      >
        <div style={{
          padding: 14, marginBottom: 12,
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          color: 'var(--text-primary)',
        }}>
          ✨ <strong>{pareto.totalCampaigns}</strong> kampanyadan sadece <strong>{pareto.top.length}</strong> tanesi <strong>cironun %80'ini</strong> yapıyor
          (kampanyaların <strong>%{pareto.ratio}'si</strong>).
          Bu {pareto.top.length} kampanyaya odaklan, diğerleri için indirim/durdurma değerlendir.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pareto.top.map((c, idx) => (
            <div key={c.campaign_name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: 'var(--accent-red)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>{idx + 1}</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.campaign_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.orders} sipariş</div>
              <div style={{ minWidth: 100, textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtTL(c.revenue)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>cironun %{c.share}'i</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ============ 4. CART ABANDONMENT ============ */}
      <Section
        icon={<ShoppingCart size={18} />}
        title="Kaybedilen Satışlar"
        subtitle="Sepete atılıp alınmayan ürünler — satış olabilirdi"
        help={<>Bu ürünlere müşteri ilgi gösterdi (sepete attı) ama satın almadı. Sebep genelde:<br />
              • <strong>Fiyat</strong> (rakipten pahalı)<br />
              • <strong>Görseller / açıklama</strong> (yetersiz)<br />
              • <strong>Kargo ücreti</strong> (sepette ürküttü)<br />
              <strong>Aksiyon:</strong> bu ürünlere %5-10 indirim kuponu veya ücretsiz kargo testi.</>}
      >
        {abandonedProducts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {abandonedProducts.map(p => (
              <div key={p.sku} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
              }}>
                <AlertTriangle size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.item_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.item_brand} · SKU: {p.sku}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--accent-amber)', fontWeight: 700 }}>
                    {fmtNum(p.lost)} müşteri kaybedildi
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {fmtNum(p.added)} sepete attı, {fmtNum(p.purchased)} aldı (%{p.conversionRate} dönüş)
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>Sepete atılan ürünlerin çoğu satışa dönüşüyor 🎉</Empty>}
      </Section>

      {/* ============ 5. YÜKSELEN / SÖNEN ============ */}
      <Section
        icon={<TrendingUp size={18} />}
        title="Yükselen ve Sönen Ürünler"
        subtitle="Son 7 gün vs önceki 7 gün — neyi destekleyelim, neyi bırakalım"
        help={<>Ürünün son 7 gündeki satışı önceki 7 günle karşılaştırılır.<br />
              <strong>Yükselen</strong>: %30+ artış → trend yakalandı, stoklara dikkat et, reklam bütçesi yönlendir.<br />
              <strong>Sönen</strong>: %30+ düşüş → ilgi kayboluyor, indirim veya kampanya sonu.</>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InsightCard
            color="var(--accent-green)" icon={<ArrowUpRight size={16} />}
            title={`📈 Yükselen ${rising.length} Ürün`}
            action={rising.length > 0 ? 'Bu ürünlerin stoklarını kontrol et, reklam bütçesi yönlendirebilirsin.' : ''}
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
            action={falling.length > 0 ? 'Bu ürünlere indirim/kampanya ya da reklam bütçesi azaltma değerlendir.' : ''}
          >
            {falling.map(p => (
              <ProductRow key={p.sku} product={p}
                metric={<>{fmtNum(p.prev7)} → <strong style={{ color: 'var(--accent-red)' }}>{fmtNum(p.recent7)}</strong> adet (<strong>%{p.changePercent}</strong>)</>}
              />
            ))}
            {falling.length === 0 && <Empty>—</Empty>}
          </InsightCard>
        </div>
      </Section>

      {/* ============ 6. STOK ALARMLARI ============ */}
      <Section
        icon={<Package size={18} />}
        title="Stok Alarmları"
        subtitle="Tükenmek üzere olanlar ve yığılmış stoklar"
        help={<>Mevcut satış hızıyla stoğun ne zaman biteceğini gösterir.<br />
              <strong>Tükeniyor</strong>: 14 günden az kaldı → acil sipariş.<br />
              <strong>Yığılan</strong>: 90 gün+ stok → indirim/bundle stratejisi.</>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InsightCard
            color="var(--accent-red)" icon={<AlertTriangle size={16} />}
            title={`🚨 Tükeniyor (${runningOut.length})`}
            action={runningOut.length > 0
              ? `Acil sipariş ver. Bu ürünler tükenirse ortalama günlük ${fmtTL(runningOut.reduce((s, p) => s + p.dailyVelocity * 1000, 0))} satış kaybı yaşanabilir.`
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
            action={overstocked.length > 0 ? 'Bu ürünlere %15 indirim veya bundle (paket) yapmak nakit akışını rahatlatır.' : ''}
          >
            {overstocked.map(p => (
              <ProductRow key={p.sku} product={p}
                metric={<>Stok: <strong>{fmtNum(p.stock)}</strong> · <strong style={{ color: 'var(--accent-amber)' }}>{p.daysLeft >= 999 ? '900+' : p.daysLeft} gün</strong> yetiyor</>}
              />
            ))}
            {overstocked.length === 0 && <Empty>—</Empty>}
          </InsightCard>
        </div>
      </Section>
    </div>
  );
}

// ============================================================
// Yardımcı componentler
// ============================================================

function Section({ icon, title, subtitle, help, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: 'rgba(227, 6, 19, 0.12)', color: 'var(--accent-red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
            {help && <HelpTooltip>{help}</HelpTooltip>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
        </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: color, fontWeight: 700, fontSize: 13 }}>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
