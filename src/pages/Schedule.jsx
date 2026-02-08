import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Plus, Trash2, User, Clock, DollarSign, Edit2, Calendar, BarChart3, Filter, X, LayoutGrid, List as ListIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const Schedule = () => {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [idsToDeleteOnSave, setIdsToDeleteOnSave] = useState([]);

  // Segurança: Limpa a lista de substituição sempre que o modal fecha
  useEffect(() => {
    if (!isModalOpen) {
      setIdsToDeleteOnSave([]);
      setEditingShift(null);
    }
  }, [isModalOpen]);
  const [activeTab, setActiveTab] = useState('grade'); 
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [filterArea, setFilterArea] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');

  const [viewingCell, setViewingCell] = useState(null); 
  const [batchConfig, setBatchConfig] = useState({}); // Configuração individual por bloco
  // Função auxiliar para calcular duração
  const calculateDuration = (start, end) => {
    if (!start || !end) return null;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let diff = (endH * 60 + endM) - (startH * 60 + startM);
    if (diff < 0) diff += 24 * 60; // Trata virada de noite
    
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    
    if (minutes > 0) return `${hours}h ${minutes}min`;
    return `${hours}h`;
  };
  // Estado do Novo Turno
  const [newShift, setNewShift] = useState({
    employeeId: '',
    schedulesByArea: {} // { "Musculação": { "Segunda": {start, end}, "Terça": {start, end} } }
  });

  const [availableAreas, setAvailableAreas] = useState([
    'Musculação',
    'Recepção',
    'Limpeza',
    'Aulas Coletivas'
  ]);
  const [isAddingNewArea, setIsAddingNewArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');

  // 1. Buscar dados
  useEffect(() => {
    const fetchData = async () => {
      // Pega funcionários
      const empSnap = await getDocs(collection(db, "employees"));
      const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(empList);

      // Pega escalas
      const shiftSnap = await getDocs(collection(db, "schedules"));
      const shiftList = shiftSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShifts(shiftList);

      // Extrair áreas únicas
      const uniqueAreas = [...new Set(shiftList.map(s => s.area))].filter(Boolean);
      setAvailableAreas(prev => [...new Set([...prev, ...uniqueAreas])]);
    };
    fetchData();
  }, []);

  // 2. Salvar Turno
  const handleAddShift = async (e) => {
    e.preventDefault();
    if (!newShift.employeeId) return alert("Selecione um funcionário");

    const areasWithDays = Object.keys(newShift.schedulesByArea).filter(
      area => Object.keys(newShift.schedulesByArea[area]).length > 0
    );

    if (areasWithDays.length === 0) return alert("Adicione pelo menos uma modalidade com dias configurados");

    setLoading(true);

    try {
      // 1. LIMPEZA (Se for edição)
      if (idsToDeleteOnSave.length > 0) {
        await Promise.all(idsToDeleteOnSave.map(id => deleteDoc(doc(db, "schedules", id))));
      } else if (editingShift) {
        await deleteDoc(doc(db, "schedules", editingShift.id));
      }

      // 2. CRIAÇÃO
      const newShiftsCreated = [];

      for (const key of Object.keys(newShift.schedulesByArea)) {
        // TRUQUE: Removemos o sufixo " (2)" para salvar no banco com o nome real da área
        const realAreaName = key.split(' (')[0];
        const daysConfig = newShift.schedulesByArea[key];

        for (const day of Object.keys(daysConfig)) {
          const schedule = daysConfig[day];
          const shiftData = {
            employeeId: newShift.employeeId,
            day: day,
            start: schedule.start,
            end: schedule.end,
            area: realAreaName // Salva limpo no banco
          };
          const docRef = await addDoc(collection(db, "schedules"), shiftData);
          newShiftsCreated.push({ id: docRef.id, ...shiftData });
        }
      }

      // Atualiza Lista Local
      const deletedIds = idsToDeleteOnSave.length > 0 ? idsToDeleteOnSave : (editingShift ? [editingShift.id] : []);
      const updatedList = shifts.filter(s => !deletedIds.includes(s.id));
      setShifts([...updatedList, ...newShiftsCreated]);

      // Reset
      setNewShift({ employeeId: '', schedulesByArea: {} });
      setIdsToDeleteOnSave([]);
      setEditingShift(null);
      setIsModalOpen(false);

    } catch (error) {
      console.error(error);
      alert('Erro ao salvar: ' + error.message);
    }
    setLoading(false);
  };

  // 3. Deletar Turno
  const handleDeleteShift = async (id) => {
    if (confirm("Remover este horário?")) {
      await deleteDoc(doc(db, "schedules", id));
      setShifts(shifts.filter(s => s.id !== id));
    }
  };

  // Função Inteligente de Edição Global (Detecta quebra de turnos)
  const handleEditEmployeeGlobal = (empId) => {
    const relatedShifts = shifts.filter(s => s.employeeId === empId);
    if (relatedShifts.length === 0) return alert("Este funcionário ainda não tem turnos.");

    const schedulesMap = {};

    relatedShifts.forEach(s => {
      let keyToUse = s.area;
      let counter = 2;

      // Se já existe um horário nesse dia para essa área, é um "segundo turno" (ex: pós-almoço)
      // Então procuramos uma chave livre: Musculação (2), Musculação (3)...
      while (schedulesMap[keyToUse] && schedulesMap[keyToUse][s.day]) {
        keyToUse = `${s.area} (${counter})`;
        counter++;
      }

      if (!schedulesMap[keyToUse]) schedulesMap[keyToUse] = {};
      schedulesMap[keyToUse][s.day] = { start: s.start, end: s.end };
    });

    setNewShift({ employeeId: empId, schedulesByArea: schedulesMap });
    setIdsToDeleteOnSave(relatedShifts.map(s => s.id));
    setEditingShift(null);
    setIsModalOpen(true);
  };

  const handleEditShift = (shift) => {
    // 1. Encontrar todos os turnos desse funcionário NESTA área (ex: Toda a musculação da Maria)
    const relatedShifts = shifts.filter(s =>
      s.employeeId === shift.employeeId &&
      s.area === shift.area
    );

    // 2. Construir o objeto de horários para preencher o modal
    const schedulesMap = {};
    relatedShifts.forEach(s => {
      schedulesMap[s.day] = { start: s.start, end: s.end };
    });

    // 3. Preencher o formulário completo
    setNewShift({
      employeeId: shift.employeeId,
      schedulesByArea: {
        [shift.area]: schedulesMap
      }
    });

    // 4. Marcar esses IDs para serem substituídos ao salvar
    setIdsToDeleteOnSave(relatedShifts.map(s => s.id));

    // 5. TRUQUE: Deixamos editingShift como NULL.
    // Isso faz o modal pensar que é um "Novo Cadastro", liberando 
    // a troca de funcionário, adição de dias e exclusão de horários livremente.
    setEditingShift(null);

    setIsModalOpen(true);
  };
  // --- CÁLCULOS FINANCEIROS (O Cérebro) ---

  // A. Custo dos Mensalistas (Fixo) - APENAS OS QUE ESTÃO NA ESCALA
  const fixedCost = employees
    .filter(e => e.type === 'mensalista' && shifts.some(s => s.employeeId === e.id))
    .reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

  // B. Custo dos Horistas (Baseado na Escala)
  const calculateShiftCost = (shift) => {
    const emp = employees.find(e => e.id === shift.employeeId);
    if (!emp) return 0;

    // Mensalistas NÃO entram no cálculo variável (já estão no fixo)
    if (emp.type === 'mensalista') return 0;

    const start = parseInt(shift.start.split(':')[0]);
    const end = parseInt(shift.end.split(':')[0]);
    const hours = end - start;

    // Pega valor específico da área OU valor base
    const valuePerHour = emp.valuesByArea?.[shift.area] || parseFloat(emp.value) || 0;

    return hours * valuePerHour;
  };

  const weeklyVariableCost = shifts.reduce((acc, shift) => acc + calculateShiftCost(shift), 0);

  // Projeção Mensal (Considerando 4.5 semanas no mês para média)
  const monthlyVariableCost = weeklyVariableCost * 4.5;
  const totalMonthlyCost = fixedCost + monthlyVariableCost;
  // Calcular horas trabalhadas por funcionário
  const calculateEmployeeHours = (empId) => {
    return shifts
      .filter(s => s.employeeId === empId)
      .reduce((total, shift) => {
        const start = parseInt(shift.start.split(':')[0]);
        const end = parseInt(shift.end.split(':')[0]);
        return total + (end - start);
      }, 0);
  };

  // Contar pessoas por horário em um dia específico
  const countPeopleByHour = (day, hour) => {
    return shifts.filter(shift => {
      if (shift.day !== day) return false;
      const start = parseInt(shift.start.split(':')[0]);
      const end = parseInt(shift.end.split(':')[0]);
      return hour >= start && hour < end;
    }).length;
  };

  // Detectar horários com cobertura baixa
  const getLowCoverageAlerts = (day) => {
    const alerts = [];
    for (let hour = 6; hour <= 22; hour++) {
      const count = countPeopleByHour(day, hour);
      if (count < 2 && count > 0) {
        alerts.push({ hour, count });
      }
    }
    return alerts;
  };
  // Filtrar turnos
  const getFilteredShifts = () => {
    return shifts.filter(shift => {
      const areaMatch = filterArea === 'all' || shift.area === filterArea;
      const employeeMatch = filterEmployee === 'all' || shift.employeeId === filterEmployee;
      return areaMatch && employeeMatch;
    });
  };

  const filteredShifts = getFilteredShifts();

  // Heatmap: contar pessoas por horário (considerando filtros)
  const countPeopleByHourFiltered = (day, hour) => {
    return filteredShifts.filter(shift => {
      if (shift.day !== day) return false;
      const start = parseInt(shift.start.split(':')[0]);
      const end = parseInt(shift.end.split(':')[0]);
      return hour >= start && hour < end;
    }).length;
  };

  // Definir cor baseado na quantidade de pessoas
  const getCellColor = (count) => {
    if (count === 0) return 'bg-[#1a1a1a] border-[#323238]';
    if (count === 1) return 'bg-red-900/30 border-red-500/30';
    if (count === 2) return 'bg-yellow-900/30 border-yellow-500/30';
    return 'bg-green-900/30 border-green-500/30';
  };

  const getCellTextColor = (count) => {
    if (count === 0) return 'text-gray-600';
    if (count === 1) return 'text-red-400';
    if (count === 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h até 22h
  return (
    <MainLayout>
      {/* 1. Cabeçalho Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#29292e] p-6 rounded-2xl border border-[#323238]">
          <p className="text-gray-400 text-sm mb-1">Custo Fixo (Salários)</p>
          <h3 className="text-2xl font-bold text-white">R$ {fixedCost.toLocaleString('pt-BR')}</h3>
        </div>
        <div className="bg-[#29292e] p-6 rounded-2xl border border-[#323238]">
          <p className="text-gray-400 text-sm mb-1">Variável Semanal (Horas)</p>
          <h3 className="text-2xl font-bold text-white">R$ {weeklyVariableCost.toLocaleString('pt-BR')}</h3>
        </div>
        <div className="bg-gradient-to-br from-[#850000] to-red-900 p-6 rounded-2xl border border-red-500/30">
          <p className="text-white/80 text-sm mb-1">Custo Operacional Total (Mês)</p>
          <h3 className="text-3xl font-bold text-white">R$ {totalMonthlyCost.toLocaleString('pt-BR')}</h3>
          <p className="text-xs text-white/60 mt-1">*Projeção baseada em 4.5 semanas</p>
        </div>
      </div>

      {/* 2. Abas e Controles */}
      <div className="mb-6">
        {/* Abas */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('grade')}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${activeTab === 'grade'
                ? 'bg-[#850000] text-white'
                : 'bg-[#29292e] text-gray-400 hover:text-white border border-[#323238]'
                }`}
            >
              <Calendar size={18} />
              Grade Semanal
            </button>
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${activeTab === 'heatmap'
                ? 'bg-[#850000] text-white'
                : 'bg-[#29292e] text-gray-400 hover:text-white border border-[#323238]'
                }`}
            >
              <BarChart3 size={18} />
              Cobertura (Heatmap)
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#850000] hover:bg-red-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 transition-all"
          >
            <Plus size={18} /> Adicionar Turno
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="text-[#850000]" size={18} />
            <span className="text-white font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Área/Setor</label>
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-2 text-white text-sm focus:border-[#850000] outline-none"
              >
                <option value="all">Todas as áreas</option>
                {availableAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Funcionário</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-2 text-white text-sm focus:border-[#850000] outline-none"
              >
                <option value="all">Todos os funcionários</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
          {(filterArea !== 'all' || filterEmployee !== 'all') && (
            <button
              onClick={() => {
                setFilterArea('all');
                setFilterEmployee('all');
              }}
              className="mt-3 text-xs text-gray-400 hover:text-white underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
      {activeTab === 'grade' && (
        <>
          {/* 3. Resumo de Horas por Funcionário */}
          <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="text-[#850000]" size={20} />
                Carga Horária Semanal
              </h3>
              
              {/* Botões de Alternância (Grid/Lista) */}
              <div className="flex bg-[#121214] rounded-lg p-1 border border-[#323238]">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'bg-[#323238] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  title="Visualização em Cards"
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-all ${viewMode === 'list' ? 'bg-[#323238] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  title="Visualização em Lista"
                >
                  <ListIcon size={18} />
                </button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              /* VISUALIZAÇÃO EM CARDS (Original) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {employees.filter(emp => shifts.some(s => s.employeeId === emp.id)).map(emp => {
                  const totalHours = calculateEmployeeHours(emp.id);
                  let monthlyCost = 0;
                  if (emp.type === 'mensalista') {
                    monthlyCost = parseFloat(emp.value) || 0;
                  } else {
                    const weeklyCost = filteredShifts
                      .filter(s => s.employeeId === emp.id)
                      .reduce((acc, shift) => acc + calculateShiftCost(shift), 0);
                    monthlyCost = weeklyCost * 4.5;
                  }

                  return (
                    <div key={emp.id} className="bg-[#1a1a1a] border border-[#323238] rounded-lg p-4 relative group hover:border-[#850000]/50 transition-all">
                      <button
                        onClick={() => handleEditEmployeeGlobal(emp.id)}
                        className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white hover:bg-[#323238] rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-[#29292e] border border-[#323238] flex items-center justify-center text-sm font-bold text-white">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{emp.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{emp.role}</p>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-[#323238] pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Horas/Semana:</span>
                          <span className="text-white font-bold">{totalHours}h</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Custo Est. (Mês):</span>
                          <span className="text-[#850000] font-bold text-sm">
                            R$ {monthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VISUALIZAÇÃO EM LISTA (Nova Tabela) */
              <div className="overflow-x-auto rounded-lg border border-[#323238]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1a1a1a]">
                    <tr>
                      <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase border-b border-[#323238]">Funcionário</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase text-center border-b border-[#323238]">Cargo</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase text-center border-b border-[#323238]">Horas/Semana</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase text-center border-b border-[#323238]">Turnos</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase text-right border-b border-[#323238]">Custo Mensal Est.</th>
                      <th className="py-3 px-4 text-xs font-medium text-gray-400 uppercase text-center border-b border-[#323238]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#29292e]">
                    {employees.filter(emp => shifts.some(s => s.employeeId === emp.id)).map(emp => {
                      const totalHours = calculateEmployeeHours(emp.id);
                      let monthlyCost = 0;
                      if (emp.type === 'mensalista') {
                        monthlyCost = parseFloat(emp.value) || 0;
                      } else {
                        const weeklyCost = filteredShifts
                          .filter(s => s.employeeId === emp.id)
                          .reduce((acc, shift) => acc + calculateShiftCost(shift), 0);
                        monthlyCost = weeklyCost * 4.5;
                      }

                      return (
                        <tr key={emp.id} className="border-b border-[#323238] hover:bg-[#323238] transition-colors last:border-0">
                          <td className="py-3 px-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#323238] flex items-center justify-center text-xs font-bold text-white">
                              {emp.name.charAt(0)}
                            </div>
                            <span className="text-white text-sm font-medium">{emp.name}</span>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-400 text-sm capitalize">{emp.role}</td>
                          <td className="py-3 px-4 text-center text-white font-bold text-sm">{totalHours}h</td>
                          <td className="py-3 px-4 text-center text-gray-400 text-sm">{shifts.filter(s => s.employeeId === emp.id).length}</td>
                          <td className="py-3 px-4 text-right text-[#850000] font-mono text-sm font-bold">
                            R$ {monthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button 
                              onClick={() => handleEditEmployeeGlobal(emp.id)} 
                              className="text-gray-500 hover:text-white p-2 hover:bg-[#404045] rounded transition-all"
                              title="Editar Grade"
                            >
                              <Edit2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {/* 3. Conteúdo das Abas */}

      {activeTab === 'grade' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map(day => {
            const dayShifts = filteredShifts.filter(s => s.day === day);
            return (
              <div key={day} className="bg-[#29292e] border border-[#323238] rounded-xl p-4 min-h-[300px]">
                <div className="border-b border-[#323238] pb-3 mb-4">
                  <h4 className="text-white font-bold text-center mb-2">{day}</h4>

                  {/* Alertas de Cobertura Baixa */}
                  {getLowCoverageAlerts(day).length > 0 && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-2">
                      <p className="text-xs text-yellow-400 text-center flex items-center justify-center gap-1">
                        <span>⚠️</span>
                        {getLowCoverageAlerts(day).length} {getLowCoverageAlerts(day).length === 1 ? 'horário' : 'horários'} com pouca cobertura
                      </p>
                    </div>
                  )}

                  {/* Contador Total de Pessoas no Dia */}
                  <p className="text-xs text-gray-400 text-center mt-2">
                    {dayShifts.length} {dayShifts.length === 1 ? 'turno' : 'turnos'}
                  </p>
                </div>

                <div className="space-y-3">
                  {dayShifts.sort((a, b) => a.start.localeCompare(b.start)).map(shift => {
                    const emp = employees.find(e => e.id === shift.employeeId);
                    const start = parseInt(shift.start.split(':')[0]);
                    const count = countPeopleByHour(shift.day, start);

                    return (
                      <div key={shift.id} className="bg-[#29292e] border border-l-4 border-[#323238] border-l-[#850000] p-3 rounded-lg shadow-sm hover:translate-x-1 transition-transform group relative">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditShift(shift)}
                            className="p-1 hover:bg-[#323238] rounded text-gray-400 hover:text-white"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteShift(shift.id)}
                            className="p-1 hover:bg-red-900/20 rounded text-red-500 hover:text-red-400"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <p className="text-white font-bold text-sm truncate">{emp?.name || 'Carregando...'}</p>

                        <p className="text-gray-400 text-xs flex items-center gap-1 mt-1">
                          <Clock size={10} /> {shift.start} - {shift.end}
                          <span className="text-gray-500">•</span>
                          <span className="text-[#850000] font-medium">
                            {parseInt(shift.end.split(':')[0]) - parseInt(shift.start.split(':')[0])}h
                          </span>
                        </p>

                        <p className="text-xs text-[#850000] mt-1 uppercase tracking-wider">{shift.area}</p>

                        {count < 2 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
                            <span>⚠️</span>
                            <span>Cobertura baixa ({count})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div>
          {/* Legenda */}
          <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4 mb-6">
            <p className="text-sm text-white font-medium mb-3">Legenda:</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#1a1a1a] border border-[#323238] rounded"></div>
                <span className="text-xs text-gray-400">0 pessoas (vazio)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-900/30 border border-red-500/30 rounded"></div>
                <span className="text-xs text-gray-400">1 pessoa (crítico)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-900/30 border border-yellow-500/30 rounded"></div>
                <span className="text-xs text-gray-400">2 pessoas (ok)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-900/30 border border-green-500/30 rounded"></div>
                <span className="text-xs text-gray-400">3+ pessoas (ótimo)</span>
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[#29292e] text-left p-3 border-b border-[#323238]">
                    <span className="text-sm font-bold text-white">Dia / Hora</span>
                  </th>
                  {HOURS.map(hour => (
                    <th key={hour} className="text-center p-3 border-b border-[#323238] min-w-[60px]">
                      <span className="text-xs text-gray-400">{hour}h</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className="sticky left-0 bg-[#29292e] p-3 border-b border-[#323238]">
                      <span className="text-sm font-medium text-white">{day}</span>
                    </td>
                    {HOURS.map(hour => {
                                            const count = countPeopleByHourFiltered(day, hour);
                                            return (
                                                <td 
                                                    key={`${day}-${hour}`} 
                                                    className="p-2 border-b border-r border-[#323238] text-center align-middle"
                                                >
                                                    <div 
                                                        onClick={() => {
                                                            if (count > 0) {
                                                                // Agora salvamos um objeto com { funcionário, turno }
                                                                const items = filteredShifts.filter(shift => {
                                                                    if (shift.day !== day) return false;
                                                                    const start = parseInt(shift.start.split(':')[0]);
                                                                    const end = parseInt(shift.end.split(':')[0]);
                                                                    return hour >= start && hour < end;
                                                                }).map(s => ({
                                                                    employee: employees.find(e => e.id === s.employeeId),
                                                                    shift: s
                                                                }));
                                                                
                                                                setViewingCell({ day, hour, items: items });
                                                            }
                                                        }}
                                                        className={`${getCellColor(count)} border rounded-lg p-2 min-h-[50px] flex items-center justify-center transition-all hover:opacity-80 cursor-pointer relative`}
                                                    >
                                                        <span className={`text-lg font-bold ${getCellTextColor(count)}`}>
                                                            {count}
                                                        </span>
                                                        
                                                        {/* Tooltip Fixo (Correção visual do modal) */}
                                                        {viewingCell && viewingCell.day === day && viewingCell.hour === hour && (
                                                            <div 
                                                                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] cursor-default"
                                                                onClick={(e) => { e.stopPropagation(); setViewingCell(null); }}
                                                            >
                                                                <div 
                                                                    className="bg-[#121214] border border-[#323238] rounded-xl shadow-2xl p-4 w-64 animate-in fade-in zoom-in duration-200"
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                >
                                                                    <div className="flex justify-between items-center mb-3 border-b border-[#323238] pb-2">
                                                                        <div className="flex flex-col text-left">
                                                                            <span className="text-sm font-bold text-white">{day}</span>
                                                                            <span className="text-xs text-[#850000] font-mono">{hour}:00 - {hour + 1}:00</span>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => setViewingCell(null)}
                                                                            className="text-gray-500 hover:text-white bg-[#29292e] rounded-full p-1"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar text-left">                                                                       
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
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
      )}

      {/* Modal de Adicionar Turno */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingShift ? 'Editar Turno' : 'Novo Horário'}
            </h3>
            <form onSubmit={handleAddShift} className="space-y-4">
              {/* 1. Selecionar Funcionário */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Funcionário</label>
                <select
                  className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg p-3 text-white outline-none focus:border-[#850000]"
                  value={newShift.employeeId}
                  onChange={e => setNewShift({ ...newShift, employeeId: e.target.value })}
                  required
                  disabled={editingShift}
                >
                  <option value="">Selecione...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              {/* 2. Adicionar Modalidades (Com suporte a múltiplos turnos) */}
              {newShift.employeeId && !editingShift && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Adicionar Bloco de Horário</label>
                  <div className="flex gap-2 flex-wrap">
                    {availableAreas.map(area => {
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => {
                            // Lógica para gerar chave única: Musculação -> Musculação (2) -> Musculação (3)
                            let newKey = area;
                            let counter = 2;
                            while (newShift.schedulesByArea[newKey]) {
                              newKey = `${area} (${counter})`;
                              counter++;
                            }

                            setNewShift({
                              ...newShift,
                              schedulesByArea: {
                                ...newShift.schedulesByArea,
                                [newKey]: {}
                              }
                            });
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-[#1a1a1a] border border-[#323238] text-gray-400 hover:border-[#850000] hover:text-white"
                        >
                          + {area}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Configurar Dias e Horários por Modalidade */}
              {Object.keys(newShift.schedulesByArea).length > 0 && (
                <div className="space-y-4">
                  <label className="text-sm text-gray-400 block">Configurar Horários</label>

                  {Object.keys(newShift.schedulesByArea).map(area => {
                const emp = employees.find(e => e.id === newShift.employeeId);
                const valueForArea = emp?.valuesByArea?.[area] || parseFloat(emp?.value) || 0;
                const daysConfig = newShift.schedulesByArea[area];

                // 1. Define o Padrão Local (Se não existir, usa 06:00 - 12:00)
                const currentBatchStart = batchConfig[area]?.start || '06:00';
                const currentBatchEnd = batchConfig[area]?.end || '12:00';

                const totalHoursArea = Object.values(daysConfig).reduce((acc, curr) => {
                  if (!curr.start || !curr.end) return acc;
                  const s = parseInt(curr.start.split(':')[0]);
                  const e = parseInt(curr.end.split(':')[0]);
                  return acc + (e - s);
                }, 0);

                return (
                  <div key={area} className="bg-[#1a1a1a] border border-[#323238] rounded-xl p-4">
                    {/* Cabeçalho da Modalidade */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-white font-bold">{area}</h4>
                          <span className="text-xs text-gray-400 font-medium bg-[#29292e] px-2 py-0.5 rounded border border-[#323238]">
                            {totalHoursArea}h sem
                          </span>
                        </div>
                        {emp?.type === 'hora_aula' && (
                          <p className="text-xs text-green-400 font-mono">R$ {valueForArea.toFixed(2)}/h</p>
                        )}
                      </div>
                      {!editingShift && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSchedules = { ...newShift.schedulesByArea };
                            delete newSchedules[area];
                            setNewShift({ ...newShift, schedulesByArea: newSchedules });
                            // Limpa config local também
                            const newBatch = { ...batchConfig };
                            delete newBatch[area];
                            setBatchConfig(newBatch);
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    {/* Seleção de Dias */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-2">Dias da semana:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {DAYS.map(day => {
                          const isDayAdded = !!daysConfig[day];
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const newSchedules = { ...newShift.schedulesByArea };
                                if (isDayAdded) {
                                  delete newSchedules[area][day];
                                } else {
                                  newSchedules[area][day] = { start: '06:00', end: '12:00' };
                                }
                                setNewShift({ ...newShift, schedulesByArea: newSchedules });
                              }}
                              disabled={editingShift}
                              className={`text-xs py-2 rounded border transition-all ${isDayAdded
                                ? 'bg-[#850000] border-[#850000] text-white font-bold'
                                : 'bg-[#29292e] border-[#323238] text-gray-400 hover:border-[#850000]/50'
                                } ${editingShift ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {day.substring(0, 3)}
                            </button>
                          );
                        })}
                      </div>

                      {/* CONTROLES RÁPIDOS (Independentes) */}
                      {!editingShift && (
                        <div className="mt-3 bg-[#232329] border border-[#323238] rounded-lg p-3">
                          <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#323238]">
                            <span className="text-xs text-gray-400">Seleção de Dias:</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const newSchedules = { ...newShift.schedulesByArea };
                                  ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].forEach(day => {
                                    if (!newSchedules[area][day]) {
                                      newSchedules[area][day] = { start: currentBatchStart, end: currentBatchEnd };
                                    }
                                  });
                                  setNewShift({ ...newShift, schedulesByArea: newSchedules });
                                }}
                                className="text-xs px-3 py-1 bg-[#121214] border border-[#323238] rounded text-gray-400 hover:text-white hover:border-[#850000] transition-all"
                              >
                                + Seg-Sex
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSchedules = { ...newShift.schedulesByArea };
                                  newSchedules[area] = {};
                                  setNewShift({ ...newShift, schedulesByArea: newSchedules });
                                }}
                                className="text-xs px-3 py-1 bg-[#121214] border border-[#323238] rounded text-gray-400 hover:text-red-400 transition-all"
                              >
                                Limpar Dias
                              </button>
                            </div>
                          </div>

                          {/* Replicador de Horário (LOCAL) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">Padrão:</span>
                              <input
                                type="time"
                                value={currentBatchStart}
                                onChange={e => setBatchConfig({ 
                                    ...batchConfig, 
                                    [area]: { start: e.target.value, end: currentBatchEnd } 
                                })}
                                className="bg-[#121214] border border-[#323238] rounded px-2 py-1 text-xs text-white focus:border-[#850000] outline-none w-20"
                              />
                              <span className="text-gray-500 text-xs">até</span>
                              <input
                                type="time"
                                value={currentBatchEnd}
                                onChange={e => setBatchConfig({ 
                                    ...batchConfig, 
                                    [area]: { start: currentBatchStart, end: e.target.value } 
                                })}
                                className="bg-[#121214] border border-[#323238] rounded px-2 py-1 text-xs text-white focus:border-[#850000] outline-none w-20"
                              />
                              <span className="text-xs text-[#850000] font-mono font-bold ml-1 bg-[#850000]/10 px-1.5 py-0.5 rounded border border-[#850000]/30">
                                {calculateDuration(currentBatchStart, currentBatchEnd)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newSchedules = { ...newShift.schedulesByArea };
                                if (Object.keys(newSchedules[area] || {}).length === 0) {
                                  alert("Selecione os dias da semana primeiro.");
                                  return;
                                }
                                Object.keys(newSchedules[area]).forEach(day => {
                                  newSchedules[area][day] = { start: currentBatchStart, end: currentBatchEnd };
                                });
                                setNewShift({ ...newShift, schedulesByArea: newSchedules });
                              }}
                              className="text-xs bg-[#850000] hover:bg-red-700 text-white px-3 py-1.5 rounded transition-all font-bold shadow-neon"
                            >
                              Aplicar a Todos
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Horários de Cada Dia */}
                    {Object.keys(daysConfig).length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto mt-3">
                        <p className="text-xs text-gray-400 mb-2">Horários Individuais:</p>
                        {Object.keys(daysConfig).sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)).map(day => {
                          const schedule = daysConfig[day];
                          return (
                            <div key={day} className="bg-[#29292e] border border-[#323238] rounded-lg p-3 group hover:border-gray-500 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-white text-sm font-medium w-16">{day.substring(0, 3)}</span>
                                <input
                                  type="time"
                                  value={schedule.start}
                                  onChange={e => {
                                    const newSchedules = { ...newShift.schedulesByArea };
                                    newSchedules[area][day].start = e.target.value;
                                    setNewShift({ ...newShift, schedulesByArea: newSchedules });
                                  }}
                                  className="flex-1 bg-[#1a1a1a] border border-[#323238] rounded px-3 py-2 text-white text-xs outline-none focus:border-[#850000]"
                                />
                                <span className="text-gray-500">→</span>
                                <input
                                  type="time"
                                  value={schedule.end}
                                  onChange={e => {
                                    const newSchedules = { ...newShift.schedulesByArea };
                                    newSchedules[area][day].end = e.target.value;
                                    setNewShift({ ...newShift, schedulesByArea: newSchedules });
                                  }}
                                  className="flex-1 bg-[#1a1a1a] border border-[#323238] rounded px-3 py-2 text-white text-xs outline-none focus:border-[#850000]"
                                />
                                
                                <div className="w-20 text-right">
                                  <span className="text-[#850000] text-xs font-mono font-bold bg-[#1a1a1a] px-2 py-1 rounded border border-[#323238]">
                                    {calculateDuration(schedule.start, schedule.end)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              )}
              {/* Total Geral de Horas (Soma de todos os blocos) */}
              <div className="flex justify-between items-center bg-[#1a1a1a] border border-[#323238] rounded-lg p-3">
                 <span className="text-gray-400 text-sm">Total de Horas Semanais:</span>
                 <span className="text-white font-bold font-mono text-lg">
                   {Object.values(newShift.schedulesByArea).reduce((accArea, areaDays) => {
                      return accArea + Object.values(areaDays).reduce((accDay, curr) => {
                         if (!curr.start || !curr.end) return accDay;
                         const s = parseInt(curr.start.split(':')[0]);
                         const e = parseInt(curr.end.split(':')[0]);
                         return accDay + (e - s);
                      }, 0);
                   }, 0)}h
                 </span>
              </div>
              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingShift(null);
                    setNewShift({ employeeId: '', schedulesByArea: {} });
                  }}
                  className="flex-1 bg-[#323238] hover:bg-[#3a3a40] text-white py-3 rounded-lg font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#850000] hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                >
                  {loading
                    ? 'Salvando...'
                    : editingShift
                      ? 'Atualizar'
                      : 'Criar Turnos'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Detalhes do Heatmap (Corrigido e Protegido) */}
      {viewingCell && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setViewingCell(null)}
                >
                    <div 
                        className="bg-[#121214] border border-[#323238] rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        {/* Cabeçalho do Modal */}
                        <div className="flex justify-between items-center mb-4 border-b border-[#323238] pb-3">
                            <div>
                                <h4 className="text-lg font-bold text-white">{viewingCell.day}</h4>
                                <p className="text-sm text-[#850000] font-mono mt-1">
                                    {viewingCell.hour}:00 - {viewingCell.hour + 1}:00
                                </p>
                            </div>
                            <button 
                                onClick={() => setViewingCell(null)}
                                className="text-gray-400 hover:text-white bg-[#29292e] hover:bg-[#323238] rounded-full p-2 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Lista de Pessoas e Horários */}
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            {viewingCell.items && viewingCell.items.length > 0 ? (
                                viewingCell.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-[#1a1a1a] p-3 rounded-xl border border-[#29292e] hover:border-[#323238] transition-colors">
                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-full bg-[#29292e] border border-[#323238] flex items-center justify-center text-sm text-white font-bold shrink-0">
                                            {item.employee?.name?.charAt(0)}
                                        </div>
                                        
                                        {/* Informações */}
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex justify-between items-start">
                                                <span className="text-white font-medium truncate text-sm">{item.employee?.name}</span>
                                                {/* Horário Destacado */}
                                                <div className="flex items-center gap-1 bg-[#29292e] px-1.5 py-0.5 rounded border border-[#323238]">
                                                    <Clock size={10} className="text-[#850000]" />
                                                    <span className="text-[10px] text-white font-mono">
                                                        {item.shift.start} - {item.shift.end}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500 uppercase tracking-wider">{item.employee?.role}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 opacity-50">
                                    <p className="text-sm text-gray-400">Ninguém escalado neste horário.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
    </MainLayout>
  ); 
};

export default Schedule;