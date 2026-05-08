// Permission tanımları + sayfa eşleşmeleri.
// Backend ile aynı (backend/src/lib/permissions.js).

import {
  LayoutDashboard, Megaphone, Package, PieChart, FileText,
  Upload, Users, Download, MessageCircle, Target,
} from 'lucide-react';

// Sidebar / route ile eşleşen permission'lar.
// Bu liste hem sidebar filtreleme hem route guard hem de Users sayfasındaki checkbox grid için kullanılır.
export const PAGE_PERMISSIONS = [
  { key: 'view_overview',  path: '/',           icon: LayoutDashboard, label: 'Genel Bakış',         group: 'Görüntüleme' },
  { key: 'view_campaigns', path: '/campaigns',  icon: Megaphone,       label: 'Kampanyalar',         group: 'Görüntüleme' },
  { key: 'view_products',  path: '/products',   icon: Package,         label: 'Ürünler',             group: 'Görüntüleme' },
  { key: 'view_platforms', path: '/platforms',  icon: PieChart,        label: 'Platformlar',         group: 'Görüntüleme' },
  { key: 'view_reports',   path: '/reports',    icon: FileText,        label: 'Raporlar',            group: 'Görüntüleme' },
  { key: 'view_decision_center', path: '/decision', icon: Target,      label: 'Karar Merkezi',       group: 'Görüntüleme' },
  { key: 'export_excel',   path: null,          icon: Download,        label: 'Excel İndirme',       group: 'Aksiyon' },
  { key: 'import_data',    path: '/import',     icon: Upload,          label: 'Veri Import',         group: 'Aksiyon' },
  { key: 'manage_users',   path: '/users',      icon: Users,           label: 'Kullanıcı Yönetimi',  group: 'Yönetim' },
  { key: 'use_chatbot',    path: null,          icon: MessageCircle,   label: 'AI Asistan (Chatbot)', group: 'Aksiyon' },
];

export const PERMISSION_KEYS = PAGE_PERMISSIONS.map(p => p.key);

export const DEFAULT_PERMISSIONS_BY_ROLE = {
  admin: {
    view_overview: true, view_campaigns: true, view_products: true,
    view_platforms: true, view_reports: true,
    export_excel: true, import_data: true, manage_users: true, use_chatbot: true, view_decision_center: true,
  },
  marketing: {
    view_overview: true, view_campaigns: true, view_products: true,
    view_platforms: true, view_reports: true,
    export_excel: true, import_data: true, manage_users: false, use_chatbot: true, view_decision_center: true,
  },
  viewer: {
    view_overview: true, view_campaigns: true, view_products: true,
    view_platforms: true, view_reports: true,
    export_excel: false, import_data: false, manage_users: false, use_chatbot: true, view_decision_center: true,
  },
};

export function hasPermission(user, key) {
  if (!user || !user.permissions) return false;
  return user.permissions[key] === true;
}

export function pageForPath(pathname) {
  return PAGE_PERMISSIONS.find(p => p.path === pathname);
}
