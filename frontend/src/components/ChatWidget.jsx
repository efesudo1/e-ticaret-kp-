import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Trash2 } from 'lucide-react';
import { chatAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../lib/permissions';

const SUGGESTIONS = [
  'Mart 2025 en çok kazandıran 3 kampanya?',
  'Asics markasının en çok satan 5 ürünü?',
  'Meta vs Google ROAS karşılaştırması',
  'SP_Meta_DPA_Genel kampanyasında satılan ürünler',
];

const STORAGE_KEY = 'kpi_chat_history';

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch { /* localStorage dolu olabilir, sessizce yut */ }
}

// Çok basit markdown render: **kalın** + satır sonları
function renderMarkdown(text) {
  const parts = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const segments = [];
    let lastIdx = 0;
    const regex = /\*\*(.+?)\*\*/g;
    let m;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > lastIdx) segments.push(line.slice(lastIdx, m.index));
      segments.push(<strong key={`s${i}-${m.index}`}>{m[1]}</strong>);
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < line.length) segments.push(line.slice(lastIdx));
    parts.push(<span key={i}>{segments}</span>);
    if (i < lines.length - 1) parts.push(<br key={`br${i}`} />);
  });
  return parts;
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Permission yoksa hiç render etme
  const canUse = user && hasPermission(user, 'use_chatbot');

  useEffect(() => {
    saveHistory(messages);
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const send = async (text) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;
    setInput('');
    const newUserMsg = { role: 'user', content: messageText, ts: Date.now() };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);
    try {
      const historyForApi = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const { data } = await chatAPI.ask(messageText, historyForApi);
      setMessages(prev => [...prev, { role: 'model', content: data.reply, ts: Date.now() }]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Hata oluştu';
      setMessages(prev => [...prev, { role: 'model', content: `❌ ${errorMsg}`, ts: Date.now(), isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Tüm sohbet geçmişini silmek istiyor musun?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!canUse) return null;

  return (
    <>
      <button
        type="button"
        className={`chat-fab ${open ? 'chat-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={open ? 'Sohbeti kapat' : 'AI Asistan'}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="chat-avatar"><Sparkles size={16} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>AI Asistan</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gemini 2.5 Flash</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-icon-mini" onClick={clearHistory} title="Sohbeti temizle">
                <Trash2 size={14} />
              </button>
              <button className="btn-icon-mini" onClick={() => setOpen(false)} title="Kapat">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="chat-body">
            {messages.length === 0 && (
              <div className="chat-empty">
                <Sparkles size={28} style={{ color: 'var(--accent-red)', marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  Merhaba {user?.full_name?.split(' ')[0] || 'yönetici'}!
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  Kampanya, ürün, satış verileri hakkında soru sor. Aşağıdaki örneklerden başlayabilirsin:
                </div>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="chat-suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} className={`chat-message chat-message-${m.role} ${m.isError ? 'chat-message-error' : ''}`}>
                <div className="chat-message-content">
                  {renderMarkdown(m.content)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message chat-message-model">
                <div className="chat-message-content">
                  <span className="chat-typing"><span></span><span></span><span></span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Bir şey sor..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              maxLength={2000}
            />
            <button type="submit" className="chat-send" disabled={loading || !input.trim()} title="Gönder">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
