import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { BarChart3, Users, Clock, AlertTriangle, Search, Filter } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 05h até 23h

const Coverage = () => {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Estados de Filtros
  const [filterName, setFilterName] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterArea, setFilterArea] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const shiftSnap = await getDocs(collection(db, "schedules"));
      const shiftList = shiftSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShifts(shiftList);

      const empSnap = await getDocs(collection(db, "employees"));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empList);

      setLoading(false);
    };
    fetchData();
  }, []);

  // --- LÓGICA DE FILTROS ---
  const filteredShifts = shifts.filter(shift => {
    const emp = employees.find(e => e.id === shift.employeeId);
    if (!emp) return false;
    
    // Filtros
    if (filterName && !emp.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterRole && emp.role !== filterRole) return false;
    if (filterArea && shift.area !== filterArea) return false; // Filtra pela área da escala
    
    return true;
  });

  // Contar pessoas (usando a lista filtrada)
  const countPeople = (day, hour) => {
    return filteredShifts.filter(shift => {
      if (shift.day !== day) return false;
      const start = parseInt(shift.start.split(':')[0]);
      const end = parseInt(shift.end.split(':')[0]);
      return hour >= start && hour < end;
    }).length;
  };

  // Pegar quem está trabalhando (usando a lista filtrada)
  const getWorkingPeople = (day, hour) => {
    return filteredShifts
      .filter(shift => {
        if (shift.day !== day) return false;
        const start = parseInt(shift.start.split(':')[0]);
        const end = parseInt(shift.end.split(':')[0]);
        return hour >= start && hour < end;
      })
      .map(shift => {
        const emp = employees.find(e => e.id === shift.employeeId);
        return {
          name: emp?.name || 'Carregando...',
          area: shift.area,
          role: emp?.role || 'Sem cargo',
          shift: shift
        };
      });
  };

  // Cores
  const getCellColor = (count) => {
    if (count === 0) return 'bg-[#1a1a1a] border-[#323238]';
    if (count === 1) return 'bg-[#2e1a1a] border-[#5c2b2b]'; // Vermelho escuro
    if (count === 2) return 'bg-[#2e261a] border-[#5c4d2b]'; // Amarelo escuro
    return 'bg-[#1a2e20] border-[#2b5c3a]'; // Verde escuro
  };

  const getCellTextColor = (count) => {
    if (count === 0) return 'text-gray-700';
    if (count === 1) return 'text-red-400';
    if (count === 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  // Estatísticas (baseadas na visão filtrada)
  const totalCriticalHours = DAYS.reduce((acc, day) => {
    return acc + HOURS.filter(hour => countPeople(day, hour) < 2 && countPeople(day, hour) > 0).length;
  }, 0);

  const totalEmptyHours = DAYS.reduce((acc, day) => {
    return acc + HOURS.filter(hour => countPeople(day, hour) === 0).length;
  }, 0);

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
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Cobertura Semanal</h2>
          <p className="text-gray-400 text-sm">Visualização tática de escalas</p>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-[#202024] p-2 rounded-lg border border-[#323238]">
          {/* Busca Nome */}
          <div className="flex items-center bg-[#121214] border border-[#29292e] rounded px-3 py-1.5 w-40">
            <Search size={14} className="text-gray-500 mr-2" />
            <input 
              type="text" 
              placeholder="Nome..." 
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              className="bg-transparent text-white text-xs outline-none w-full placeholder-gray-600"
            />
          </div>

          {/* Filtro Cargo */}
          <div className="flex items-center bg-[#121214] border border-[#29292e] rounded px-2 py-1.5">
            <Filter size={14} className="text-gray-500 mr-2" />
            <select 
              value={filterRole} 
              onChange={e => setFilterRole(e.target.value)}
              className="bg-transparent text-white text-xs outline-none w-28 cursor-pointer appearance-none"
            >
              <option value="">Todos Cargos</option>
              {[...new Set(employees.map(e => e.role).filter(Boolean))].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Filtro Área */}
          <div className="flex items-center bg-[#121214] border border-[#29292e] rounded px-2 py-1.5">
            <Filter size={14} className="text-gray-500 mr-2" />
            <select 
              value={filterArea} 
              onChange={e => setFilterArea(e.target.value)}
              className="bg-transparent text-white text-xs outline-none w-28 cursor-pointer appearance-none"
            >
              <option value="">Todas Áreas</option>
              {/* Gera áreas dinamicamente baseado no que existe nas escalas */}
              {[...new Set(shifts.map(s => s.area).filter(Boolean))].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          
          {(filterName || filterRole || filterArea) && (
             <button onClick={() => {setFilterName(''); setFilterRole(''); setFilterArea('');}} className="text-xs text-red-400 px-2 hover:underline">
               Limpar
             </button>
          )}
        </div>
      </div>

      {/* Cards de Resumo (Mantidos compactos) */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#29292e] border border-[#323238] rounded-lg p-4 flex items-center gap-3">
          <div className="bg-green-900/20 p-2 rounded"><BarChart3 className="text-green-400" size={20} /></div>
          <div><p className="text-xl font-bold text-white">{DAYS.reduce((acc, day) => acc + HOURS.filter(hour => countPeople(day, hour) >= 3).length, 0)}h</p><p className="text-[10px] text-gray-400">Cobertura Alta</p></div>
        </div>
        <div className="bg-[#29292e] border border-[#323238] rounded-lg p-4 flex items-center gap-3">
          <div className="bg-yellow-900/20 p-2 rounded"><AlertTriangle className="text-yellow-400" size={20} /></div>
          <div><p className="text-xl font-bold text-white">{totalCriticalHours}h</p><p className="text-[10px] text-gray-400">Crítico (1 pessoa)</p></div>
        </div>
        <div className="bg-[#29292e] border border-[#323238] rounded-lg p-4 flex items-center gap-3">
          <div className="bg-red-900/20 p-2 rounded"><Clock className="text-red-400" size={20} /></div>
          <div><p className="text-xl font-bold text-white">{totalEmptyHours}h</p><p className="text-[10px] text-gray-400">Vazio (Descoberto)</p></div>
        </div>
      </div>

      {/* Tabela com Scroll e Coluna Fixa */}
      <div className="bg-[#202024] border border-[#323238] rounded-xl overflow-hidden flex flex-col shadow-lg">
        <div className="overflow-x-auto custom-scrollbar pb-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* Canto Fixo */}
                <th className="sticky left-0 z-20 bg-[#29292e] p-3 border-b border-r border-[#323238] min-w-[100px] shadow-[2px_0_5px_rgba(0,0,0,0.3)] text-left">
                  <span className="text-xs font-bold text-gray-400 uppercase">Dia</span>
                </th>
                {/* Cabeçalho de Horas com Intervalo */}
                {HOURS.map(hour => (
                  <th key={hour} className="text-center p-2 border-b border-[#323238] min-w-[80px] bg-[#202024]">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-gray-300 font-mono">{hour}h</span>
                      <span className="text-[9px] text-gray-500 font-mono mt-0.5">{hour}:00 - {hour + 1}:00</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-[#29292e]/50 transition-colors">
                  {/* Coluna Dia Fixa */}
                  <td className="sticky left-0 z-10 bg-[#29292e] p-3 border-b border-r border-[#323238] font-medium text-white text-sm shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    {day}
                  </td>
                  {HOURS.map(hour => {
                    const count = countPeople(day, hour);
                    return (
                      <td key={`${day}-${hour}`} className="p-1 border-b border-r border-[#323238]/30 text-center relative">
                        <div 
                          onClick={() => count > 0 && setSelectedCell({ day, hour })}
                          className={`
                            h-10 w-full rounded flex items-center justify-center 
                            cursor-pointer transition-all hover:brightness-110 
                            ${getCellColor(count)}
                            ${count === 0 ? 'opacity-30 hover:opacity-50' : 'opacity-100'}
                          `}
                        >
                          <span className={`font-bold text-sm ${getCellTextColor(count)}`}>
                            {count > 0 ? count : '-'}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhes */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCell(null)}>
          <div className="bg-[#202024] border border-[#323238] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-[#323238] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="text-[#850000]" size={20}/>
                {selectedCell.day}, {selectedCell.hour}h
              </h3>
              <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {getWorkingPeople(selectedCell.day, selectedCell.hour).map((person, idx) => (
                <div key={idx} className="bg-[#121214] border border-[#323238] rounded-lg p-3 flex items-center justify-between group hover:border-[#850000]/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Avatar com Inicial */}
                    <div className="w-10 h-10 rounded-full bg-[#202024] flex items-center justify-center text-sm font-bold text-white border border-[#323238]">
                      {person.name.charAt(0)}
                    </div>
                    
                    {/* Informações */}
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{person.name}</p>
                      <p className="text-xs text-[#850000] font-medium mt-0.5">{person.area}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                        {person.shift.start} - {person.shift.end}
                      </p>
                    </div>
                  </div>
                  
                  {/* Cargo (Opcional, discreto na direita) */}
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-gray-600 border border-[#323238] px-2 py-1 rounded-full">
                      {person.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}; // Fechamento do Componente

export default Coverage;