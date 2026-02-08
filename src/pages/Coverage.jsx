import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { BarChart3, Users, Clock, AlertTriangle, Search, Filter, ChevronDown, Check, X, Printer, Eye, Briefcase } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06h até 22h

const AREA_COLORS = {
  'Musculação': 'bg-red-500',
  'Cobertura gerência': 'bg-blue-500',
  'Recepção': 'bg-purple-500',
  'Limpeza': 'bg-gray-500',
  'Aulas Coletivas': 'bg-yellow-500',
  'Funcional': 'bg-orange-500',
  'Espaço Kids': 'bg-pink-500',
  'default': 'bg-emerald-500'
};

const Coverage = () => {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  
  // Dropdown e Filtros
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [filterName, setFilterName] = useState('');
  const [filterRole, setFilterRole] = useState(''); // Estado do filtro de cargo
  
  const [selectedAreas, setSelectedAreas] = useState(() => {
    const saved = localStorage.getItem('coverage_filter_areas');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('coverage_filter_areas', JSON.stringify(selectedAreas));
  }, [selectedAreas]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAreaDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

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

  const availableAreas = [...new Set(shifts.map(s => s.area).filter(Boolean))].sort();
  const availableRoles = [...new Set(employees.map(e => e.role).filter(Boolean))].sort();

  // --- FILTRAGEM ---
  const filteredShifts = shifts.filter(shift => {
    const emp = employees.find(e => e.id === shift.employeeId);
    if (!emp) return false;
    
    if (filterName && !emp.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterRole && emp.role !== filterRole) return false; // Lógica do filtro de cargo
    if (selectedAreas.length > 0 && !selectedAreas.includes(shift.area)) return false;
    
    return true;
  });

  // Auxiliares de Visualização
  const getCellColor = (count) => {
    if (count === 0) return 'bg-[#1a1a1a] border-[#323238]';
    if (count === 1) return 'bg-[#451a1a] border-[#5c2b2b]';
    if (count === 2) return 'bg-[#45381a] border-[#5c4d2b]';
    return 'bg-[#1a2e20] border-[#2b5c3a]';
  };

  const getCellTextColor = (count) => {
    if (count === 0) return 'text-gray-700';
    if (count === 1) return 'text-red-400';
    if (count === 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getAreaColor = (areaName) => {
    const baseName = areaName?.split(' (')[0];
    return AREA_COLORS[areaName] || AREA_COLORS[baseName] || AREA_COLORS['default'];
  };

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

  const toggleArea = (area) => {
    setSelectedAreas(prev => 
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  // --- LÓGICA DO RELATÓRIO INTELIGENTE ---
  const generateReportData = () => {
    // 1. Processar Segunda a Sexta (Agrupado)
    const weekPatterns = {}; // Chave: "EmpID-Area-Start-End" -> Valor: [Dias]
    
    filteredShifts
      .filter(s => WEEKDAYS.includes(s.day))
      .forEach(shift => {
        const key = `${shift.employeeId}|${shift.area}|${shift.start}|${shift.end}`;
        if (!weekPatterns[key]) {
          const emp = employees.find(e => e.id === shift.employeeId);
          weekPatterns[key] = {
            empName: emp?.name || 'Desconhecido',
            area: shift.area,
            start: shift.start,
            end: shift.end,
            days: []
          };
        }
        weekPatterns[key].days.push(shift.day);
      });

    // Organizar por Área
    const consolidatedWeek = {};
    Object.values(weekPatterns).forEach(pattern => {
      if (!consolidatedWeek[pattern.area]) consolidatedWeek[pattern.area] = [];
      consolidatedWeek[pattern.area].push(pattern);
    });

    return { consolidatedWeek };
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-400 animate-pulse">Carregando dados...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-white">Cobertura Semanal</h2>
          <p className="text-gray-400 text-sm">Mapa de calor e alocação</p>
        </div>
        
        <div className="flex flex-wrap gap-3 bg-[#202024] p-3 rounded-xl border border-[#323238] shadow-lg w-full xl:w-auto">
          {/* Busca Nome */}
          <div className="flex items-center bg-[#121214] border border-[#29292e] rounded-lg px-3 py-2 flex-1 min-w-[120px]">
            <Search size={16} className="text-gray-500 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              className="bg-transparent text-white text-sm outline-none w-full placeholder-gray-600"
            />
          </div>

          {/* FILTRO DE CARGOS (RESTAURADO) */}
          <div className="flex items-center bg-[#121214] border border-[#29292e] rounded-lg px-3 py-2 min-w-[140px]">
            <Briefcase size={16} className="text-gray-500 mr-2" />
            <select 
              value={filterRole} 
              onChange={e => setFilterRole(e.target.value)}
              className="bg-transparent text-white text-sm outline-none w-full cursor-pointer appearance-none"
            >
              <option value="">Todos Cargos</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Filtro Setores (Multi) */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsAreaDropdownOpen(!isAreaDropdownOpen)}
              className={`flex items-center justify-between gap-2 bg-[#121214] border rounded-lg px-3 py-2 min-w-[150px] transition-all ${selectedAreas.length > 0 ? 'border-[#850000] text-white' : 'border-[#29292e] text-gray-400'}`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Filter size={16} className={selectedAreas.length > 0 ? "text-[#850000]" : "text-gray-500"} />
                <span className="text-sm truncate max-w-[100px]">
                  {selectedAreas.length === 0 ? "Setores" : `${selectedAreas.length} selecionados`}
                </span>
              </div>
              <ChevronDown size={14} />
            </button>

            {isAreaDropdownOpen && (
              <div className="absolute top-full mt-2 right-0 w-64 bg-[#1a1a1a] border border-[#323238] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-[#323238] flex justify-between items-center bg-[#202024]">
                  <span className="text-xs text-gray-400 font-medium ml-2">Filtrar Setores</span>
                  {selectedAreas.length > 0 && (
                    <button onClick={() => setSelectedAreas([])} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-white/5">Limpar</button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {availableAreas.map(area => {
                    const isSelected = selectedAreas.includes(area);
                    const colorClass = getAreaColor(area);
                    return (
                      <button
                        key={area}
                        onClick={() => toggleArea(area)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-all ${isSelected ? 'bg-[#29292e] text-white' : 'text-gray-400 hover:bg-[#29292e] hover:text-gray-200'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
                          <span>{area}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-[#850000]" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BOTÃO DE RELATÓRIO */}
          <button 
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-2 bg-[#850000] hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all shadow-lg"
          >
            <Eye size={18} />
            <span className="text-sm font-bold">Relatório Visual</span>
          </button>
        </div>
      </div>

      {/* GRADE HEATMAP (Mantida como você pediu) */}
      <div className="bg-[#202024] border border-[#323238] rounded-xl overflow-hidden flex flex-col shadow-lg print:hidden">
        <div className="overflow-x-auto custom-scrollbar pb-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-[#29292e] p-3 border-b border-r border-[#323238] min-w-[100px] shadow-[2px_0_5px_rgba(0,0,0,0.3)] text-left">
                  <span className="text-xs font-bold text-gray-400 uppercase">Dia</span>
                </th>
                {HOURS.map(hour => (
                  <th key={hour} className="text-center p-2 border-b border-[#323238] min-w-[60px] bg-[#202024]">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-gray-300 font-mono">{hour}h</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-[#29292e]/50 transition-colors">
                  <td className="sticky left-0 z-10 bg-[#29292e] p-3 border-b border-r border-[#323238] font-medium text-white text-sm shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    {day}
                  </td>
                  {HOURS.map(hour => {
                    const count = getWorkingPeople(day, hour).length;
                    return (
                      <td key={`${day}-${hour}`} className="p-1 border-b border-r border-[#323238]/30 text-center relative">
                        <div 
                          onClick={() => count > 0 && setSelectedCell({ day, hour })}
                          className={`
                            h-10 w-full rounded flex items-center justify-center 
                            cursor-pointer transition-all hover:brightness-110
                            ${getCellColor(count)}
                            ${count === 0 ? 'opacity-50' : 'opacity-100 shadow-sm'}
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

      {/* RELATÓRIO PDF (NOVO LAYOUT CONSOLIDADO) */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1a1a1a] w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col border border-[#323238] shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-[#323238] flex justify-between items-center bg-[#202024]">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Printer className="text-[#850000]" /> Relatório de Escala
                </h2>
                <p className="text-sm text-gray-400">Visualização tática consolidada</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="bg-[#323238] hover:bg-[#404045] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                  Imprimir
                </button>
                <button onClick={() => setIsReportOpen(false)} className="bg-[#850000] hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                  Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo (Layout Inteligente) */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar print:overflow-visible print:h-auto print:bg-white print:text-black">
              
              {/* SEÇÃO 1: ROTINA SEMANAL (Consolidado) */}
              <div className="mb-8 break-inside-avoid">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-[#850000] pb-2 flex items-center gap-2 print:text-black">
                  <span className="bg-[#850000] text-white text-xs px-2 py-0.5 rounded uppercase">Rotina</span>
                  Segunda a Sexta
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(generateReportData().consolidatedWeek).length > 0 ? (
                    Object.keys(generateReportData().consolidatedWeek).sort().map(area => (
                      <div key={area} className="bg-[#202024] border border-[#323238] rounded-lg p-4 print:bg-white print:border-gray-300 print:break-inside-avoid">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-3 h-3 rounded-full ${getAreaColor(area)} print:print-color-adjust-exact`}></div>
                          <h4 className="font-bold text-gray-200 print:text-black">{area}</h4>
                        </div>
                        <ul className="space-y-2">
                          {generateReportData().consolidatedWeek[area]
                            .sort((a,b) => a.start.localeCompare(b.start))
                            .map((pattern, idx) => {
                              const isFullWeek = pattern.days.length === 5;
                              return (
                                <li key={idx} className="bg-[#121214] p-2 rounded border border-[#29292e] print:bg-gray-50 print:border-gray-200 print:text-black">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-white print:text-black">{pattern.empName}</span>
                                    <span className="font-mono text-xs text-[#850000] font-bold print:text-black">
                                      {pattern.start} - {pattern.end}
                                    </span>
                                  </div>
                                  {!isFullWeek && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {pattern.days.sort((a,b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)).map(d => (
                                        <span key={d} className="text-[9px] bg-[#29292e] text-gray-300 px-1.5 rounded print:bg-gray-200 print:text-black">
                                          {d.substring(0,3)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              );
                          })}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 col-span-3 text-center">Nenhum turno de segunda a sexta encontrado.</p>
                  )}
                </div>
              </div>

              {/* SEÇÃO 2: FIM DE SEMANA (Sábado e Domingo separados) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:break-before-page">
                {['Sábado', 'Domingo'].map(day => {
                   const areasInDay = {};
                   filteredShifts.filter(s => s.day === day).forEach(shift => {
                     if (!areasInDay[shift.area]) areasInDay[shift.area] = [];
                     const emp = employees.find(e => e.id === shift.employeeId);
                     if (emp) areasInDay[shift.area].push({ ...shift, empName: emp.name });
                   });

                   if (Object.keys(areasInDay).length === 0) return null;

                   return (
                     <div key={day} className="break-inside-avoid">
                        <h3 className="text-xl font-bold text-white mb-4 border-b border-[#323238] pb-2 print:text-black print:border-gray-300">
                          {day}
                        </h3>
                        <div className="space-y-4">
                          {Object.keys(areasInDay).sort().map(area => (
                            <div key={area} className="bg-[#202024] border border-[#323238] rounded-lg p-4 print:bg-white print:border-gray-300 print:break-inside-avoid">
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`w-3 h-3 rounded-full ${getAreaColor(area)} print:print-color-adjust-exact`}></div>
                                <h4 className="font-bold text-gray-200 print:text-black">{area}</h4>
                              </div>
                              <ul className="space-y-2">
                                {areasInDay[area].sort((a,b) => a.start.localeCompare(b.start)).map((shift, idx) => (
                                  <li key={idx} className="text-sm flex justify-between items-center bg-[#121214] p-2 rounded border border-[#29292e] print:bg-gray-50 print:border-gray-200 print:text-black">
                                    <span className="font-medium text-white print:text-black">{shift.empName}</span>
                                    <span className="font-mono text-xs text-[#850000] font-bold print:text-black">
                                      {shift.start} - {shift.end}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                     </div>
                   );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes (Mantido) */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCell(null)}>
          <div className="bg-[#202024] border border-[#323238] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-[#323238] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="text-[#850000]" size={20}/>
                  {selectedCell.day}, {selectedCell.hour}:00
                </h3>
              </div>
              <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-white p-2 hover:bg-[#323238] rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {getWorkingPeople(selectedCell.day, selectedCell.hour).map((person, idx) => (
                <div key={idx} className="bg-[#1a1a1a] border border-[#323238] rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-10 rounded-full ${getAreaColor(person.area)}`}></div>
                    <div className="w-10 h-10 rounded-full bg-[#202024] flex items-center justify-center text-sm font-bold text-white border border-[#323238]">
                      {person.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{person.name}</p>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">{person.area}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-mono bg-[#202024] px-2 py-1 rounded border border-[#323238]">
                        {person.shift.start} - {person.shift.end}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Coverage;