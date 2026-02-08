import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Plus, Trash2, Shield, User, Key } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'funcionario'
  });

  // Carregar usuários
  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsers(list);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Criar usuário
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Criar no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // 2. Salvar perfil no Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        createdAt: new Date()
      });

      alert('Usuário criado com sucesso!');
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'funcionario' });
      fetchUsers();
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        alert('Este email já está em uso');
      } else {
        alert('Erro ao criar usuário: ' + error.message);
      }
    }

    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      await deleteDoc(doc(db, "users", id));
      fetchUsers();
    }
  };

  const getRoleLabel = (role) => {
    const roles = {
      admin: 'Administrador',
      gerente: 'Gerente',
      funcionario: 'Funcionário'
    };
    return roles[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'text-red-400 bg-red-900/20 border-red-500/30',
      gerente: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30',
      funcionario: 'text-blue-400 bg-blue-900/20 border-blue-500/30'
    };
    return colors[role] || 'text-gray-400';
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white">Usuários do Sistema</h2>
          <p className="text-gray-400 mt-1">Gerencie acessos e permissões</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#850000] hover:bg-red-700 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all"
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      {/* Lista de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.id} className="bg-[#29292e] border border-[#323238] rounded-2xl p-6 hover:border-[#850000]/30 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#323238] flex items-center justify-center">
                {user.role === 'admin' ? <Shield className="text-red-400" size={24} /> : <User className="text-gray-400" size={24} />}
              </div>
              <button 
                onClick={() => handleDelete(user.id)}
                className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-1">{user.name}</h3>
            <p className="text-gray-400 text-sm mb-4">{user.email}</p>
            
            <div className={`inline-block px-3 py-1 rounded-lg text-xs font-medium border ${getRoleColor(user.role)}`}>
              {getRoleLabel(user.role)}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-8 w-full max-w-lg">
            <h3 className="text-2xl font-bold text-white mb-6">Novo Usuário</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome Completo</label>
                <input 
                  type="text"
                  className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] focus:outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input 
                  type="email"
                  className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] focus:outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="usuario@ebony.com"
                  required 
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Senha</label>
                <input 
                  type="password"
                  className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] focus:outline-none"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Mínimo 6 caracteres"
                  minLength="6"
                  required 
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Nível de Acesso</label>
                <select 
                  className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] outline-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="funcionario">Funcionário</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-[#323238] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-[#850000] hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Users;