const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const ChatService = require('../services/chatService');

const router = express.Router();

// Singleton (her istek için yeni client kurmayalım)
let chatService = null;
const getChatService = () => {
  if (!chatService) {
    try { chatService = new ChatService(); }
    catch (err) { console.error('ChatService init error:', err.message); }
  }
  return chatService;
};

router.post('/', authenticate, requirePermission('use_chatbot'), async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Boş mesaj' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Mesaj çok uzun (max 2000 karakter)' });
    }
    const svc = getChatService();
    if (!svc) {
      return res.status(503).json({ error: 'Chatbot servisi yapılandırılmamış (GEMINI_API_KEY eksik)' });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
    const result = await svc.ask(message.trim(), safeHistory);
    res.json(result);
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası' });
  }
});

module.exports = router;
