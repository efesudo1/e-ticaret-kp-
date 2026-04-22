import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  UserPlus, Mail, Shield, Trash2, UserX, UserCheck, 
  Calendar, Clock, Search, Filter, X, Plus
} from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'viewer'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await authAPI.getUsers();
      setUsers(data.users);
    } catch (err) {
      toast.error('Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await authAPI.register(formData);
      toast.success('Kullanıcı başarıyla oluşturuldu');
      setShowModal(false);
      setFormData({ email: '', password: '', full_name: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kullanıcı oluşturulamadı');
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      await authAPI.updateUser(user.id, { is_active: !user.is_active });
      toast.success(`Kullanıcı ${user.is_active ? 'devre dışı bırakıldı' : 'etkinleştirildi'}`);
      fetchUsers();
    } catch (err) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
    try {
      await authAPI.deleteUser(id);
      toast.success('Kullanıcı silindi');
      fetchUsers();
    } catch (err) {
      toast.error('Kullanıcı silinemedi');
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleIcon = (role) => {
    switch(role) {
      case 'admin': return <Shield size={14} className="badge-rose" />;
      case 'marketing': return <Shield size={14} className="badge-blue" />;
      default: return <Shield size={14} className="badge-green" />;
    }
  };

  return (
    <div className="users-page animate-fade-in">
      {/* Top Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: 32, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input" 
            placeholder="Kullanıcı ara..." 
            style={{ paddingLeft: 44, width: '100%', background: 'transparent', border: 'none' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="badge badge-rose" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)' }}>
          {filteredUsers.length} Toplam Kullanıcı
        </div>
      </div>

      {loading ? (
        <div className="user-card-grid">
          {[1,2,3].map(i => <div key={i} className="glass-card" style={{ height: 280, opacity: 0.5 }}></div>)}
        </div>
      ) : (
        <div className="user-card-grid">
          {filteredUsers.map(user => (
            <div key={user.id} className="glass-card user-card animate-scale-in">
              <div className="user-card-header">
                <div className="glass-avatar">
                  {user.full_name.charAt(0)}
                </div>
                <div className="user-card-info">
                  <h3>{user.full_name}</h3>
                  <p>{user.email}</p>
                </div>
              </div>

              <div className="user-card-stats">
                <div className="stat-item">
                  <label>Rol</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getRoleIcon(user.role)}
                    <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
                  </div>
                </div>
                <div className="stat-item">
                  <label>Durum</label>
                  <span className={user.is_active ? 'badge-green' : 'badge-red'} style={{ background: 'none', padding: 0 }}>
                    {user.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="stat-item">
                  <label>Kayıt Tarihi</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <Calendar size={12} />
                    {new Date(user.created_at).toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <div className="stat-item">
                  <label>Son Giriş</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <Clock size={12} />
                    {user.last_login ? new Date(user.last_login).toLocaleDateString('tr-TR') : 'Hiç yok'}
                  </div>
                </div>
              </div>

              <div className="user-card-actions">
                <button 
                  className={`btn btn-sm ${user.is_active ? 'btn-secondary' : 'btn-success'}`}
                  onClick={() => toggleUserStatus(user)}
                >
                  {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                  {user.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                </button>
                <button 
                  className="btn btn-sm btn-icon btn-danger"
                  onClick={() => handleDeleteUser(user.id)}
                  title="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <div className="fab-container">
        <button className="fab" onClick={() => setShowModal(true)}>
          <Plus size={32} />
        </button>
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div className="glass-modal-overlay">
          <div className="glass-modal glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>Yeni Kullanıcı Ekle</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-icon btn-secondary">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="login-form">
              <div className="input-group">
                <label className="input-label">Ad Soyad</label>
                <input 
                  type="text" className="input" required
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  placeholder="Ahmet Yılmaz"
                />
              </div>

              <div className="input-group">
                <label className="input-label">E-Posta</label>
                <input 
                  type="email" className="input" required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="ahmet@sporthink.com"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Şifre</label>
                <input 
                  type="password" className="input" required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Rol</label>
                <select 
                  className="select"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="viewer">Viewer (Gözlemci)</option>
                  <option value="marketing">Marketing (Pazarlama)</option>
                  <option value="admin">Admin (Yönetici)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>
                <UserPlus size={18} />
                Kullanıcıyı Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
