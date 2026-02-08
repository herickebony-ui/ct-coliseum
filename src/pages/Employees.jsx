import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Plus, Search, Trash2, Edit2, FileText, X, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    type: 'hora_aula',
    value: '',
    phone: '',
    active: true,
    valuesByArea: {} // Valores personalizados por área
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
      if (editingId) {
        // EDITAR funcionário existente
        await setDoc(doc(db, "employees", editingId), {
          ...formData,
          value: parseFloat(formData.value),
          updatedAt: new Date()
        }, { merge: true });
      } else {
        // CRIAR novo funcionário
        await addDoc(collection(db, "employees"), {
          ...formData,
          value: parseFloat(formData.value),
          createdAt: new Date()
        });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', role: '', type: 'hora_aula', value: '', phone: '', active: true });
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white">Funcionários</h2>
          <p className="text-ice-400 mt-1">Gerencie sua equipe, cargos e custos.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-red hover:bg-red-700 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-neon"
        >
          <Plus size={20} />
          Novo Cadastro
        </button>
      </div>

      {/* Lista de Funcionários (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => (
          <div key={emp.id} className="bg-ebony-800 border border-ebony-700 rounded-2xl p-6 hover:border-brand-red/30 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-ebony-950 border border-ebony-700 flex items-center justify-center text-xl font-bold text-ice-200">
                {emp.name.charAt(0)}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(emp)}
                  className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setIsDocumentsModalOpen(true);
                  }}
                  className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white"
                  title="Documentos"
                >
                  <FileText size={18} />
                </button>
                <button
                  onClick={() => handleDelete(emp.id)}
                  className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white">{emp.name}</h3>
            <p className="text-brand-red text-sm font-medium uppercase tracking-wider mb-4">{emp.role}</p>

            <div className="space-y-2 text-sm text-ice-400 bg-ebony-950/50 p-4 rounded-xl border border-ebony-700/50">
              <div className="flex justify-between">
                <span>Contrato:</span>
                <span className="text-ice-200 capitalize">{emp.type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Base:</span>
                <span className="text-ice-200 font-mono">
                  {emp.type === 'hora_aula' ? `R$ ${emp.value}/h` : `R$ ${emp.value}/mês`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

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

  {/* 3. Valor Base */}
  <div>
    <label className="block text-sm text-gray-400 mb-1">
      {formData.type === 'hora_aula' ? 'Valor Padrão (R$/hora)' : 'Salário Fixo (R$/mês)'}
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