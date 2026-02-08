import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, Settings, Shield, LogOut, BarChart3 } from 'lucide-react';
import { Calendar, Users } from 'lucide-react';

const MainLayout = ({ children }) => {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    if (confirm('Deseja sair do sistema?')) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="flex min-h-screen bg-ebony-900 text-ice-200 font-sans">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-ebony-800 border-r border-ebony-700 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            CT <span className="text-brand-red">Coliseum</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/employees" icon={<Users size={20} />} label="Funcionários" active />
          <NavItem to="/schedule" icon={<CalendarDays size={20} />} label="Escalas" />
          <NavItem to="/cobertura" icon={<BarChart3 size={20} />} label="Cobertura" />
          <NavItem to="/settings" icon={<Settings size={20} />} label="Configurações" />
          <NavItem to="/usuarios" icon={<Shield size={20} />} label="Usuários" />
        </nav>

        <div className="p-4 border-t border-ebony-700">
  <div className="flex items-center gap-3 mb-3">
    <div className="w-10 h-10 rounded-full bg-[#850000] flex items-center justify-center font-bold text-white">
      {userProfile?.name?.charAt(0) || 'U'}
    </div>
    <div>
      <p className="text-sm font-medium text-white">{userProfile?.name || 'Usuário'}</p>
      <p className="text-xs text-gray-400 capitalize">{userProfile?.role || 'Funcionário'}</p>
    </div>
  </div>
  <button
    onClick={handleLogout}
    className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:bg-red-900/20 hover:text-red-400 transition-all"
  >
    <LogOut size={18} />
    <span className="text-sm font-medium">Sair</span>
  </button>
</div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Componente auxiliar de link (apenas visual)
const NavItem = ({ icon, label, to, active }) => (
  <Link 
    to={to} 
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
      active 
        ? 'bg-brand-red text-white shadow-neon' 
        : 'text-ice-400 hover:bg-ebony-700 hover:text-ice-200'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </Link>
);

export default MainLayout;