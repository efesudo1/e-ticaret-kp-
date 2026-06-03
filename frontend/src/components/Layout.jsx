import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { PAGE_PERMISSIONS, hasPermission } from '../lib/permissions';
import ChatWidget from './ChatWidget';

const SIDEBAR_ORDER = [
  { type: 'item',    permKey: 'view_overview' },
  { type: 'item',    permKey: 'view_campaigns' },
  { type: 'item',    permKey: 'view_products' },
  { type: 'item',    permKey: 'view_platforms' },
  { type: 'item',    permKey: 'view_reports' },
  { type: 'item',    permKey: 'view_decision_center' },
  { type: 'section', label: 'SİSTEM',
    visibleIf: (user) => hasPermission(user, 'import_data') || hasPermission(user, 'manage_users') },
  { type: 'item',    permKey: 'import_data' },
  { type: 'item',    permKey: 'manage_users' },
];

export default function Layout() {
  // Desktop sidebar daraltma (collapse) — kullanıcı tercihi
  const [collapsed, setCollapsed] = useState(false);
  // Mobile sidebar drawer açık mı (overlay olarak slide-in)
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Sayfa değişince mobile drawer'ı kapat
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Mobile drawer açıkken arka plan scroll'unu kilitle
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const getPageTitle = () => {
    if (location.pathname === '/profile') return 'Profilim';
    const page = PAGE_PERMISSIONS.find(p => p.path === location.pathname);
    return page?.label || 'Genel Bakış';
  };

  const renderNav = () => {
    const elements = [];
    SIDEBAR_ORDER.forEach((entry, idx) => {
      if (entry.type === 'section') {
        if (!entry.visibleIf || entry.visibleIf(user)) {
          elements.push(
            !collapsed ? (
              <div key={`s${idx}`} className="nav-section-title">{entry.label}</div>
            ) : <div key={`s${idx}`} style={{ height: 16 }} />
          );
        }
      } else {
        const page = PAGE_PERMISSIONS.find(p => p.key === entry.permKey);
        if (!page || !page.path) return;
        if (!hasPermission(user, page.key)) return;
        const Icon = page.icon;
        elements.push(
          <NavLink
            key={page.key}
            to={page.path}
            end={page.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
            {!collapsed && <span>{page.label}</span>}
          </NavLink>
        );
      }
    });
    return elements;
  };

  return (
    <div className="app-layout">
      {/* Mobile overlay (sidebar arkasında karartma) */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          {collapsed ? (
            <img src="/sporthink-icon.svg" alt="Sporthink" />
          ) : (
            <img src="/sporthink-logo-disi.png" alt="Sporthink" className="full-logo" />
          )}
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {renderNav()}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      <div className={`app-content ${collapsed ? 'collapsed' : ''}`}>
        <header className={`header ${collapsed ? 'collapsed' : ''}`}>
          <button
            type="button"
            className="header-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Menüyü aç"
          >
            <Menu size={22} />
          </button>
          <h2 className="header-title">{getPageTitle()}</h2>
          <div className="header-actions">
            <div
              className="header-user"
              onClick={() => navigate('/profile')}
              style={{ cursor: 'pointer' }}
              title="Profilim — şifre değiştir, izinleri gör"
            >
              <div className="header-user-avatar">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="header-user-meta">
                <div style={{ fontWeight: 600 }}>{user?.full_name || 'User'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{user?.role || 'viewer'}</div>
              </div>
            </div>
            <button className="btn btn-icon btn-secondary" onClick={logout} title="Çıkış Yap">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
