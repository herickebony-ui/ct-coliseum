import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Users, DollarSign, Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const Dashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const empSnap = await getDocs(collection(db, "employees"));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empList);

      const shiftSnap = await getDocs(collection(db, "schedules"));
      const shiftList = shiftSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShifts(shiftList);

      setLoading(false);
    };
    fetchData();
  }, []);

  // Cálculos
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.active).length;
  
  const fixedCost = employees
    .filter(e => e.type === 'mensalista')
    .reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

  const calculateShiftCost = (shift) => {
    const emp = employees.find(e => e.id === shift.employeeId);
    if (!emp || emp.type !== 'hora_aula') return 0;
    const start = parseInt(shift.start.split(':')[0]);
    const end = parseInt(shift.end.split(':')[0]);
    const hours = end - start;
    return hours * (parseFloat(emp.value) || 0);
  };

  const weeklyVariableCost = shifts.reduce((acc, shift) => acc + calculateShiftCost(shift), 0);
  const totalMonthlyCost = fixedCost + (weeklyVariableCost * 4.5);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-400">Carregando...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Cabeçalho */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-1">Visão geral do sistema</p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total de Funcionários */}
        <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
              <Users className="text-blue-400" size={24} />
            </div>
            <span className="text-xs text-gray-400">Total</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{totalEmployees}</h3>
          <p className="text-sm text-gray-400">Funcionários cadastrados</p>
          <p className="text-xs text-green-400 mt-2">{activeEmployees} ativos</p>
        </div>

        {/* Custo Mensal */}
        <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center justify-center">
              <DollarSign className="text-red-400" size={24} />
            </div>
            <span className="text-xs text-gray-400">Mensal</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">
            R$ {totalMonthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-sm text-gray-400">Custo operacional</p>
        </div>

        {/* Turnos da Semana */}
        <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-900/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <Calendar className="text-purple-400" size={24} />
            </div>
            <span className="text-xs text-gray-400">Semanal</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{shifts.length}</h3>
          <p className="text-sm text-gray-400">Turnos escalados</p>
        </div>

        {/* Custo Variável Semanal */}
        <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-yellow-400" size={24} />
            </div>
            <span className="text-xs text-gray-400">Variável</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">
            R$ {weeklyVariableCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-sm text-gray-400">Custo semanal (horas)</p>
        </div>
      </div>

      {/* Seção de Atalhos Rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas Ações */}
        <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="text-[#850000]" size={20} />
            Ações Rápidas
          </h3>
          <div className="space-y-3">
            <a href="/employees" className="block p-4 bg-[#1a1a1a] border border-[#323238] rounded-xl hover:border-[#850000]/30 transition-all">
              <p className="text-white font-medium">Cadastrar Funcionário</p>
              <p className="text-xs text-gray-400 mt-1">Adicionar novo membro à equipe</p>
            </a>
            <a href="/schedule" className="block p-4 bg-[#1a1a1a] border border-[#323238] rounded-xl hover:border-[#850000]/30 transition-all">
              <p className="text-white font-medium">Gerenciar Escalas</p>
              <p className="text-xs text-gray-400 mt-1">Organizar turnos da semana</p>
            </a>
            <a href="/usuarios" className="block p-4 bg-[#1a1a1a] border border-[#323238] rounded-xl hover:border-[#850000]/30 transition-all">
              <p className="text-white font-medium">Gerenciar Usuários</p>
              <p className="text-xs text-gray-400 mt-1">Controlar acessos ao sistema</p>
            </a>
          </div>
        </div>

        {/* Resumo por Tipo de Contrato */}
        <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="text-[#850000]" size={20} />
            Distribuição de Colaboradores
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border border-[#323238] rounded-xl">
              <div>
                <p className="text-white font-medium">Mensalistas (CLT)</p>
                <p className="text-xs text-gray-400 mt-1">Salário fixo</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {employees.filter(e => e.type === 'mensalista').length}
                </p>
                <p className="text-xs text-gray-400">pessoas</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border border-[#323238] rounded-xl">
              <div>
                <p className="text-white font-medium">Horistas</p>
                <p className="text-xs text-gray-400 mt-1">Por hora/aula</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {employees.filter(e => e.type === 'hora_aula').length}
                </p>
                <p className="text-xs text-gray-400">pessoas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;