import { useState, useEffect, useCallback, Fragment } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { importAPI, dataAPI } from '../services/api';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, RefreshCw, Clock, Database, Trash2 } from 'lucide-react';

const STEPS = ['Dosya Yükle', 'Tablo & Kolon Eşleme', 'İçe Aktar', 'Sonuç'];

export default function Import() {
  const [step, setStep] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [columnMapping, setColumnMapping] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [tables, setTables] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [tableCounts, setTableCounts] = useState({});
  const [deletingTable, setDeletingTable] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearAllStage, setClearAllStage] = useState(0); // 0: idle, 1: ilk onay, 2: ikinci onay, 3: çalışıyor

  const fetchTables = async () => {
    try {
      const { data } = await importAPI.tableStatus();
      // Sabit priority sırasına göre listele (önerme yok, doğal sıra)
      const sorted = [...data.tables].sort((a, b) => (a.priority || 99) - (b.priority || 99));
      setTables(sorted);
      const counts = {};
      sorted.forEach(t => { counts[t.id] = t.rowCount; });
      setTableCounts(counts);
    } catch (err) {
      console.error('table-status error:', err);
    }
  };

  useEffect(() => {
    fetchTables();
    importAPI.history().then(r => setHistory(r.data)).catch(() => {});
  }, []);

  const handleClearTable = async (tableId) => {
    try {
      setClearing(true);
      toast.loading(`${tableId} temizleniyor...`, { id: 'clear' });
      await dataAPI.clearTable(tableId);
      toast.success(`${tableId} başarıyla temizlendi`, { id: 'clear' });
      setDeletingTable(null);
      fetchTables();
    } catch (err) {
      toast.error('Hata: ' + (err.response?.data?.error || err.message), { id: 'clear' });
    } finally {
      setClearing(false);
    }
  };

  const handleClearAll = async () => {
    setClearAllStage(3);
    const tid = toast.loading('Tüm veriler siliniyor...');
    try {
      const { data } = await dataAPI.clearAll('DELETE_ALL');
      toast.success(`Toplam ${data.totalDeleted.toLocaleString('tr-TR')} kayıt silindi`, { id: tid, duration: 5000 });
      setClearAllStage(0);
      fetchTables();
    } catch (err) {
      toast.error('Hata: ' + (err.response?.data?.error || err.message), { id: tid });
      setClearAllStage(0);
    }
  };

  const onDrop = useCallback(async (files) => {
    if (!files.length) return;
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetTable', '');
    try {
      toast.loading('Dosya yükleniyor...', { id: 'upload' });
      const { data } = await importAPI.upload(formData);
      setUploadResult(data);
      setSelectedTable(data.detectedTable || '');
      // Auto-build column mapping from detected table
      const autoMapping = {};
      (data.columns || []).forEach(col => { autoMapping[col] = col; });
      setColumnMapping(autoMapping);
      toast.success('Dosya yüklendi!', { id: 'upload' });
      setStep(1);
    } catch (err) {
      toast.error('Yükleme hatası: ' + (err.response?.data?.error || err.message), { id: 'upload' });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/json': ['.json'] },
    maxFiles: 1,
  });

  const handleExecute = async () => {
    if (!selectedTable) { toast.error('Lütfen hedef tablo seçin'); return; }
    setExecuting(true);
    try {
      toast.loading('Veri içe aktarılıyor...', { id: 'import' });
      const { data } = await importAPI.execute({
        importId: uploadResult.importId,
        targetTable: selectedTable,
        columnMapping,
        filePath: uploadResult.filePath,
      });
      setImportResult(data);
      toast.success(`${data.importedRows} satır başarıyla aktarıldı!`, { id: 'import' });
      setStep(3);
      // Refresh history and table counts
      importAPI.history().then(r => setHistory(r.data)).catch(() => {});
      fetchTables();
    } catch (err) {
      toast.error('İçe aktarma hatası: ' + (err.response?.data?.error || err.message), { id: 'import' });
    } finally {
      setExecuting(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setUploadResult(null);
    setSelectedTable('');
    setColumnMapping({});
    setImportResult(null);
  };

  const TableSchema = {
    ga4_traffic: ['date','sessionSource','sessionMedium','sessionCampaignName','sessionDefaultChannelGroup','deviceCategory','city','landingPagePlusQueryString','newVsReturning','sessions','totalUsers','newUsers','bounceRate','averageSessionDuration','screenPageViewsPerSession','engagedSessions','engagementRate','userEngagementDuration','conversions','purchaseRevenue','transactions'],
    ga4_item_interactions: ['date','itemId','itemName','itemCategory','itemCategory2','itemBrand','itemsViewed','itemsAddedToCart','itemsCheckedOut','itemsPurchased','itemRevenue','itemListViews','itemListClicks','cartToViewRate'],
    meta_ads: ['date_start','date_stop','account_id','account_name','campaign_id','campaign_name','adset_id','adset_name','ad_id','ad_name','objective','buying_type','impressions','reach','frequency','clicks','inline_link_clicks','spend','cpc','cpm','cpp','ctr','inline_link_click_ctr','actions:link_click','actions:landing_page_view','actions:offsite_conversion.fb_pixel_view_content','actions:offsite_conversion.fb_pixel_add_to_cart','actions:offsite_conversion.fb_pixel_initiate_checkout','actions:offsite_conversion.fb_pixel_purchase','action_values:offsite_conversion.fb_pixel_purchase','actions:page_engagement','actions:post_engagement','actions:video_view'],
    meta_ads_breakdowns: ['date_start','date_stop','campaign_name','adset_name','ad_name','publisher_platform','platform_position','impression_device','impressions','clicks','spend'],
    google_ads: ['segments.date','customer.id','customer.descriptive_name','campaign.id','campaign.name','campaign.status','campaign.advertising_channel_type','ad_group.id','ad_group.name','ad_group.status','segments.device','segments.ad_network_type','segments.product_item_id','segments.product_title','segments.product_brand','segments.product_type_l1','segments.product_type_l2','ad_group_criterion.keyword.text','ad_group_criterion.keyword.match_type','metrics.impressions','metrics.clicks','metrics.cost_micros','metrics.ctr','metrics.average_cpc','metrics.average_cpm','metrics.conversions','metrics.conversions_value','metrics.all_conversions','metrics.all_conversions_value','metrics.cost_per_conversion','metrics.conversions_from_interactions_rate','metrics.value_per_conversion','metrics.search_impression_share','metrics.search_budget_lost_impression_share','metrics.search_rank_lost_impression_share','metrics.view_through_conversions','metrics.interaction_rate'],
    orders: ['order_id','order_date','customer_id','city','device','channel','source','medium','campaign_name','coupon_code','product_count','order_revenue','shipping_cost','discount_amount','refund_amount','net_revenue','order_status','payment_method'],
    order_items: ['order_id','line_id','item_id','item_name','item_category','item_category2','item_brand','quantity','unit_price','line_total','discount_amount','refund_amount'],
    products: ['sku','product_name','category','sub_category','brand','gender','price','cost_price','stock_quantity','is_active','created_at','color','size_range'],
    customers: ['customer_id','customer_name','first_order_date','registration_date','city','gender','age_group','registration_source','is_newsletter_subscriber','total_orders','total_revenue','last_order_date'],
    campaigns: ['campaign_name','platform','campaign_type','objective','start_date','end_date','daily_budget','total_budget','target_audience','status'],
    channel_mapping: ['source','medium','channel_group'],
  };

  const targetColumns = selectedTable && TableSchema[selectedTable] ? TableSchema[selectedTable] : [];

  return (
    <div className="import-page animate-fade-in">
      {/* Steps */}
      <div className="import-steps">
        {STEPS.map((label, i) => (
          <Fragment key={label}>
            <div className={`import-step ${step === i ? 'active' : ''} ${step > i ? 'done' : ''}`}>
              <div className="import-step-number">
                {step > i ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className="import-step-label">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`import-step-line ${step > i ? 'done' : ''}`} />
            )}
          </Fragment>
        ))}
      </div>

      {/* Step 0: Upload */}
      {/* Tüm Verileri Temizle — 2-aşamalı onay modal'ı */}
      {clearAllStage > 0 && (
        <div className="modal-overlay" onClick={() => clearAllStage < 3 && setClearAllStage(0)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--accent-red)' }}>
                <AlertCircle size={20} /> {clearAllStage === 3 ? 'Siliniyor...' : 'Tüm Verileri Temizle'}
              </div>
            </div>
            <div className="modal-body">
              {clearAllStage === 1 && (
                <>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.6 }}>
                    Bu işlem <strong style={{ color: 'var(--accent-red)' }}>11 tablodaki tüm verileri</strong> kalıcı olarak siler:
                  </div>
                  <ul style={{ margin: '0 0 14px 0', padding: '0 0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <li>Siparişler, Sipariş Kalemleri, Müşteriler</li>
                    <li>Ürünler, Kampanyalar</li>
                    <li>Meta Ads, Google Ads, GA4 Trafik, GA4 Ürün Etkileşim</li>
                    <li>Meta Ads Kırılımlar, Kanal Eşleme</li>
                  </ul>
                  <div style={{ padding: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 8 }}>
                    ℹ️ Kullanıcılar, izinler ve import logları korunur. Bu işlem geri alınamaz.
                  </div>
                </>
              )}
              {clearAllStage === 2 && (
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  Son onay: tüm import edilmiş veri tablolarını silmek istiyor musunuz?
                  <div style={{ marginTop: 10, color: 'var(--accent-red)', fontWeight: 600 }}>
                    Bu işlem geri alınamaz.
                  </div>
                </div>
              )}
              {clearAllStage === 3 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                  Tablolar temizleniyor, lütfen bekleyin...
                </div>
              )}
            </div>
            {clearAllStage < 3 && (
              <div className="modal-footer">
                <button type="button" className="btn-secondary-mini" onClick={() => setClearAllStage(0)}>
                  Vazgeç
                </button>
                {clearAllStage === 1 && (
                  <button type="button" className="btn-primary-mini" style={{ background: 'var(--accent-red)' }}
                          onClick={() => setClearAllStage(2)}>
                    Devam Et →
                  </button>
                )}
                {clearAllStage === 2 && (
                  <button type="button" className="btn-primary-mini" style={{ background: 'var(--accent-red)' }}
                          onClick={handleClearAll}>
                    Evet, Tümünü Sil
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="card animate-fade-in">
          <div className="card-body">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <div className="dropzone-icon">
                <Upload size={32} />
              </div>
              <p className="dropzone-text">Dosyayı buraya sürükleyin veya tıklayın</p>
              <p className="dropzone-hint">Desteklenen formatlar: CSV, XLSX, JSON • Maks. 50MB</p>
              <button className="btn btn-primary" style={{ marginTop: 8 }}>
                <FileText size={16} /> Dosya Seç
              </button>
            </div>

            {/* Tablo durumu */}
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                  Veri Tabloları
                </h3>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setClearAllStage(1)}
                  disabled={clearAllStage > 0}
                >
                  <Trash2 size={13} /> Tüm Verileri Temizle
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {tables.map(t => {
                  const count = t.rowCount || 0;
                  const dot = t.status === 'empty' ? '🟢' : t.status === 'low' ? '🟡' : '🔵';
                  const cardBorderColor = t.status === 'empty'
                    ? 'rgba(34, 197, 94, 0.4)'
                    : t.status === 'low'
                    ? 'rgba(245, 158, 11, 0.4)'
                    : 'var(--border-color)';
                  const cardBg = t.status === 'empty'
                    ? 'rgba(34, 197, 94, 0.04)'
                    : t.status === 'low'
                    ? 'rgba(245, 158, 11, 0.04)'
                    : 'var(--bg-glass)';
                  const lastImportText = t.lastImport
                    ? `${new Date(t.lastImport.created_at).toLocaleDateString('tr-TR')} — ${t.lastImport.imported_rows || 0} satır`
                    : 'henüz import yok';

                  return (
                    <div key={t.id} style={{
                      display: 'flex', flexDirection: 'column',
                      padding: '14px 16px',
                      background: cardBg,
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${cardBorderColor}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{t.icon}</span>
                        <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{t.name}</div>
                        <span title={t.status === 'empty' ? 'Tablo boş, doldurulabilir' : t.status === 'low' ? 'Az veri var' : 'Tablo dolu'}>
                          {dot}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: count > 0 ? 'var(--text-primary)' : 'var(--accent-green)' }}>
                          {count.toLocaleString('tr-TR')}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kayıt</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Son: {lastImportText}
                      </div>
                      <div style={{ fontSize: 10, color: t.hasUniqueKey ? 'var(--accent-green)' : 'var(--accent-amber)', marginBottom: 8 }}>
                        {t.hasUniqueKey ? '✓ Duplicate engellenir' : '⚠ Event tablosu (aynı dosyayı 2 kez yüklemeyin)'}
                      </div>
                      {count > 0 && (
                        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          {deletingTable === t.id ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                style={{ padding: '2px 8px', fontSize: 11, flex: 1 }}
                                disabled={clearing}
                                onClick={(e) => { e.stopPropagation(); handleClearTable(t.id); }}
                              >Evet, Sil</button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                disabled={clearing}
                                onClick={(e) => { e.stopPropagation(); setDeletingTable(null); }}
                              >Vazgeç</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-icon-text btn-sm btn-danger-soft"
                              style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, width: '100%', justifyContent: 'center' }}
                              onClick={(e) => { e.stopPropagation(); setDeletingTable(t.id); }}
                            >
                              <Trash2 size={12} /> Veriyi Temizle
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Column Mapping */}
      {step === 1 && uploadResult && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title">Kolon Eşleme</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                <strong style={{ color: 'var(--accent-red)' }}>{uploadResult.fileName}</strong> · {uploadResult.totalRows?.toLocaleString('tr-TR')} satır · {uploadResult.columns?.length} sütun
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setStep(0)}>
                <ArrowLeft size={14} /> Geri
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setStep(2)}>
                Devam <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="card-body">
            {/* Target table selector */}
            <div className="input-group" style={{ marginBottom: 24 }}>
              <label className="input-label">Hedef Tablo</label>
              <select className="select" value={selectedTable} onChange={e => setSelectedTable(e.target.value)} style={{ maxWidth: 400 }}>
                <option value="">Tablo seçin...</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </select>
              {uploadResult.detectedTable && (
                <p style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 6 }}>
                  ✓ Otomatik tespit: {uploadResult.detectedTable}
                </p>
              )}
            </div>

            {/* Data Preview */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Veri Önizleme (ilk 5 satır)</h4>
              <div className="data-table-container" style={{ maxHeight: 220, overflow: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <table className="data-table" style={{ minWidth: 'max-content' }}>
                  <thead>
                    <tr>{uploadResult.columns?.map((col, i) => <th key={i}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {uploadResult.sampleData?.map((row, i) => (
                      <tr key={i}>
                        {uploadResult.columns?.map((col, j) => (
                          <td key={j} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column Mapping */}
            {selectedTable && targetColumns.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Kolon Eşleme</h4>
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>Kaynak Sütun (Dosyadaki)</th>
                      <th style={{ width: 60 }}></th>
                      <th>Hedef Sütun (Veritabanı)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.columns?.map((srcCol, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--accent-red)', fontWeight: 500 }}>{srcCol}</td>
                        <td className="mapping-arrow"><ArrowRight size={16} /></td>
                        <td>
                          <select
                            className="select"
                            value={columnMapping[srcCol] || ''}
                            onChange={e => setColumnMapping(prev => ({ ...prev, [srcCol]: e.target.value }))}
                            style={{ padding: '6px 12px', fontSize: 13 }}
                          >
                            <option value="">— Atla —</option>
                            {targetColumns.map(tc => (
                              <option key={tc} value={tc}>{tc}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Confirm Import */}
      {step === 2 && uploadResult && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <div className="card-title">İçe Aktarma Onayı</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Dosya', value: uploadResult.fileName },
                { label: 'Hedef Tablo', value: selectedTable },
                { label: 'Toplam Satır', value: uploadResult.totalRows?.toLocaleString('tr-TR') },
              ].map((item, i) => (
                <div key={i} style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Mapped columns summary */}
            <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                Eşlenen Sütunlar: {Object.values(columnMapping).filter(v => v).length} / {uploadResult.columns?.length}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(columnMapping).filter(([, v]) => v).map(([src, tgt]) => (
                  <span key={src} className="badge badge-blue">{src} → {tgt}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> Geri
              </button>
              <button className="btn btn-primary" onClick={handleExecute} disabled={executing}>
                {executing ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2}} /> İçe Aktarılıyor...</> : <><Database size={16} /> İçe Aktar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && importResult && (
        <div className="card animate-scale-in">
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <CheckCircle size={64} style={{ color: 'var(--accent-green)', marginBottom: 16 }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>İçe Aktarma Tamamlandı!</h2>
            <div className="import-result">
              <div className="import-result-item success">
                <div className="import-result-value" style={{ color: 'var(--accent-green)' }}>{importResult.importedRows?.toLocaleString('tr-TR')}</div>
                <div className="import-result-label">Başarılı Satır</div>
              </div>
              <div className="import-result-item error">
                <div className="import-result-value" style={{ color: 'var(--accent-rose)' }}>{importResult.errorRows?.toLocaleString('tr-TR')}</div>
                <div className="import-result-label">Hatalı Satır</div>
              </div>
              <div className="import-result-item info">
                <div className="import-result-value" style={{ color: 'var(--accent-blue)' }}>{importResult.duplicateRows?.toLocaleString('tr-TR')}</div>
                <div className="import-result-label">Yinelenen Satır</div>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div style={{ textAlign: 'left', background: 'rgba(227,6,19,0.05)', border: '1px solid rgba(227,6,19,0.2)', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--accent-rose)' }}>Hata Detayları (ilk {Math.min(importResult.errors.length, 10)})</div>
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Satır {err.row}: <strong>{err.column}</strong> — {err.message}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button className="btn btn-primary" onClick={handleReset}>
                <Upload size={16} /> Yeni Dosya Yükle
              </button>
              <a href="/" className="btn btn-secondary">
                Dashboard'a Git →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Import History */}
      <div style={{ marginTop: 24 }}>
        <button
          className="btn btn-secondary"
          onClick={() => setHistoryOpen(!historyOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} /> Import Geçmişi ({history.length})
          </span>
          {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {historyOpen && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dosya</th>
                    <th>Tablo</th>
                    <th>Durum</th>
                    <th>Toplam</th>
                    <th>Aktarılan</th>
                    <th>Hata</th>
                    <th>Yineleme</th>
                    <th>Kullanıcı</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.file_name}</td>
                      <td><span className="badge badge-blue">{h.target_table}</span></td>
                      <td>
                        <span className={`badge ${h.status === 'completed' ? 'badge-green' : h.status === 'failed' ? 'badge-rose' : 'badge-amber'}`}>
                          {h.status}
                        </span>
                      </td>
                      <td>{h.total_rows?.toLocaleString('tr-TR')}</td>
                      <td style={{ color: 'var(--accent-green)' }}>{h.imported_rows?.toLocaleString('tr-TR')}</td>
                      <td style={{ color: h.error_rows > 0 ? 'var(--accent-rose)' : 'inherit' }}>{h.error_rows}</td>
                      <td>{h.duplicate_rows}</td>
                      <td>{h.user_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(h.created_at).toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Henüz import geçmişi yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
