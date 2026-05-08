// Permission tanımları + rol bazlı varsayılanlar.
// Frontend ile aynı listeyi paylaşır (kopya: frontend/src/lib/permissions.js).

const PERMISSION_KEYS = [
  // Görüntüleme
  'view_overview',
  'view_campaigns',
  'view_products',
  'view_platforms',
  'view_reports',
  // Aksiyon
  'export_excel',
  'import_data',
  'manage_users',
  'use_chatbot',
];

// Rol bazlı varsayılanlar — kullanıcının permissions kolonu NULL ise bunlar uygulanır.
const DEFAULT_PERMISSIONS_BY_ROLE = {
  admin: {
    view_overview: true,
    view_campaigns: true,
    view_products: true,
    view_platforms: true,
    view_reports: true,
    export_excel: true,
    import_data: true,
    manage_users: true,
    use_chatbot: true,
  },
  marketing: {
    view_overview: true,
    view_campaigns: true,
    view_products: true,
    view_platforms: true,
    view_reports: true,
    export_excel: true,
    import_data: true,
    manage_users: false,
    use_chatbot: true,
  },
  viewer: {
    view_overview: true,
    view_campaigns: true,
    view_products: true,
    view_platforms: true,
    view_reports: true,
    export_excel: false,
    import_data: false,
    manage_users: false,
    use_chatbot: true,
  },
};

/**
 * Kullanıcının efektif permission'larını döndürür.
 * Kullanıcı `permissions` kolonu doldurulmuşsa override; aksi halde rol bazlı default.
 */
function getEffectivePermissions(user) {
  const defaults = DEFAULT_PERMISSIONS_BY_ROLE[user.role] || DEFAULT_PERMISSIONS_BY_ROLE.viewer;
  if (!user.permissions) return { ...defaults };

  let custom = user.permissions;
  if (typeof custom === 'string') {
    try { custom = JSON.parse(custom); } catch { custom = {}; }
  }
  // Default + custom override (custom her zaman kazanır, eksik anahtarlar default'tan gelir)
  return { ...defaults, ...custom };
}

function hasPermission(user, key) {
  const perms = getEffectivePermissions(user);
  return perms[key] === true;
}

/**
 * Sadece bilinen permission key'lerini al, diğerlerini at.
 */
function sanitizePermissions(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const k of PERMISSION_KEYS) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  return Object.keys(out).length ? out : null;
}

module.exports = {
  PERMISSION_KEYS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  getEffectivePermissions,
  hasPermission,
  sanitizePermissions,
};
