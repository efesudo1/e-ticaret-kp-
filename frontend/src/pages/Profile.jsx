import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, Mail, Shield, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { PAGE_PERMISSIONS } from '../lib/permissions';

export default function Profile() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Yeni parolalar eşleşmiyor');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Yeni parola en az 6 karakter olmalı');
      return;
    }
    setSubmitting(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      toast.success('Parola başarıyla değiştirildi');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Parola değiştirilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: 800 }}>
      {/* Profil bilgileri */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} /> Profilim
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Ad Soyad</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{user.full_name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                <Mail size={11} style={{ display: 'inline', marginRight: 4 }} />E-posta
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{user.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                <Shield size={11} style={{ display: 'inline', marginRight: 4 }} />Rol
              </div>
              <span style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                background: user.role === 'admin' ? 'rgba(227,6,19,.15)' : user.role === 'marketing' ? 'rgba(59,130,246,.15)' : 'rgba(34,197,94,.15)',
                color:      user.role === 'admin' ? 'var(--accent-red)' : user.role === 'marketing' ? 'var(--accent-blue)' : 'var(--accent-green)',
              }}>{user.role}</span>
            </div>
          </div>

          {/* Aktif izinler özet */}
          <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Hesap İzinlerim
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {PAGE_PERMISSIONS.map(p => {
                const allowed = user.permissions?.[p.key];
                const Icon = p.icon;
                return (
                  <div key={p.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    fontSize: 12, color: allowed ? 'var(--text-primary)' : 'var(--text-muted)',
                    opacity: allowed ? 1 : 0.5,
                  }}>
                    <Icon size={13} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <span style={{ color: allowed ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {allowed ? '✓' : '✕'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Parola değiştir */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} /> Parolayı Değiştir
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Mevcut Parola</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showCurrent ? 'text' : 'password'} required
                       value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                       placeholder="••••••••" />
                <button type="button" onClick={() => setShowCurrent(s => !s)}
                        style={{ position: 'absolute', right: 10, top: 9, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Yeni Parola (en az 6 karakter)</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showNew ? 'text' : 'password'} required minLength={6}
                       value={newPassword} onChange={e => setNewPassword(e.target.value)}
                       placeholder="Yeni parola" />
                <button type="button" onClick={() => setShowNew(s => !s)}
                        style={{ position: 'absolute', right: 10, top: 9, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Yeni Parolayı Tekrar Yaz</label>
              <input className="form-input" type={showNew ? 'text' : 'password'} required minLength={6}
                     value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                     placeholder="Yeni parolayı tekrar gir" />
            </div>
          </div>
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button type="submit" className="btn-primary-mini" disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : 'Parolayı Değiştir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
