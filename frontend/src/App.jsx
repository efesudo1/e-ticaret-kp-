import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FilterProvider } from './context/FilterContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Import from './pages/Import';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Overview from './pages/Overview';
import CampaignsOverview from './pages/CampaignsOverview';
import ProductsOverview from './pages/ProductsOverview';
import PlatformsOverview from './pages/PlatformsOverview';
import Reports from './pages/Reports';
import DecisionCenter from './pages/DecisionCenter';
import { hasPermission, PAGE_PERMISSIONS } from './lib/permissions';
import { ShieldOff } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Permission tabanlı route guard.
// Kullanıcının belirli bir sayfaya erişimi yoksa 403 ekranı gösterir.
function PermissionRoute({ permKey, children }) {
  const { user } = useAuth();
  if (!hasPermission(user, permKey)) return <ForbiddenPage />;
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function ForbiddenPage() {
  const { user } = useAuth();
  const location = useLocation();
  // Erişebileceği ilk sayfayı bul
  const fallback = PAGE_PERMISSIONS.find(p => p.path && hasPermission(user, p.key))?.path;

  return (
    <div className="page-container animate-fade-in">
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '60px 30px' }}>
          <ShieldOff size={48} style={{ color: 'var(--accent-red)', marginBottom: 16 }} />
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Erişim Yetkiniz Yok</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
            Bu sayfaya ({location.pathname}) erişim için gerekli yetkiniz yok.
            Yöneticinizle iletişime geçin.
          </div>
          {fallback && (
            <a href={fallback} className="btn-primary-mini" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Ana Sayfaya Dön
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <FilterProvider>
            <Layout />
          </FilterProvider>
        </ProtectedRoute>
      }>
        {/* Profile sayfası — herkes erişebilir (kendi profili) */}
        <Route path="profile" element={<Profile />} />

        {/* Permission'a bağlı sayfalar */}
        <Route index element={
          <PermissionRoute permKey="view_overview"><Overview /></PermissionRoute>
        } />
        <Route path="campaigns" element={
          <PermissionRoute permKey="view_campaigns"><CampaignsOverview /></PermissionRoute>
        } />
        <Route path="products" element={
          <PermissionRoute permKey="view_products"><ProductsOverview /></PermissionRoute>
        } />
        <Route path="platforms" element={
          <PermissionRoute permKey="view_platforms"><PlatformsOverview /></PermissionRoute>
        } />
        <Route path="reports" element={
          <PermissionRoute permKey="view_reports"><Reports /></PermissionRoute>
        } />
        <Route path="decision" element={
          <PermissionRoute permKey="view_decision_center"><DecisionCenter /></PermissionRoute>
        } />
        <Route path="import" element={
          <PermissionRoute permKey="import_data"><Import /></PermissionRoute>
        } />
        <Route path="users" element={
          <PermissionRoute permKey="manage_users"><Users /></PermissionRoute>
        } />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-custom',
            style: {
              background: '#141416',
              color: '#f5f5f5',
              border: '1px solid rgba(227,6,19,0.15)',
              fontFamily: 'Futura PT, sans-serif',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
