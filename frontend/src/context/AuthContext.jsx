import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../lib/permissions';

const AuthContext = createContext(null);

// Kullanıcı login response'unda permissions yoksa rol bazlı default uygula
function ensurePermissions(user) {
  if (!user) return user;
  if (user.permissions && typeof user.permissions === 'object') return user;
  return { ...user, permissions: DEFAULT_PERMISSIONS_BY_ROLE[user.role] || DEFAULT_PERMISSIONS_BY_ROLE.viewer };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kpi_token');
    const savedUser = localStorage.getItem('kpi_user');
    if (token && savedUser) {
      try {
        const u = ensurePermissions(JSON.parse(savedUser));
        setUser(u);
        // /me ile sunucudan taze permissions çek (custom permissions değişmiş olabilir)
        authAPI.me()
          .then(({ data }) => {
            const fresh = ensurePermissions(data.user);
            localStorage.setItem('kpi_user', JSON.stringify(fresh));
            setUser(fresh);
          })
          .catch(() => { /* token expired vs. — interceptor logout yapar */ });
      } catch {
        localStorage.removeItem('kpi_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    const u = ensurePermissions(data.user);
    localStorage.setItem('kpi_token', data.token);
    localStorage.setItem('kpi_user', JSON.stringify(u));
    setUser(u);
    return { ...data, user: u };
  };

  const logout = () => {
    localStorage.removeItem('kpi_token');
    localStorage.removeItem('kpi_user');
    setUser(null);
  };

  // Profile değişikliğinden sonra context'i güncelle
  const refreshUser = async () => {
    try {
      const { data } = await authAPI.me();
      const fresh = ensurePermissions(data.user);
      localStorage.setItem('kpi_user', JSON.stringify(fresh));
      setUser(fresh);
      return fresh;
    } catch (err) {
      console.error('refreshUser error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
