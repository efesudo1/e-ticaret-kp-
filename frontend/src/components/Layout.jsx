import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import {
  LayoutDashboard, BarChart3, TrendingUp, ShoppingCart,
  Package, Megaphone, Upload, ChevronLeft, ChevronRight,
  LogOut, User, Filter, X, Search, Users, Briefcase,
  DollarSign, UserCheck, PieChart
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/executive', icon: Briefcase, label: 'Yönetici Özeti' },
  { section: 'ANALİZ' },
  { path: '/traffic', icon: BarChart3, label: 'Trafik Analizi' },
  { path: '/ads', icon: TrendingUp, label: 'Reklam Performansı' },
  { path: '/sales', icon: ShoppingCart, label: 'Satış Analizi' },
  { path: '/profitability', icon: DollarSign, label: 'Kârlılık Analizi' },
  { path: '/products', icon: Package, label: 'Ürün Performansı' },
  { path: '/campaigns', icon: Megaphone, label: 'Kampanyalar' },
  { path: '/customers', icon: UserCheck, label: 'Müşteri Analizi' },
  { section: 'SİSTEM' },
  { path: '/import', icon: Upload, label: 'Veri Import' },
  { path: '/users', icon: Users, label: 'Kullanıcı Yönetimi', adminOnly: true },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const metricTitles = {
    sessions: 'Oturum Analizi',
    users: 'Kullanıcı Analizi',
    orders: 'Sipariş Analizi',
    revenue: 'Gelir Analizi',
    adspend: 'Reklam Harcama Analizi',
    roas: 'ROAS Analizi',
    conversion: 'Dönüşüm Analizi',
    aov: 'Ort. Sipariş Değeri Analizi',
  };

  const getPageTitle = () => {
    const titles = {
      '/': 'Dashboard',
      '/executive': 'Yönetici Özeti',
      '/traffic': 'Trafik Analizi',
      '/ads': 'Reklam Performansı',
      '/sales': 'Satış Analizi',
      '/profitability': 'Kârlılık Analizi',
      '/products': 'Ürün Performansı',
      '/campaigns': 'Kampanyalar',
      '/customers': 'Müşteri Analizi',
      '/import': 'Veri Import',
      '/users': 'Kullanıcı Yönetimi'
    };
    // Handle dynamic analytics routes
    if (location.pathname.startsWith('/analytics/')) {
      const metricType = location.pathname.split('/analytics/')[1];
      return metricTitles[metricType] || 'Metrik Detayı';
    }
    return titles[location.pathname] || 'Dashboard';
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          {collapsed ? (
            <img src="/sporthink-icon.svg" alt="Sporthink" />
          ) : (
            <img src="/sporthink-logo-disi.png" alt="Sporthink" className="full-logo" />
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            if (item.section) {
              return !collapsed ? (
                <div key={i} className="nav-section-title">{item.section}</div>
              ) : <div key={i} style={{ height: 16 }} />;
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`app-content ${collapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <header className={`header ${collapsed ? 'collapsed' : ''}`}>
          <h2 className="header-title">{getPageTitle()}</h2>
          <div className="header-actions">
            <div 
              className="header-user" 
              onClick={() => user?.role === 'admin' && navigate('/users')}
              style={{ cursor: user?.role === 'admin' ? 'pointer' : 'default' }}
              title={user?.role === 'admin' ? "Kullanıcı Yönetimine Git" : ""}
            >
              <div className="header-user-avatar">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{user?.full_name || 'User'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{user?.role || 'viewer'}</div>
              </div>
            </div>
            <button className="btn btn-icon btn-secondary" onClick={logout} title="Çıkış Yap">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
