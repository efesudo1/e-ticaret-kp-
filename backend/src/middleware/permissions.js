// Permission middleware'leri.
// authenticate'ten SONRA kullanılmalıdır (req.user.role ve req.user.permissions doluysa kullanır;
// boşsa DB'den çeker).

const db = require('../config/database');
const { hasPermission, getEffectivePermissions } = require('../lib/permissions');

async function loadFreshUser(userId) {
  const [rows] = await db.query(
    'SELECT id, email, full_name, role, permissions, is_active FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

/**
 * Belirli bir permission key'ini gerektirir.
 * Kullanım: app.use('/api/import', authenticate, requirePermission('import_data'), routes);
 */
function requirePermission(key) {
  return async (req, res, next) => {
    try {
      let user = req.user;
      // req.user authenticate'ten gelir; permissions yoksa DB'den taze çek
      if (!user || user.permissions === undefined) {
        user = await loadFreshUser(user?.id || user?.userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
      }
      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      if (!hasPermission(user, key)) {
        return res.status(403).json({ error: `Permission denied: ${key}` });
      }
      req.user = user;
      next();
    } catch (err) {
      console.error('requirePermission error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Permission middleware'i sadece "mutating" HTTP method'ları için uygular
 * (POST, PUT, PATCH, DELETE). GET her zaman geçer.
 * Read-only viewer'ların import sayfasını GÖRMESİNE izin verir ama yazmasına izin vermez.
 */
function requirePermissionForMutations(key) {
  const middleware = requirePermission(key);
  return (req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
    return middleware(req, res, next);
  };
}

module.exports = {
  requirePermission,
  requirePermissionForMutations,
};
