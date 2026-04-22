const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Audit log omitted (table doesn't exist currently)

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
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user (admin only)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/register', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can register users' });
    }

    const { email, password, full_name, role } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full_name are required' });
    }

    const validRoles = ['admin', 'marketing', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [email, password_hash, full_name, role || 'viewer']
    );

    res.status(201).json({
      message: 'User created successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/**
 * @swagger
 * /api/auth/setup:
 *   post:
 *     summary: Initial admin setup (one-time)
 *     tags: [Auth]
 */
router.post('/setup', async (req, res) => {
  try {
    const [users] = await db.query('SELECT COUNT(*) as count FROM users WHERE password_hash != "$2b$10$placeholder"');
    if (users[0].count > 0) {
      return res.status(400).json({ error: 'Setup already completed' });
    }

    const password_hash = await bcrypt.hash('Admin2026!', 10);
    await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [password_hash, 'admin@sporthink.com']);

    res.json({ message: 'Admin user setup complete. Login with admin@sporthink.com / Admin2026!' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can list users' });
    }

    const [users] = await db.query(
      'SELECT id, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}:
 *   patch:
 *     summary: Update user (admin only)
 *     tags: [Auth]
 */
router.patch('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update users' });
    }

    const { id } = req.params;
    const { full_name, role, is_active } = req.body;

    // Don't allow changing own role to something else if you are the only admin
    // (Omitted for simplicity, but good practice)

    await db.query(
      'UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), is_active = COALESCE(?, is_active) WHERE id = ?',
      [full_name, role, is_active, id]
    );

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Delete user (admin only)
 *     tags: [Auth]
 */
router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    const { id } = req.params;
    
    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
