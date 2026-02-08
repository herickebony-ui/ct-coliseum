import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, Settings, Shield, LogOut, BarChart3, DollarSign } from 'lucide-react';

const MainLayout = ({ children }) => {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Hook que diz em qual URL estamos

  const handleLogout = async () => {
    if (confirm('Deseja sair do sistema?')) {
      await logout();
      navigate('/login');
    }
  };

  // Função auxiliar para verificar se o link está ativo
  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex min-h-screen bg-[#121214] text-gray-100 font-sans">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-[#202024] border-r border-[#323238] hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            CT <span className="text-[#850000]">Coliseum</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem 
            to="/" 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={isActive('/')} 
          />
          <NavItem 
            to="/employees" 
            icon={<Users size={20} />} 
            label="Funcionários" 
            active={isActive('/employees')} 
          />
          <NavItem 
            to="/schedule" 
            icon={<CalendarDays size={20} />} 
            label="Escalas" 
            active={isActive('/schedule')} 
          />
          <NavItem 
            to="/cobertura" 
            icon={<BarChart3 size={20} />} 
            label="Cobertura" 
            active={isActive('/cobertura')} 
          />
          <NavItem 
            to="/financeiro" 
            icon={<DollarSign size={20} />} 
            label="Financeiro" 
            active={isActive('/financeiro')} 
          />
          <NavItem 
            to="/usuarios" 
            icon={<Shield size={20} />} 
            label="Usuários" 
            active={isActive('/usuarios')} 
          />
           <NavItem 
            to="/settings" 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={isActive('/settings')} 
          />
        </nav>

        <div className="p-4 border-t border-[#323238]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#850000] flex items-center justify-center font-bold text-white border border-[#323238]">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{userProfile?.name || 'Usuário'}</p>
              <p className="text-xs text-gray-400 capitalize truncate">{userProfile?.role || 'Funcionário'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:bg-red-900/20 hover:text-red-400 transition-all border border-transparent hover:border-red-900/30"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-auto bg-[#121214]">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Componente auxiliar de link
const NavItem = ({ icon, label, to, active }) => (
  <Link 
    to={to} 
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all border ${
      active 
        ? 'bg-[#850000] text-white border-[#850000] shadow-[0_0_10px_rgba(133,0,0,0.5)]' 
        : 'bg-transparent border-transparent text-gray-400 hover:bg-[#29292e] hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </Link>
);

export default MainLayout;