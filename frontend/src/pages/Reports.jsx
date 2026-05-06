import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info,
  Target, Award, ShoppingCart, DollarSign, Megaphone, Package, BarChart3,
  Download, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFilters } from '../context/FilterContext';
import { kpiAPI, reportsAPI } from '../services/api';
import FilterBar from '../components/FilterBar';

const fmtTL = (n) => '₺' + Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtX = (n) => n == null ? '–' : `${Number(n).toFixed(2)}x`;
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;

const SEVERITY_ICON = {
  positive: <CheckCircle2 size={18} />,
  warning:  <AlertTriangle size={18} />,
  danger:   <TrendingDown size={18} />,
  info:     <Info size={18} />,
};

// severity önceliği (en kritik/aksiyon gerektiren önce gösterilir)
const SEVERITY_PRIORITY = { danger: 0, warning: 1, positive: 2, info: 3 };

function ReportItem({ severity = 'info', title, children, icon }) {
  return (
    <div className={`report-item severity-${severity}`}>
      <div className={`report-icon severity-${severity}`}>
        {icon || SEVERITY_ICON[severity]}
      </div>
      <div className="report-body">
        <div className="report-title">{title}</div>
        <div className="report-text">{children}</div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { filters } = useFilters();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('campaigns');

  const handleDownloadExcel = async () => {
    setDownloading(true);
    const tid = toast.loading('Excel hazırlanıyor...');
    try {
      const response = await reportsAPI.downloadExcel(filters);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
      a.download = `kpi_raporu${dateSuffix ? '_' + dateSuffix : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel dosyası indirildi', { id: tid });
    } catch (err) {
      console.error('Excel download error:', err);
      toast.error('Excel indirilemedi', { id: tid });
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { platform: _, ...filtersAll } = filters;
    Promise.all([
      kpiAPI.platformOverview(filtersAll),
      kpiAPI.campaignProductBreakdown({ ...filters, topCampaigns: 50, limitPerCampaign: 5 }),
      kpiAPI.campaignProductBreakdown({ ...filters, topCampaigns: 50, limitPerCampaign: 1, direction: 'bottom' }),
      kpiAPI.productCampaignBreakdown({ ...filters, limitProducts: 30, limitCampaignsPerProduct: 3 }),
    ])
      .then(([p, cTop, cBottom, prod]) => {
        if (cancelled) return;
        setData({
          platforms: p.data,
          campaignsTop: cTop.data,
          campaignsBottom: cBottom.data,
          products: prod.data,
        });
      })
      .catch(err => console.error('Reports load error:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  const insights = useMemo(() => {
    if (!data.platforms || !data.campaignsTop) return null;

    const platforms = data.platforms.platforms || [];
    const campaigns = data.campaignsTop.campaigns || [];
    const bottomCampaigns = data.campaignsBottom?.campaigns || [];
    const products = data.products?.products || [];

    const meta = platforms.find(p => p.platform === 'Meta');
    const google = platforms.find(p => p.platform === 'Google');
    const organic = platforms.find(p => p.platform === 'Organic');
    const direct = platforms.find(p => p.platform === 'Direct');

    const totalRevenue = platforms.reduce((s, p) => s + (p.revenue || 0), 0);
    const totalSpend = platforms.reduce((s, p) => s + (p.adSpend || 0), 0);
    const totalOrders = platforms.reduce((s, p) => s + (p.orders || 0), 0);
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;

    const sets = { general: [], campaigns: [], products: [], platforms: [] };

    // ============================================================
    // GENEL — finansal görünüm + aksiyon
    // ============================================================
    if (totalRevenue > 0) {
      sets.general.push({
        severity: 'info', icon: <DollarSign size={18} />,
        title: 'Genel Performans Özeti',
        text: <>Bu dönemde <strong>{fmtTL(totalRevenue)}</strong> ciro,&nbsp;
              <strong>{fmtNum(totalOrders)}</strong> sipariş gerçekleşti.&nbsp;
              {totalSpend > 0 && <>Reklamlara <strong>{fmtTL(totalSpend)}</strong> harcandı,&nbsp;
              genel ROAS <span className="accent">{fmtX(overallRoas)}</span>.</>}</>,
      });
    }
    if (overallRoas != null) {
      if (overallRoas >= 5) {
        sets.general.push({
          severity: 'positive',
          title: 'ROAS Hedef Üzerinde — Bütçeyi Genişlet',
          text: <>Genel ROAS <strong>{fmtX(overallRoas)}</strong>, sektör ortalamasının (4x) üzerinde.&nbsp;
                Mevcut harcama dağılımına devam edilmeli, en iyi 3 kampanyaya <strong>%20–30</strong> ek bütçe ayrılmalı.</>,
        });
      } else if (overallRoas < 2) {
        sets.general.push({
          severity: 'danger',
          title: 'ROAS Kritik — Acil Eylem Planı',
          text: <>Genel ROAS <strong>{fmtX(overallRoas)}</strong>; her 1₺'ye yalnızca {fmtTL(overallRoas)} dönüş.&nbsp;
                İlk adım: ROAS &lt; 1.5x kampanyaları durdur. İkinci adım: yaratıcı/hedefleme yenile. Üçüncü adım: mevcut bütçenin en az <strong>%30</strong>'unu organik+SEO yatırımına kaydır.</>,
        });
      } else {
        sets.general.push({
          severity: 'warning',
          title: 'ROAS Optimize Edilebilir',
          text: <>ROAS <strong>{fmtX(overallRoas)}</strong> kabul edilebilir ama kazançlı değil.&nbsp;
                Bütçenin <strong>%50</strong>+'sı en iyi 5 kampanyaya kayarsa ROAS'ın <strong>~%30</strong> artması beklenir.</>,
        });
      }
    }
    // Genel aksiyon önerisi
    if (campaigns.length > 0 && products.length > 0) {
      const topCamp = campaigns[0];
      const topProd = products[0];
      sets.general.push({
        severity: 'positive', icon: <Target size={18} />,
        title: 'Bu Hafta Odak Noktası',
        text: <><strong>{topCamp.campaign_name}</strong>'da bütçe artışı + <strong>{topProd.item_name}</strong> için ayrı landing page hazırlanması iki kazanan harekettir.&nbsp;
              Mevcut ROAS <span className="accent">{fmtX(topCamp.roas)}</span>; bu kombinasyonla aylık ek <strong>{fmtTL(topCamp.totalRevenue * 0.3)}</strong> ciro hedeflenebilir.</>,
      });
    }

    // ============================================================
    // KAMPANYALAR — yol haritası odaklı
    // ============================================================
    if (campaigns.length > 0) {
      const topCamp = campaigns[0];
      const topProduct = topCamp.topProducts?.[0];
      sets.campaigns.push({
        severity: 'positive', icon: <Award size={18} />,
        title: `1. Odak: ${topCamp.campaign_name}`,
        text: <>Bu kampanya en yüksek ciroyu yapıyor: <strong>{fmtTL(topCamp.totalRevenue)}</strong>&nbsp;
              {topCamp.spend > 0 && <>(ROAS <span className="accent">{fmtX(topCamp.roas)}</span>). </>}
              {topProduct && <>İçerik/yaratıcı odağı <strong>{topProduct.item_name}</strong>'a verilmeli; bu ürün tek başına {fmtTL(topProduct.revenue)} kazandırdı.&nbsp;
              Kampanya bütçesini <strong>%20</strong> artırmak öncelikli aksiyon.</>}</>,
      });

      const highRoasButLow = campaigns
        .filter(c => c.spend > 0 && c.roas >= 5 && c.spend < (totalSpend * 0.05))
        .sort((a, b) => b.roas - a.roas)[0];
      if (highRoasButLow) {
        sets.campaigns.push({
          severity: 'positive', icon: <TrendingUp size={18} />,
          title: '2. Gizli Cevher — Bütçe Artır',
          text: <><strong>{highRoasButLow.campaign_name}</strong> ROAS&nbsp;
                <span className="accent">{fmtX(highRoasButLow.roas)}</span> ile çok verimli ama harcama payı sadece&nbsp;
                <strong>{fmtPct((highRoasButLow.spend / totalSpend) * 100)}</strong>.&nbsp;
                Bütçesi 2–3 katına çıkarılırsa marjinal getiri toplam ciroyu ciddi artırır. Risk düşük çünkü kampanya zaten kazanıyor.</>,
        });
      }

      const lowRoas = campaigns.filter(c => c.spend > 100 && c.roas != null && c.roas < 1.5);
      if (lowRoas.length > 0) {
        const worst = lowRoas.sort((a, b) => a.roas - b.roas)[0];
        sets.campaigns.push({
          severity: 'danger', icon: <AlertTriangle size={18} />,
          title: `${highRoasButLow ? '3' : '2'}. Acil Durdur veya Revize Et`,
          text: <><strong>{lowRoas.length}</strong> kampanyada ROAS 1.5x altında.&nbsp;
                En kötüsü <strong>{worst.campaign_name}</strong>: {fmtTL(worst.spend)} harcamayla yalnızca {fmtTL(worst.totalRevenue)} ciro getirdi.&nbsp;
                Bu hafta bu kampanyalar pause edilmeli; yaratıcı ve hedefleme baştan kurgulanmalı.</>,
        });
      }

      // Eğer yeterince doluysa fazla insight ekleme; eksikse "düşük performans ürünleri"
      if (sets.campaigns.length < 3 && bottomCampaigns.length > 0) {
        const slowProducts = bottomCampaigns
          .flatMap(c => (c.topProducts || []).map(p => ({ ...p, campaign: c.campaign_name })))
          .filter(p => p.units_sold === 1);
        if (slowProducts.length >= 3) {
          sets.campaigns.push({
            severity: 'warning', icon: <Package size={18} />,
            title: `${sets.campaigns.length + 1}. Ürün Eleme Listesi`,
            text: <>Aktif kampanyalarda <strong>{slowProducts.length}</strong> ürün yalnızca 1 adet sattı.&nbsp;
                  Örnek: <strong>{slowProducts[0].item_name}</strong> ({slowProducts[0].campaign}).&nbsp;
                  Bu ürünler kampanya yaratıcısından çıkarılmalı; alanları yıldız ürünlere açılmalı.</>,
          });
        }
      }

      // Hâlâ 3'e ulaşmadıysak basit bir özet öneri ekle
      if (sets.campaigns.length < 3) {
        sets.campaigns.push({
          severity: 'info', icon: <Info size={18} />,
          title: `${sets.campaigns.length + 1}. Genel Tavsiye`,
          text: <>Aktif kampanyaların ortalama ROAS dağılımı dengeli görünüyor.&nbsp;
                A/B test programı başlatıp en iyi yaratıcıları her hafta yeni kampanyalara taşımak verimi sürdürür.</>,
        });
      }
    }

    // ============================================================
    // ÜRÜNLER — yol haritası odaklı
    // ============================================================
    if (products.length > 0) {
      const topProduct = products[0];
      const topPCampaign = topProduct.campaigns?.[0];
      sets.products.push({
        severity: 'positive', icon: <Award size={18} />,
        title: `1. Odak Ürün: ${topProduct.item_name}`,
        text: <>{topProduct.item_brand} markalı bu ürün en yüksek ciroyu yaptı: <strong>{fmtTL(topProduct.totalRevenue)}</strong>&nbsp;
              ({fmtNum(topProduct.totalUnits)} adet).&nbsp;
              {topPCampaign && (
                topPCampaign.campaign_name === '(direct/organic)'
                  ? <>Satışların <strong>{fmtPct((topPCampaign.revenue / topProduct.totalRevenue) * 100)}</strong>'i organik trafikten geliyor; ücretli kampanyaya alınırsa <strong>2–3 kat</strong> büyüme bekleniyor.</>
                  : <>En kazandıran kampanyası <strong>{topPCampaign.campaign_name}</strong>; bu ürüne özel landing page açıp tek bir hero kampanyaya odaklanmak öncelikli.</>
              )}</>,
      });

      const onlyOrganic = products.filter(p =>
        (p.campaigns || []).every(c => c.campaign_name === '(direct/organic)') && p.totalRevenue > 1000
      );
      if (onlyOrganic.length > 0) {
        sets.products.push({
          severity: 'warning', icon: <Target size={18} />,
          title: '2. Reklamsız Satan Ürünler — Fırsat',
          text: <><strong>{onlyOrganic.length}</strong> ürün sadece organik/doğrudan trafikten satılıyor (örn. <strong>{onlyOrganic[0].item_name}</strong>: {fmtTL(onlyOrganic[0].totalRevenue)}).&nbsp;
                Talep zaten var; ücretli kampanyaya alınırsa görünürlüğü artar. Düşük bütçeli (<strong>~₺500/gün</strong>) test kampanyası açılmalı.</>,
        });
      }

      const multiCampaignProducts = products.filter(p =>
        (p.campaigns || []).filter(c => c.campaign_name !== '(direct/organic)').length >= 3
      );
      if (multiCampaignProducts.length > 0 && sets.products.length < 3) {
        const top = multiCampaignProducts[0];
        const realCampaigns = top.campaigns.filter(c => c.campaign_name !== '(direct/organic)');
        sets.products.push({
          severity: 'info', icon: <BarChart3 size={18} />,
          title: `${sets.products.length + 1}. Çok Kanaldan Satan Yıldız`,
          text: <><strong>{top.item_name}</strong> tam <strong>{realCampaigns.length}</strong> farklı kampanyada satılıyor.&nbsp;
                Bu kadar kanal CPC'yi yükseltir; trafiği tek bir hero kampanyaya yönlendirip diğerlerinden bu ürünü çıkarmak etkili olur.</>,
        });
      }

      // Hâlâ 3'e ulaşmadıysak ek öneri
      if (sets.products.length < 3) {
        const bottom = [...products].sort((a, b) => a.totalRevenue - b.totalRevenue)[0];
        if (bottom) {
          sets.products.push({
            severity: 'info', icon: <Package size={18} />,
            title: `${sets.products.length + 1}. Düşük Performans Ürünü`,
            text: <>Listenin en altındaki ürün <strong>{bottom.item_name}</strong>: yalnızca {fmtTL(bottom.totalRevenue)} ciro.&nbsp;
                  Stok eritme indirimi veya bundle stratejisi düşünülmeli; reklam bütçesi ayrılmamalı.</>,
          });
        }
      }
    }

    // ============================================================
    // PLATFORMLAR — yol haritası
    // ============================================================
    if (meta && google) {
      const metaShare = totalRevenue > 0 ? (meta.revenue / totalRevenue) * 100 : 0;
      const googleShare = totalRevenue > 0 ? (google.revenue / totalRevenue) * 100 : 0;

      if (meta.roas != null && google.roas != null) {
        const better = meta.roas > google.roas ? meta : google;
        const worse  = meta.roas > google.roas ? google : meta;
        const diff = ((better.roas - worse.roas) / worse.roas) * 100;
        if (diff > 20) {
          sets.platforms.push({
            severity: 'warning', icon: <TrendingUp size={18} />,
            title: '1. Bütçe Kaydırması',
            text: <><strong>{better.platform}</strong> ROAS <span className="accent">{fmtX(better.roas)}</span>,&nbsp;
                  {worse.platform} ROAS {fmtX(worse.roas)}. {better.platform} <strong>%{diff.toFixed(0)}</strong> daha verimli.&nbsp;
                  {worse.platform}'tan {better.platform}'a <strong>%15–20</strong> bütçe transferi ile aylık ciro artışı bekleniyor.</>,
          });
        } else {
          sets.platforms.push({
            severity: 'positive', icon: <CheckCircle2 size={18} />,
            title: '1. Dengeli Platform Performansı',
            text: <>Meta ({fmtX(meta.roas)}) ve Google ({fmtX(google.roas)}) birbirine yakın çalışıyor.&nbsp;
                  Aktif strateji korunmalı; bütçe ayarlamasından önce ürün-platform eşleştirmesine odaklanılmalı.</>,
          });
        }
      }

      sets.platforms.push({
        severity: 'info', icon: <BarChart3 size={18} />,
        title: '2. Ciro Dağılımı Haritası',
        text: <>Meta <strong>{fmtPct(metaShare)}</strong>, Google <strong>{fmtPct(googleShare)}</strong>,&nbsp;
              Organik {fmtPct(organic ? (organic.revenue / totalRevenue) * 100 : 0)},&nbsp;
              Direct {fmtPct(direct ? (direct.revenue / totalRevenue) * 100 : 0)}.&nbsp;
              Hedef: paid platformların payı %50'yi geçmesin; aşılırsa reklam bağımlılığı artar.</>,
      });
    }

    if (organic && totalRevenue > 0) {
      const organicShare = (organic.revenue / totalRevenue) * 100;
      if (organicShare > 30) {
        sets.platforms.push({
          severity: 'positive', icon: <Award size={18} />,
          title: '3. SEO Yatırımı Sürdür',
          text: <>Organik ciro toplamın <strong>{fmtPct(organicShare)}</strong>'i ({fmtTL(organic.revenue)}).&nbsp;
                İçerik üretimi ve SEO bütçesi azaltılmamalı; bu kanal reklam kapansa bile kazanmaya devam eder.</>,
        });
      } else if (organicShare < 10 && totalSpend > 1000) {
        sets.platforms.push({
          severity: 'danger', icon: <AlertTriangle size={18} />,
          title: '3. Organik Zayıflık — Risk',
          text: <>Organik ciro toplamın yalnızca <strong>{fmtPct(organicShare)}</strong>'i.&nbsp;
                Reklamlar kapansa ciro %{(100 - organicShare).toFixed(0)} düşer.&nbsp;
                SEO ve marka bilinirliği yatırımları acil artırılmalı; içerik üretimi haftalık plana alınmalı.</>,
        });
      } else if (sets.platforms.length < 3) {
        sets.platforms.push({
          severity: 'info', icon: <ShoppingCart size={18} />,
          title: '3. Direct & Organic Müşteri Davranışı',
          text: direct && organic && direct.aov > 0 && organic.aov > 0 ? (
            <>Direct AOV {fmtTL(direct.aov)}, Organik AOV {fmtTL(organic.aov)}.&nbsp;
              {direct.aov > organic.aov
                ? 'Sadık müşteriler organikten gelen yeni kullanıcılardan daha çok harcıyor — e-mail/loyalty programı genişletilmeli.'
                : 'Yeni kullanıcı motivasyonu zayıf — landing page deneyimi gözden geçirilmeli.'}</>
          ) : (
            <>Reklamsız trafik (organic+direct) toplam siparişlerin&nbsp;
              <strong>{fmtPct(((organic?.orders || 0) + (direct?.orders || 0)) / Math.max(totalOrders, 1) * 100)}</strong>'ini kapsıyor.&nbsp;
              Bu segmente özel re-engagement kampanyası planlanmalı.</>
          ),
        });
      }
    }

    // Her tab'i severity önceliğine göre sırala ve top 3 al
    for (const k of Object.keys(sets)) {
      sets[k] = [...sets[k]]
        .sort((a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity])
        .slice(0, 3);
    }

    return sets;
  }, [data]);

  const TABS = [
    { key: 'general',   label: 'Genel',       icon: <DollarSign size={15} /> },
    { key: 'campaigns', label: 'Kampanyalar', icon: <Megaphone size={15} /> },
    { key: 'products',  label: 'Ürünler',     icon: <Package size={15} /> },
    { key: 'platforms', label: 'Platformlar', icon: <Layers size={15} /> },
  ];

  const activeItems = insights ? insights[activeTab] || [] : [];
  const tabSubtitle = {
    general:   'Genel finansal görünüm ve bu döneme özel odak önerisi.',
    campaigns: 'Kampanya bazında izlenmesi gereken yol haritası.',
    products:  'Ürün bazında öne çıkan fırsatlar ve aksiyonlar.',
    platforms: 'Platform bazında bütçe ve strateji önerileri.',
  };

  return (
    <div className="page-container animate-fade-in">
      <FilterBar showChannel={true} showDevice={true} showBrand={false} />

      {/* Üst banner + Excel butonu */}
      <div style={{
        padding: '20px 24px', marginBottom: 24, borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(227,6,19,0.12), rgba(20,20,22,0.6))',
        border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>YÖNETİCİ RAPORU</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            Aşağıdaki sekmelerde her kategoriye özel <strong>3 öneri</strong> var.&nbsp;
            Cümleler seçili tarih aralığı ve filtrelere göre otomatik güncellenir.
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={downloading || loading}
          className="btn-excel-download"
        >
          <Download size={16} />
          {downloading ? 'Hazırlanıyor...' : 'Excel İndir'}
        </button>
      </div>

      {/* Tab butonları */}
      <div className="report-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`report-tab ${activeTab === t.key ? 'report-tab-active' : ''}`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Aktif tab içeriği */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          Veriler analiz ediliyor...
        </div>
      ) : !insights ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          Bu tarih aralığında raporlanacak veri yok.
        </div>
      ) : (
        <div className="report-tab-content">
          <div className="report-tab-subtitle">{tabSubtitle[activeTab]}</div>
          {activeItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Bu kategori için bu dönemde dikkat çekici bir bulgu yok.
            </div>
          ) : (
            <div className="report-list">
              {activeItems.map((it, i) => (
                <ReportItem key={activeTab + i} severity={it.severity} title={it.title} icon={it.icon}>
                  {it.text}
                </ReportItem>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
