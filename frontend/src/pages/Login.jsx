import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Lock, Mail, Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin@sporthink.com');
  const [password, setPassword] = useState('Admin2026!');
  const [loading, setLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSetup = async () => {
    try {
      await authAPI.setup();
      setSetupDone(true);
      toast.success('Admin hesabı kuruldu!');
    } catch (e) {
      if (e.response?.data?.error === 'Setup already completed') {
        setSetupDone(true);
        toast('Kurulum zaten tamamlanmış.', { icon: 'ℹ️' });
      } else {
        toast.error('Kurulum hatası: ' + (e.response?.data?.error || e.message));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Giriş başarılı!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-scale-in">
        <div className="login-logo">
          <img
            src="/sporthink-logo-disi.png"
            alt="Sporthink"
            className="full-logo"
          />
          <p>Pazarlama & E-Ticaret Analiz Paneli</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">E-posta</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                id="login-email"
                type="email"
                className="input"
                style={{ paddingLeft: 44 }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@sporthink.com"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Şifre</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                id="login-password"
                type="password"
                className="input"
                style={{ paddingLeft: 44 }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button id="login-submit" type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : <Zap size={18} />}
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={handleSetup}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 12, cursor: 'pointer', textDecoration: 'underline'
            }}
          >
            İlk kurulum? Tıklayın
          </button>
        </div>
      </div>
    </div>
  );
}
