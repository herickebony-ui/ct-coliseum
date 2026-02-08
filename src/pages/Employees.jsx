import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Plus, Search, Trash2, Edit2, FileText, X, Check, LayoutGrid, List as ListIcon, Settings, Save } from 'lucide-react';
import { writeBatch } from 'firebase/firestore'; // Importante para atualização em massa
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  // --- GERENCIADOR DE CARGOS ---
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [editingRoleOriginalName, setEditingRoleOriginalName] = useState(null); // Qual cargo estamos editando
  const [editingRoleNewName, setEditingRoleNewName] = useState(''); // O novo nome

  // Contar uso dos cargos
  const getRoleUsageCount = (roleName) => {
    return employees.filter(e => e.role === roleName).length;
  };

  // 1. RENOMEAR CARGO (EM CASCATA)
  const handleUpdateRoleName = async () => {
    if (!editingRoleNewName.trim()) return;
    if (availableRoles.includes(editingRoleNewName)) return alert("Já existe um cargo com este nome.");

    const oldName = editingRoleOriginalName;
    const newName = editingRoleNewName.trim();

    if (!confirm(`Isso alterará o cargo de ${getRoleUsageCount(oldName)} funcionários de "${oldName}" para "${newName}". Deseja continuar?`)) return;

    setLoading(true);
    try {
      // A. Atualizar no Firebase (Batch Write - Seguro e Rápido)
      const batch = writeBatch(db);
      const affectedEmployees = employees.filter(e => e.role === oldName);

      affectedEmployees.forEach(emp => {
        const empRef = doc(db, "employees", emp.id);
        batch.update(empRef, { role: newName });
      });

      await batch.commit();

      // B. Atualizar Listas Locais
      setAvailableRoles(prev => prev.map(r => r === oldName ? newName : r));
      setEmployees(prev => prev.map(e => e.role === oldName ? { ...e, role: newName } : e));

      // Se o filtro estava no cargo antigo, atualiza para o novo
      if (filterRole === oldName) setFilterRole(newName);

      setEditingRoleOriginalName(null);
      setEditingRoleNewName('');
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar cargos: " + error.message);
    }
    setLoading(false);
  };

  // 2. EXCLUIR CARGO (COM TRAVA DE SEGURANÇA)
  const handleDeleteRole = (roleToDelete) => {
    const usage = getRoleUsageCount(roleToDelete);

    if (usage > 0) {
      return alert(`⚠️ AÇÃO BLOQUEADA\n\nExistem ${usage} funcionário(s) vinculados ao cargo "${roleToDelete}".\n\nVocê precisa alterar o cargo desses funcionários antes de excluir esta opção.`);
    }

    if (confirm(`Excluir o cargo "${roleToDelete}" da lista de opções?`)) {
      setAvailableRoles(prev => prev.filter(r => r !== roleToDelete));
    }
  };

  // Estado de Visualização
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [filterRole, setFilterRole] = useState('all'); // Novo filtro de cargo

  // Lógica de Filtragem
  const filteredEmployees = employees.filter(emp => 
    filterRole === 'all' || emp.role === filterRole
  );

  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    type: 'hora_aula',
    value: '',
    costReal: '', // Novo campo para Financeiro
    phone: '',
    active: true,
    valuesByArea: {}
  });

  // Estados para adicionar nova modalidade
  const [selectedAreaToAdd, setSelectedAreaToAdd] = useState('');
  const [customAreaValue, setCustomAreaValue] = useState('');
  const [isCreatingNewArea, setIsCreatingNewArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  // Estados para replicar horário em massa
  const [batchStartTime, setBatchStartTime] = useState('06:00');
  const [batchEndTime, setBatchEndTime] = useState('12:00');
  // Estado para visualizar detalhes do Heatmap
  const [viewingCell, setViewingCell] = useState(null); // { day, hour, employees: [] }

  const [availableRoles, setAvailableRoles] = useState([
    'Instrutor',
    'Recepção',
    'Limpeza',
    'Gerência'
  ]);
  const [isAddingNewRole, setIsAddingNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [availableAreas, setAvailableAreas] = useState([
    'Musculação',
    'Recepção',
    'Limpeza',
    'Aulas Coletivas',
    'Funcional'
  ]);

  // Carregar dados do Firebase
  const fetchEmployees = async () => {
    const querySnapshot = await getDocs(collection(db, "employees"));
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEmployees(list);

    // Extrair cargos únicos dos funcionários existentes
    const uniqueRoles = [...new Set(list.map(emp => emp.role))].filter(Boolean);
    setAvailableRoles(prev => {
      const combined = [...new Set([...prev, ...uniqueRoles])];
      return combined;
    });

    // Extrair áreas únicas (buscar do Schedule)
    const shiftSnap = await getDocs(collection(db, "schedules"));
    const shiftList = shiftSnap.docs.map(doc => doc.data());
    const uniqueAreas = [...new Set(shiftList.map(s => s.area))].filter(Boolean);
    setAvailableAreas(prev => [...new Set([...prev, ...uniqueAreas])]);
  };


  useEffect(() => {
    fetchEmployees();
  }, []);
  
  // Função para adicionar valor customizado à lista
  const handleAddAreaValue = () => {
    const areaName = isCreatingNewArea ? newAreaName.trim() : selectedAreaToAdd;
    
    if (!areaName) return alert("Selecione ou digite o nome da modalidade");
    if (!customAreaValue) return alert("Digite o valor para esta modalidade");

    // Atualiza a lista de áreas disponíveis se for nova
    if (isCreatingNewArea && !availableAreas.includes(areaName)) {
        setAvailableAreas(prev => [...prev, areaName]);
    }

    setFormData(prev => ({
        ...prev,
        valuesByArea: {
            ...prev.valuesByArea,
            [areaName]: parseFloat(customAreaValue)
        }
    }));

    // Resetar campos
    setSelectedAreaToAdd('');
    setCustomAreaValue('');
    setIsCreatingNewArea(false);
    setNewAreaName('');
};

// Remover valor customizado
const handleRemoveAreaValue = (areaToRemove) => {
    const newValues = { ...formData.valuesByArea };
    delete newValues[areaToRemove];
    setFormData({ ...formData, valuesByArea: newValues });
};

  // Salvar no Firebase
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.role) return alert('Selecione ou crie um cargo');

    setLoading(true);
    try {
      const payload = {
        ...formData,
        value: parseFloat(formData.value) || 0,
        costReal: parseFloat(formData.costReal) || 0, // Salva o custo real
        updatedAt: new Date()
      };

      if (editingId) {
        await setDoc(doc(db, "employees", editingId), payload, { merge: true });
      } else {
        await addDoc(collection(db, "employees"), { ...payload, createdAt: new Date() });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', role: '', type: 'hora_aula', value: '', costReal: '', phone: '', active: true, valuesByArea: {} });
      fetchEmployees();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert('Erro ao salvar: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir?")) {
      await deleteDoc(doc(db, "employees", id));
      fetchEmployees();
    }
  };

  const handleEdit = (employee) => {
    setFormData({
      name: employee.name,
      role: employee.role,
      type: employee.type,
      value: employee.value.toString(),
      costReal: employee.costReal ? employee.costReal.toString() : '', // Carrega o custo real
      phone: employee.phone || '',
      active: employee.active,
      valuesByArea: employee.valuesByArea || {}
    });
    setEditingId(employee.id);
    setIsModalOpen(true);
  };

  return (
    <MainLayout>
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Funcionários
            <span className="bg-[#202024] text-gray-400 text-sm py-1 px-3 rounded-full border border-[#323238]">
              {filteredEmployees.length}
            </span>
          </h2>
          <p className="text-ice-400 mt-1">Gerencie sua equipe, cargos e custos.</p>
        </div>
        
        <div className="flex gap-3 items-center flex-wrap justify-end">
        <button
            onClick={() => setIsRoleManagerOpen(true)}
            className="p-3 bg-[#202024] border border-[#323238] rounded-xl text-gray-400 hover:text-white hover:border-[#850000] transition-all"
            title="Gerenciar Cargos"
          >
            <Settings size={20} />
          </button>
          {/* Filtro de Cargo */}
          <div className="relative group">
             <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="appearance-none bg-[#121214] border border-[#323238] rounded-xl px-4 py-3 pr-8 text-sm text-white focus:border-[#850000] outline-none cursor-pointer hover:bg-[#202024] transition-colors"
            >
              <option value="all">Todos os Cargos</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              ▼
            </div>
          </div>

          {/* Botões de Visualização */}
          <div className="flex bg-[#121214] rounded-xl p-1 border border-[#323238]">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#323238] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Cards"
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#323238] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Lista"
            >
              <ListIcon size={20} />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#850000] hover:bg-red-700 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-neon"
          >
            <Plus size={20} />
            Novo
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (Grid vs Lista) */}
      {viewMode === 'grid' ? (
        // VISUALIZAÇÃO EM GRID
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="bg-[#202024] border border-[#323238] rounded-2xl p-6 hover:border-[#850000]/30 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-[#121214] border border-[#323238] flex items-center justify-center text-xl font-bold text-gray-200">
                  {emp.name.charAt(0)}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(emp)} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white"><Edit2 size={18} /></button>
                  <button onClick={() => { setSelectedEmployee(emp); setIsDocumentsModalOpen(true); }} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white"><FileText size={18} /></button>
                  <button onClick={() => handleDelete(emp.id)} className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white">{emp.name}</h3>
              <p className="text-[#850000] text-sm font-medium uppercase tracking-wider mb-4">{emp.role}</p>
              <div className="space-y-2 text-sm text-gray-400 bg-[#121214]/50 p-4 rounded-xl border border-[#323238]/50">
                <div className="flex justify-between">
                  <span>Contrato:</span>
                  <span className="text-gray-200 capitalize">{emp.type === 'mensalista' ? 'Mensalista (CLT)' : 'Hora Aula'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Base:</span>
                  <span className="text-gray-200 font-mono">
                    {emp.type === 'hora_aula' ? `R$ ${emp.value}/h` : `R$ ${emp.value}/mês`}
                  </span>
                </div>
                {/* Exibe o Custo Real no Card se existir e for Mensalista */}
                {emp.type === 'mensalista' && emp.costReal > 0 && (
                  <div className="flex justify-between border-t border-[#323238] pt-2 mt-2">
                    <span className="text-[#850000]">Custo Real:</span>
                    <span className="text-[#850000] font-bold font-mono">R$ {emp.costReal}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // VISUALIZAÇÃO EM LISTA (TABELA)
        <div className="bg-[#202024] border border-[#323238] rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#121214]">
              <tr>
                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase border-b border-[#323238]">Colaborador</th>
                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase border-b border-[#323238]">Cargo</th>
                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase border-b border-[#323238]">Contrato</th>
                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase border-b border-[#323238] text-right">Base Salarial</th>
                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase border-b border-[#323238] text-right">Custo Real (Empresa)</th>
                <th className="py-4 px-6 text-xs font-medium text-gray-400 uppercase border-b border-[#323238] text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#323238]">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#29292e] transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#323238] flex items-center justify-center text-xs font-bold text-white">
                        {emp.name.charAt(0)}
                      </div>
                      <span className="text-white font-medium">{emp.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-300 text-sm">{emp.role}</td>
                  <td className="py-4 px-6 text-gray-400 text-sm capitalize">
                    {emp.type === 'mensalista' ? 'CLT / Fixo' : 'Hora Aula'}
                  </td>
                  <td className="py-4 px-6 text-right text-white font-mono text-sm">
                     {emp.type === 'hora_aula' ? `R$ ${emp.value}/h` : `R$ ${emp.value}`}
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-sm">
                    {emp.type === 'mensalista' ? (
                       emp.costReal > 0 ? (
                         <span className="text-[#850000] font-bold">R$ {emp.costReal}</span>
                       ) : <span className="text-gray-600">-</span>
                    ) : <span className="text-gray-600">N/A</span>}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEdit(emp)} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white" title="Editar"><Edit2 size={16} /></button>
                      <button onClick={() => { setSelectedEmployee(emp); setIsDocumentsModalOpen(true); }} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white" title="Docs"><FileText size={16} /></button>
                      <button onClick={() => handleDelete(emp.id)} className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400" title="Excluir"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Cadastro (Simples) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ebony-800 border border-ebony-700 rounded-2xl p-8 w-full max-w-lg shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">
              {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
  {/* 1. Nome Completo */}
  <div>
    <label className="block text-sm text-gray-400 mb-1">Nome Completo</label>
    <input
      type="text"
      className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] outline-none"
      value={formData.name}
      onChange={e => setFormData({ ...formData, name: e.target.value })}
      required
    />
  </div>

  {/* 2. Cargo e Tipo Contrato */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm text-gray-400 mb-1">Cargo</label>

      {!isAddingNewRole ? (
        <div className="relative">
          <select
            className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] outline-none"
            value={formData.role}
            onChange={e => {
              if (e.target.value === '__novo__') {
                setIsAddingNewRole(true);
              } else {
                setFormData({ ...formData, role: e.target.value });
              }
            }}
            required
          >
            <option value="">Selecione...</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
            <option value="__novo__" className="text-[#850000] font-bold">+ Criar Novo Cargo</option>
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Digite o novo cargo"
            className="w-full bg-[#1a1a1a] border border-[#850000] rounded-lg px-4 py-3 text-white focus:outline-none"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (newRoleName.trim()) {
                  setAvailableRoles([...availableRoles, newRoleName.trim()]);
                  setFormData({ ...formData, role: newRoleName.trim() });
                  setNewRoleName('');
                  setIsAddingNewRole(false);
                }
              }}
              className="flex-1 bg-[#850000] text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingNewRole(false);
                setNewRoleName('');
              }}
              className="flex-1 bg-[#323238] text-gray-400 py-2 rounded-lg text-sm hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>

    <div>
      <label className="block text-sm text-gray-400 mb-1">Tipo Contrato</label>
      <select
        className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] outline-none"
        value={formData.type}
        onChange={e => setFormData({ ...formData, type: e.target.value })}
      >
        <option value="hora_aula">Hora Aula</option>
        <option value="mensalista">Mensalista (CLT)</option>
      </select>
    </div>
  </div>

  {/* 3. Valores Financeiros */}
  <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {formData.type === 'hora_aula' ? 'Valor Hora (R$)' : 'Salário em Carteira (R$)'}
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] outline-none font-mono"
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                required
              />
            </div>

            {/* Campo Custo Real (Apenas para Mensalistas) */}
            {formData.type === 'mensalista' && (
              <div>
                <label className="block text-sm text-[#850000] font-medium mb-1 flex items-center gap-1">
                   Custo Real (Empresa)
                   <span className="text-gray-500 text-[10px] font-normal border border-gray-600 rounded-full px-1 cursor-help" title="Soma de Salário + VT + VR + Impostos + Provisões">?</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Total gasto mensal"
                  className="w-full bg-[#1a1a1a] border border-[#850000]/50 rounded-lg px-4 py-3 text-white focus:border-[#850000] outline-none font-mono"
                  value={formData.costReal}
                  onChange={e => setFormData({ ...formData, costReal: e.target.value })}
                />
                <p className="text-[10px] text-gray-500 mt-1">*Usado no painel Financeiro</p>
              </div>
            )}
          </div>

  {/* 4. Valores por Modalidade (Novo Layout Compacto) */}
  {formData.type === 'hora_aula' && (
    <div className="bg-[#1a1a1a] border border-[#323238] rounded-lg p-4">
      <label className="text-sm text-gray-400 mb-3 block">
        Valores Diferenciados
        <span className="text-xs text-gray-500 block mt-1">
          Adicione apenas se o valor for diferente do padrão ({formData.value || '0'}/h).
        </span>
      </label>
      
      {/* Lista de Valores JÁ Adicionados */}
      <div className="space-y-2 mb-4">
        {Object.entries(formData.valuesByArea || {}).map(([area, val]) => (
          <div key={area} className="flex items-center justify-between bg-[#29292e] border border-[#323238] rounded-lg p-2 pl-3">
            <span className="text-white text-sm">{area}</span>
            <div className="flex items-center gap-3">
              <span className="text-brand-red font-mono text-sm">R$ {parseFloat(val).toFixed(2)}</span>
              <button
                type="button"
                onClick={() => handleRemoveAreaValue(area)}
                className="text-gray-500 hover:text-red-500 p-1"
                title="Remover"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {Object.keys(formData.valuesByArea || {}).length === 0 && (
           <p className="text-xs text-gray-600 italic">Nenhuma modalidade específica adicionada.</p>
        )}
      </div>

      {/* Área de Adicionar Nova */}
      <div className="flex gap-2 items-end pt-2 border-t border-[#323238]">
        {/* Seletor ou Input de Nome */}
        <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Modalidade</label>
            {!isCreatingNewArea ? (
                <select
                    className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-3 py-2 text-white text-sm focus:border-[#850000] outline-none"
                    value={selectedAreaToAdd}
                    onChange={(e) => {
                        if(e.target.value === '__novo__') setIsCreatingNewArea(true);
                        else setSelectedAreaToAdd(e.target.value);
                    }}
                >
                    <option value="">Selecione...</option>
                    {availableAreas
                        .filter(area => !formData.valuesByArea?.[area]) // Esconde as que já foram add
                        .map(area => (
                        <option key={area} value={area}>{area}</option>
                    ))}
                    <option value="__novo__" className="text-[#850000] font-bold">+ Nova Modalidade</option>
                </select>
            ) : (
                <div className="flex gap-1">
                    <input 
                        type="text" 
                        placeholder="Nome da modalidade"
                        className="w-full bg-[#1a1a1a] border border-[#850000] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                        value={newAreaName}
                        onChange={e => setNewAreaName(e.target.value)}
                        autoFocus
                    />
                    <button type="button" onClick={() => setIsCreatingNewArea(false)} className="text-gray-400 hover:text-white px-2">
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>

        {/* Input de Valor */}
        <div className="w-24">
            <label className="text-xs text-gray-500 mb-1 block">Valor (R$)</label>
            <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-[#850000] outline-none"
                value={customAreaValue}
                onChange={e => setCustomAreaValue(e.target.value)}
            />
        </div>

        {/* Botão Adicionar */}
        <button
            type="button"
            onClick={handleAddAreaValue}
            className="bg-[#323238] hover:bg-[#850000] text-white p-2 rounded-lg transition-colors h-[38px] w-[38px] flex items-center justify-center"
            title="Adicionar Valor"
        >
            <Plus size={18} />
        </button>
      </div>
    </div>
  )}

  {/* 5. Botões */}
  <div className="flex gap-3 pt-4">
    <button
      type="button"
      onClick={() => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: '', role: '', type: 'hora_aula', value: '', phone: '', active: true, valuesByArea: {} });
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
      {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
    </button>
  </div>
</form>
          </div>
        </div>
      )}
      {/* Modal de Gerenciamento de Cargos */}
      {isRoleManagerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="text-[#850000]" size={20} />
                Gerenciar Cargos
              </h3>
              <button onClick={() => setIsRoleManagerOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {availableRoles.map(role => (
                <div key={role} className="flex items-center justify-between bg-[#1a1a1a] p-3 rounded-lg border border-[#323238] group hover:border-gray-600 transition-colors">

                  {/* Modo Edição vs Modo Visualização */}
                  {editingRoleOriginalName === role ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input 
                        autoFocus
                        type="text" 
                        value={editingRoleNewName}
                        onChange={(e) => setEditingRoleNewName(e.target.value)}
                        className="bg-[#29292e] text-white text-sm px-2 py-1 rounded border border-[#850000] outline-none flex-1"
                      />
                      <button onClick={handleUpdateRoleName} className="text-green-500 hover:text-green-400 p-1"><Check size={18} /></button>
                      <button onClick={() => setEditingRoleOriginalName(null)} className="text-red-500 hover:text-red-400 p-1"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-sm">{role}</span>
                        <span className="text-xs text-gray-500 bg-[#29292e] px-2 py-0.5 rounded-full border border-[#323238]">
                          {getRoleUsageCount(role)} func.
                        </span>
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingRoleOriginalName(role);
                            setEditingRoleNewName(role);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#323238] rounded"
                          title="Renomear"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteRole(role)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-900/20 rounded"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar Rápido */}
            <div className="mt-4 pt-4 border-t border-[#323238]">
              <p className="text-xs text-gray-500 mb-2">Para adicionar um novo cargo, utilize o botão "Novo Cadastro" na tela principal.</p>
              <button 
                onClick={() => setIsRoleManagerOpen(false)}
                className="w-full bg-[#323238] hover:bg-[#3a3a40] text-white py-2 rounded-lg font-medium transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Documentos */}
      {isDocumentsModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-8 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">Documentos</h3>
                <p className="text-gray-400 text-sm mt-1">{selectedEmployee.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsDocumentsModalOpen(false);
                  setSelectedEmployee(null);
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Área de Upload */}
            <div className="bg-[#1a1a1a] border-2 border-dashed border-[#323238] rounded-xl p-8 text-center mb-6 hover:border-[#850000]/50 transition-all cursor-pointer">
              <FileText className="mx-auto text-gray-400 mb-3" size={40} />
              <p className="text-white font-medium mb-1">Arraste arquivos ou clique para fazer upload</p>
              <p className="text-gray-400 text-sm">PDF, imagens ou documentos (máx. 10MB)</p>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
              />
            </div>

            {/* Lista de Documentos (placeholder) */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-3">Documentos anexados:</p>

              {/* Exemplo de documento (será dinâmico depois) */}
              <div className="bg-[#1a1a1a] border border-[#323238] rounded-lg p-4 flex items-center justify-between hover:border-[#850000]/30 transition-all">
                <div className="flex items-center gap-3">
                  <FileText className="text-[#850000]" size={20} />
                  <div>
                    <p className="text-white text-sm font-medium">Contrato de Trabalho.pdf</p>
                    <p className="text-gray-400 text-xs">Enviado em 07/02/2026</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white">
                    👁️
                  </button>
                  <button className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400">
                    🗑️
                  </button>
                </div>
              </div>

              {/* Mensagem quando vazio */}
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  Nenhum documento enviado ainda.
                  <br />
                  <span className="text-xs">A funcionalidade completa de upload será implementada em breve.</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsDocumentsModalOpen(false);
                setSelectedEmployee(null);
              }}
              className="w-full mt-6 bg-[#323238] hover:bg-[#3a3a40] text-white py-3 rounded-lg font-medium transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Employees;