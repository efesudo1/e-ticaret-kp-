import { Component } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container animate-fade-in">
          <div className="card">
            <div className="card-body" style={{ padding: 40, textAlign: 'center' }}>
              <AlertTriangle size={48} style={{ color: 'var(--accent-red)', marginBottom: 12 }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                Bu sayfada bir sorun oluştu
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Sayfa yüklenirken beklenmeyen bir hata oldu. Aşağıdaki teknik detayı yöneticinizle paylaşabilirsiniz.
              </div>
              <details style={{
                textAlign: 'left',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 20,
                fontFamily: 'ui-monospace, monospace',
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--accent-red)' }}>
                  Teknik detay (tıkla)
                </summary>
                <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <strong>Mesaj:</strong> {this.state.error?.message || 'bilinmeyen'}{'\n'}
                  <strong>Stack:</strong>{'\n'}{this.state.error?.stack?.split('\n').slice(0, 5).join('\n') || ''}
                </div>
              </details>
              <button
                className="btn-primary-mini"
                onClick={() => { this.setState({ hasError: false, error: null, info: null }); window.location.reload(); }}
              >
                <RotateCw size={14} /> Sayfayı Yenile
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
