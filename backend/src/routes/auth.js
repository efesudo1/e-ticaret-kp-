const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getEffectivePermissions, sanitizePermissions } = require('../lib/permissions');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve parola zorunludur' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) {
      return res.status(401).json({ error: 'E-posta veya parola hatalı' });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesap devre dışı bırakılmış' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-posta veya parola hatalı' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: getEffectivePermissions(user),
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/register', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin kullanıcı oluşturabilir' });
    }

    const { email, password, full_name, role, permissions } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'E-posta, parola ve ad-soyad zorunludur' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Parola en az 6 karakter olmalı' });
    }

    const validRoles = ['admin', 'marketing', 'viewer'];
    const finalRole = role && validRoles.includes(role) ? role : 'viewer';

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const cleanPerms = sanitizePermissions(permissions);
    const permsJson = cleanPerms ? JSON.stringify(cleanPerms) : null;

    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, full_name, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [email, password_hash, full_name, finalRole, permsJson]
    );

    res.status(201).json({
      message: 'Kullanıcı oluşturuldu',
      userId: result.insertId,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, email, full_name, role, permissions, is_active FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: !!u.is_active,
        permissions: getEffectivePermissions(u),
      }
    });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Initial admin setup (one-time)
router.post('/setup', async (req, res) => {
  try {
    const [users] = await db.query('SELECT COUNT(*) as count FROM users WHERE password_hash != "$2b$10$placeholder"');
    if (users[0].count > 0) {
      return res.status(400).json({ error: 'Setup zaten tamamlanmış' });
    }
    const password_hash = await bcrypt.hash('Admin2026!', 10);
    await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [password_hash, 'admin@sporthink.com']);
    res.json({ message: 'Admin setup complete. Login: admin@sporthink.com / Admin2026!' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.get('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin görebilir' });
    }
    const [users] = await db.query(
      'SELECT id, email, full_name, role, permissions, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    // permissions'ı parse et
    const enriched = users.map(u => ({
      ...u,
      is_active: !!u.is_active,
      permissions_effective: getEffectivePermissions(u),
      permissions_custom: u.permissions
        ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions)
        : null,
    }));
    res.json({ users: enriched });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.patch('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin güncelleyebilir' });
    }
    const { id } = req.params;
    const { full_name, role, is_active, permissions, password } = req.body;

    const updates = [];
    const params = [];

    if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
    if (role !== undefined) {
      const validRoles = ['admin', 'marketing', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol' });
      }
      updates.push('role = ?'); params.push(role);
    }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (permissions !== undefined) {
      const cleanPerms = sanitizePermissions(permissions);
      updates.push('permissions = ?');
      params.push(cleanPerms ? JSON.stringify(cleanPerms) : null);
    }
    if (password !== undefined && password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Parola en az 6 karakter olmalı' });
      }
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?'); params.push(hash);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }
    params.push(id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Kullanıcı güncellendi' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sadece admin silebilir' });
    }
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    }
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Kullanıcı silindi' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

/**
 * Kullanıcının kendi parolasını değiştirmesi.
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut ve yeni parola zorunlu' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Yeni parola en az 6 karakter olmalı' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Yeni parola mevcut paroladan farklı olmalı' });
    }

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Mevcut parola hatalı' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ message: 'Parola güncellendi' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
