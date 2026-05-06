import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  UserPlus, Trash2, UserX, UserCheck, Calendar, Clock, Search, X, Plus,
  Edit3, Shield, Settings,
} from 'lucide-react';
import { authAPI } from '../services/api';
import { PAGE_PERMISSIONS, DEFAULT_PERMISSIONS_BY_ROLE } from '../lib/permissions';

const ROLES = [
  { key: 'viewer',    label: 'Viewer (Sadece İzleyici)',    desc: 'Tüm panelleri görür, indirme/import yapamaz' },
  { key: 'marketing', label: 'Marketing (Pazarlama)',       desc: 'Veri görür, indirir, import yapabilir' },
  { key: 'admin',     label: 'Admin (Yönetici)',            desc: 'Tüm yetkilere sahiptir, kullanıcı yönetir' },
];

const initialFormData = (role = 'viewer', customPermissions = null) => ({
  email: '', password: '', full_name: '', role,
  permissions: customPermissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
});

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(initialFormData());

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await authAPI.getUsers();
      setUsers(data.users);
    } catch {
      toast.error('Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData(initialFormData());
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions_effective || { ...DEFAULT_PERMISSIONS_BY_ROLE[user.role] },
    });
    setShowModal(true);
  };

  const handleRoleChange = (newRole) => {
    // Rol değişince izinleri o rolün default'una sıfırla (kullanıcı yine elle değiştirebilir)
    setFormData(f => ({
      ...f,
      role: newRole,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[newRole] },
    }));
  };

  const togglePermission = (key) => {
    setFormData(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = {
          full_name: formData.full_name,
          role: formData.role,
          permissions: formData.permissions,
        };
        if (formData.password) payload.password = formData.password;
        await authAPI.updateUser(editingUser.id, payload);
        toast.success('Kullanıcı güncellendi');
      } else {
        await authAPI.register(formData);
        toast.success('Kullanıcı oluşturuldu');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız');
    }
  };

  const toggleActive = async (user) => {
    try {
      await authAPI.updateUser(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? 'Kullanıcı pasif edildi' : 'Kullanıcı aktif edildi');
      fetchUsers();
    } catch {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    try {
      await authAPI.deleteUser(id);
      toast.success('Kullanıcı silindi');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Silinemedi');
    }
  };

  const filtered = useMemo(() => users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ), [users, search]);

  const groupedPerms = useMemo(() => {
    const groups = {};
    for (const p of PAGE_PERMISSIONS) {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    }
    return groups;
  }, []);

  return (
    <div className="page-container animate-fade-in">
      {/* Üst arama */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text" placeholder="Kullanıcı ara (ad / e-posta)..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 40px',
                background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontFamily: 'inherit', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} kullanıcı</span>
          <button className="btn-excel-mini" style={{ background: 'rgba(227,6,19,.12)', color: 'var(--accent-red)', borderColor: 'rgba(227,6,19,.3)' }} onClick={openCreate}>
            <Plus size={13} /> Yeni Kullanıcı
          </button>
        </div>
      </div>

      {/* Kullanıcı tablosu */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Son Giriş</th>
                  <th>Kayıt</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Yükleniyor...</td></tr>
                ) : filtered.length ? filtered.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        background: u.role === 'admin' ? 'rgba(227,6,19,.15)' : u.role === 'marketing' ? 'rgba(59,130,246,.15)' : 'rgba(34,197,94,.15)',
                        color:      u.role === 'admin' ? 'var(--accent-red)' : u.role === 'marketing' ? 'var(--accent-blue)' : 'var(--accent-green)',
                      }}>{u.role}</span>
                    </td>
                    <td>
                      <span style={{ color: u.is_active ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                        {u.is_active ? '● Aktif' : '○ Pasif'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                      {new Date(u.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-icon-mini" onClick={() => openEdit(u)} title="Düzenle"><Edit3 size={14} /></button>
                      <button className="btn-icon-mini" onClick={() => toggleActive(u)} title={u.is_active ? 'Pasif yap' : 'Aktif yap'}>
                        {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button className="btn-icon-mini btn-icon-danger" onClick={() => handleDelete(u.id)} title="Sil"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Kullanıcı bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="modal-title">
                <UserPlus size={20} />
                {editingUser ? `Düzenle: ${editingUser.full_name}` : 'Yeni Kullanıcı Ekle'}
              </div>
              <button className="btn-icon-mini" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="form-label">Ad Soyad</label>
                    <input className="form-input" required placeholder="Ahmet Yılmaz"
                           value={formData.full_name}
                           onChange={e => setFormData(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">E-Posta</label>
                    <input className="form-input" type="email" required placeholder="ornek@firma.com"
                           value={formData.email}
                           disabled={!!editingUser}
                           onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <label className="form-label">{editingUser ? 'Yeni Parola (boş bırak: değişmesin)' : 'Parola (en az 6 karakter)'}</label>
                  <input className="form-input" type="password" required={!editingUser} minLength={6} placeholder="••••••••"
                         value={formData.password}
                         onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} />
                </div>

                {/* Rol kartları */}
                <div style={{ marginTop: 18 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={13} /> Rol
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 6 }}>
                    {ROLES.map(r => (
                      <label key={r.key} className={`role-card ${formData.role === r.key ? 'role-card-active' : ''}`}>
                        <input type="radio" name="role" value={r.key} checked={formData.role === r.key}
                               onChange={() => handleRoleChange(r.key)} style={{ display: 'none' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{r.desc}</div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Permission grid */}
                <div style={{ marginTop: 18 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Settings size={13} /> Detaylı İzinler
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>
                      Rol seçimi default izinleri uygular; tek tek özelleştirebilirsin.
                    </span>
                  </label>
                  <div style={{ marginTop: 6, padding: 14, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    {Object.entries(groupedPerms).map(([group, items]) => (
                      <div key={group} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
                          {group}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                          {items.map(p => {
                            const Icon = p.icon;
                            return (
                              <label key={p.key}
                                     className={`permission-toggle ${formData.permissions[p.key] ? 'permission-on' : ''}`}>
                                <input type="checkbox" checked={!!formData.permissions[p.key]}
                                       onChange={() => togglePermission(p.key)} style={{ display: 'none' }} />
                                <Icon size={14} />
                                <span style={{ flex: 1 }}>{p.label}</span>
                                <span className="permission-status">
                                  {formData.permissions[p.key] ? '✓' : '✕'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary-mini" onClick={() => setShowModal(false)}>Vazgeç</button>
                <button type="submit" className="btn-primary-mini">
                  {editingUser ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
