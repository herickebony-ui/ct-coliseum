import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Plus, Search, Trash2, Edit2, FileText, X, Check, LayoutGrid, List as ListIcon, Settings, User, Clock, DollarSign } from 'lucide-react';
import { writeBatch } from 'firebase/firestore'; // Importante para atualização em massa
import { db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  // --- FICHA DO COLABORADOR (abas) ---
  const [activeEmployeeTab, setActiveEmployeeTab] = useState('dados'); // 'dados' | 'anexos' | 'historico'
  // --- DADOS EDITÁVEIS (vínculo) ---
  const [empAdmissionDate, setEmpAdmissionDate] = useState(''); // YYYY-MM-DD
  const [empExitDate, setEmpExitDate] = useState(''); // YYYY-MM-DD
  const [savingEmployeeMeta, setSavingEmployeeMeta] = useState(false);


  // --- ANEXOS ---
  const [empDocs, setEmpDocs] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  // --- HISTÓRICO (timeline) ---
  const [empHistory, setEmpHistory] = useState([]);
  const [historyNote, setHistoryNote] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  // --- TABS DA FICHA DO COLABORADOR ---
  const [employeeTab, setEmployeeTab] = useState('dados'); // 'dados' | 'anexos' | 'financeiro' | 'historico'

  // --- ANEXOS (Storage + Firestore) ---
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // --- GERENCIADOR DE CARGOS ---
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [editingRoleOriginalName, setEditingRoleOriginalName] = useState(null); // Qual cargo estamos editando
  const [editingRoleNewName, setEditingRoleNewName] = useState(''); // O novo nome

  // Contar uso dos cargos
  const getRoleUsageCount = (roleName) => {
    return employees.filter(e => e.role === roleName).length;
  };

  const handleUpdateRoleName = async () => {
    if (!editingRoleNewName.trim()) return;

    const oldName = editingRoleOriginalName;
    const newName = editingRoleNewName.trim();

    if (oldName === newName) {
      setEditingRoleOriginalName(null);
      setEditingRoleNewName('');
      return;
    }

    if (availableRoles.includes(newName)) {
      return alert("Já existe um cargo com este nome.");
    }

    const usage = getRoleUsageCount(oldName);

    if (!confirm(`Isso alterará o cargo de ${usage} funcionário(s) de "${oldName}" para "${newName}". Deseja continuar?`)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      // 1) cria o novo cargo no banco
      batch.set(doc(db, "roles", newName), { name: newName, updatedAt: new Date() }, { merge: true });

      // 2) atualiza todos os funcionários que tinham o cargo antigo
      const affectedEmployees = employees.filter(e => e.role === oldName);
      affectedEmployees.forEach(emp => {
        batch.update(doc(db, "employees", emp.id), { role: newName });
      });

      // 3) remove o cargo antigo do banco
      batch.delete(doc(db, "roles", oldName));

      await batch.commit();

      // refresh real
      await fetchEmployees();

      // se filtro tava no antigo, joga pro novo
      if (filterRole === oldName) setFilterRole(newName);

      setEditingRoleOriginalName(null);
      setEditingRoleNewName('');
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar cargos: " + error.message);
    }
    setLoading(false);
  };


  const handleDeleteRole = async (roleToDelete) => {
    const usage = getRoleUsageCount(roleToDelete);

    if (usage > 0) {
      return alert(`⚠️ AÇÃO BLOQUEADA\n\nExistem ${usage} funcionário(s) vinculados ao cargo "${roleToDelete}".\n\nAltere o cargo desses funcionários antes de excluir.`);
    }

    if (!confirm(`Excluir o cargo "${roleToDelete}" do banco de dados?`)) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "roles", roleToDelete));
      await fetchRolesFromDB();

      if (filterRole === roleToDelete) setFilterRole('all');
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir cargo: " + err.message);
    }
    setLoading(false);
  };


  // Estado de Visualização
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [filterRole, setFilterRole] = useState('all'); // Novo filtro de cargo
  const [filterEmployee, setFilterEmployee] = useState('all'); // Novo filtro de funcionário

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
  // --- ROLES NO FIRESTORE (FONTE DA VERDADE) ---
  const DEFAULT_ROLES = ['Instrutor', 'Recepção', 'Limpeza', 'Gerência'];

  const fetchRolesFromDB = async () => {
    const snap = await getDocs(collection(db, "roles"));
    let roles = snap.docs.map(d => d.id).filter(Boolean);

    // Se não existir nada no banco, seed padrão
    if (roles.length === 0) {
      const batch = writeBatch(db);
      DEFAULT_ROLES.forEach(r => {
        batch.set(doc(db, "roles", r), { name: r, createdAt: new Date() }, { merge: true });
      });
      await batch.commit();
      roles = [...DEFAULT_ROLES];
    }

    roles.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    setAvailableRoles(roles);
  };

  const syncRolesFromEmployees = async (empList) => {
    const roles = [...new Set(empList.map(e => e.role).filter(Boolean))];
    if (roles.length === 0) return;

    const batch = writeBatch(db);
    roles.forEach(r => {
      batch.set(doc(db, "roles", r), { name: r, updatedAt: new Date() }, { merge: true });
    });
    await batch.commit();
  };

  const [isAddingNewRole, setIsAddingNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [availableAreas, setAvailableAreas] = useState([
    'Musculação',
    'Cobertura gerência',
    'Recepção',
    'Limpeza',
    'Aulas Coletivas',
    'Funcional',
    'Espaço Kids'
  ]);

  // Carregar dados do Firebase
  const fetchEmployees = async () => {
    const querySnapshot = await getDocs(collection(db, "employees"));
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEmployees(list);

    // Sincroniza cargos encontrados nos funcionários para o Firestore (migração automática)
    await syncRolesFromEmployees(list);

    // Agora sim: carrega cargos do Firestore (fonte da verdade)
    await fetchRolesFromDB();


    // Extrair áreas únicas (buscar do Schedule)
    const shiftSnap = await getDocs(collection(db, "schedules"));
    const shiftList = shiftSnap.docs.map(doc => doc.data());
    const uniqueAreas = [...new Set(shiftList.map(s => s.area))].filter(Boolean);
    setAvailableAreas(prev => [...new Set([...prev, ...uniqueAreas])]);
  };


  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!isDocumentsModalOpen) return;
    if (!selectedEmployee?.id) return;

    // carrega anexos só quando estiver na aba
    if (employeeTab === 'anexos') {
      fetchEmployeeAttachments(selectedEmployee.id);
    }
  }, [isDocumentsModalOpen, selectedEmployee?.id, employeeTab]);


  useEffect(() => {
    if (isDocumentsModalOpen && selectedEmployee?.id) {
      setActiveEmployeeTab('dados');

      const created = selectedEmployee.createdAt?.seconds
        ? new Date(selectedEmployee.createdAt.seconds * 1000).toISOString().slice(0, 10)
        : '';

      setEmpAdmissionDate(selectedEmployee.admissionDate || created || '');
      setEmpExitDate(selectedEmployee.exitDate || '');

      fetchEmployeeDocs(selectedEmployee.id);
      fetchEmployeeHistory(selectedEmployee.id);
    }
  }, [isDocumentsModalOpen, selectedEmployee?.id]);


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
  // ------------------------
  // ANEXOS (employees/{id}/attachments + Storage)
  // ------------------------
  const formatBytes = (bytes = 0) => {
    if (!bytes || bytes <= 0) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const toDateTimeLabel = (ts) => {
    try {
      if (!ts) return "-";
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString("pt-BR");
      // caso venha como Date
      if (ts instanceof Date) return ts.toLocaleString("pt-BR");
      return "-";
    } catch {
      return "-";
    }
  };

  const fetchEmployeeAttachments = async (empId) => {
    if (!empId) return;
    setAttachmentsLoading(true);
    try {
      const q = query(
        collection(db, "employees", empId, "attachments"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttachments(list);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar anexos: " + err.message);
    }
    setAttachmentsLoading(false);
  };

  const handleUploadEmployeeAttachments = async (fileList) => {
    if (!selectedEmployee?.id) return;
    const empId = selectedEmployee.id;

    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploadingAttachments(true);
    try {
      for (const file of files) {
        const uid =
          (globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}_${Math.random().toString(16).slice(2)}`);

        const safeName = (file.name || "arquivo").replace(/[^\w.\-() ]/g, "_");
        const storagePath = `employees/${empId}/attachments/${uid}_${safeName}`;

        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        await addDoc(collection(db, "employees", empId, "attachments"), {
          name: file.name || safeName,
          url,
          storagePath,
          size: file.size || 0,
          contentType: file.type || "",
          createdAt: serverTimestamp(),
        });
      }

      await fetchEmployeeAttachments(empId);
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar anexo: " + err.message);
    }
    setUploadingAttachments(false);
  };

  
  const handleRemoveAttachment = async (att) => {
    if (!selectedEmployee?.id) return;
  
    const name = att?.name || "este anexo";
    if (!confirm(`Remover "${name}"?\n\nIsso apagará do Storage e do Firestore.`)) return;
  
    setLoading(true);
    try {
      // 1) apaga do Storage
      const storagePath =
        att?.storagePath ||
        att?.fullPath ||
        att?.path ||
        (att?.name ? `employees/${selectedEmployee.id}/attachments/${att.name}` : null);
  
      if (storagePath) {
        const fileRef = storageRef(storage, storagePath);
        await deleteObject(fileRef);
      }
  
      // 2) apaga do Firestore (subcoleção)
      if (!att?.id) throw new Error("Anexo sem ID no Firestore (att.id).");
      await deleteDoc(doc(db, "employees", selectedEmployee.id, "attachments", att.id));
  
    } catch (err) {
      console.error(err);
      alert("Erro ao remover anexo: " + err.message);
    }
  
    setLoading(false);
  };
  

  // ---------- helpers ----------
  const fmtDateTime = (ts) => {
    if (!ts) return '-';
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('pt-BR');
  };

  // ---------- ANEXOS ----------
  const fetchEmployeeDocs = async (empId) => {
    setDocLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "employees", empId, "documents"), orderBy("createdAt", "desc"))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmpDocs(list);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar anexos: " + e.message);
    }
    setDocLoading(false);
  };

  const handleUploadEmployeeDoc = async () => {
    if (!selectedEmployee?.id) return;
    if (!docFile) return alert("Selecione um arquivo.");

    setDocUploading(true);
    try {
      const safeName = `${Date.now()}_${docFile.name}`.replace(/\s+/g, "_");
      const storagePath = `employees/${selectedEmployee.id}/docs/${safeName}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, docFile);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "employees", selectedEmployee.id, "documents"), {
        name: docFile.name,
        url,
        storagePath,
        createdAt: serverTimestamp()
      });

      setDocFile(null);
      await fetchEmployeeDocs(selectedEmployee.id);
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar anexo: " + e.message);
    }
    setDocUploading(false);
  };

  const handleDeleteEmployeeDoc = async (docItem) => {
    if (!selectedEmployee?.id) return;
    if (!confirm(`Remover o anexo "${docItem?.name}"?`)) return;

    try {
      // 1) remove do storage
      if (docItem?.storagePath) {
        await deleteObject(ref(storage, docItem.storagePath));
      }

      // 2) remove do firestore
      await deleteDoc(doc(db, "employees", selectedEmployee.id, "documents", docItem.id));

      await fetchEmployeeDocs(selectedEmployee.id);
    } catch (e) {
      console.error(e);
      alert("Erro ao remover anexo: " + e.message);
    }
  };

  // ---------- HISTÓRICO ----------
  const fetchEmployeeHistory = async (empId) => {
    setHistoryLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "employees", empId, "history"), orderBy("createdAt", "desc"))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmpHistory(list);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar histórico: " + e.message);
    }
    setHistoryLoading(false);
  };

  const handleAddHistoryNote = async () => {
    if (!selectedEmployee?.id) return;
    const text = historyNote.trim();
    if (!text) return;

    try {
      await addDoc(collection(db, "employees", selectedEmployee.id, "history"), {
        type: "note",
        text,
        createdAt: serverTimestamp()
      });
      setHistoryNote('');
      await fetchEmployeeHistory(selectedEmployee.id);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar nota: " + e.message);
    }
  };

  const handleDeleteHistoryItem = async (item) => {
    if (!selectedEmployee?.id) return;
    if (!confirm("Remover esta nota do histórico?")) return;

    try {
      await deleteDoc(doc(db, "employees", selectedEmployee.id, "history", item.id));
      await fetchEmployeeHistory(selectedEmployee.id);
    } catch (e) {
      console.error(e);
      alert("Erro ao remover nota: " + e.message);
    }
  };

  const handleSaveEmployeeMeta = async () => {
    if (!selectedEmployee?.id) return;

    // REGRA: se tem data de saída, fica inativo
    const computedActive = empExitDate ? false : (selectedEmployee?.active ?? true);

    setSavingEmployeeMeta(true);
    try {
      await setDoc(
        doc(db, "employees", selectedEmployee.id),
        {
          admissionDate: empAdmissionDate || null,
          exitDate: empExitDate || null,
          active: computedActive,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // atualiza UI da ficha
      setSelectedEmployee(prev => ({
        ...prev,
        admissionDate: empAdmissionDate || null,
        exitDate: empExitDate || null,
        active: computedActive,
      }));

      // atualiza lista
      await fetchEmployees();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar datas: " + e.message);
    }
    setSavingEmployeeMeta(false);
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
            <div
              key={emp.id}
              onClick={() => {
                setSelectedEmployee(emp);
                setEmployeeTab('dados');
                setIsDocumentsModalOpen(true);
              }}
              className="bg-[#202024] border border-[#323238] rounded-2xl p-6 hover:border-[#850000]/30 transition-all group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-[#121214] border border-[#323238] flex items-center justify-center text-xl font-bold text-gray-200">
                  {emp.name.charAt(0)}
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(emp); }}
                    className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setIsDocumentsModalOpen(true); }}
                    className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white"
                    title="Docs"
                  >
                    <FileText size={16} />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                    className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>
              </div>

              <h3 className="text-xl font-bold text-white">{emp.name}</h3>
              <p className="text-[#850000] text-sm font-medium uppercase tracking-wider mb-4">{emp.role}</p>

              <div className="space-y-2 text-sm text-gray-400 bg-[#121214]/50 p-4 rounded-xl border border-[#323238]/50">
                <div className="flex justify-between">
                  <span>Contrato:</span>
                  <span className="text-gray-200 capitalize">
                    {emp.type === 'mensalista' ? 'Mensalista (CLT)' : 'Hora Aula'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Base:</span>
                  <span className="text-gray-200 font-mono">
                    {emp.type === 'hora_aula' ? `R$ ${emp.value}/h` : `R$ ${emp.value}/mês`}
                  </span>
                </div>

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
                <tr
                  key={emp.id}
                  onClick={() => { setSelectedEmployee(emp); setIsDocumentsModalOpen(true); }}
                  className="hover:bg-[#29292e] transition-colors cursor-pointer"
                >
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
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(emp); }} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white" title="Editar"><Edit2 size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setIsDocumentsModalOpen(true); }} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white" title="Docs"><FileText size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }} className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-400" title="Excluir"><Trash2 size={16} /></button>
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
                          onClick={async () => {
                            const roleName = newRoleName.trim();
                            if (!roleName) return;

                            // trava duplicado
                            if (availableRoles.includes(roleName)) {
                              alert("Já existe um cargo com este nome.");
                              return;
                            }

                            setLoading(true);
                            try {
                              await setDoc(doc(db, "roles", roleName), { name: roleName, createdAt: new Date() }, { merge: true });

                              // atualiza UI
                              await fetchRolesFromDB();
                              setFormData({ ...formData, role: roleName });

                              setNewRoleName('');
                              setIsAddingNewRole(false);
                            } catch (err) {
                              console.error(err);
                              alert("Erro ao criar cargo: " + err.message);
                            }
                            setLoading(false);
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
                            if (e.target.value === '__novo__') setIsCreatingNewArea(true);
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
      {/* --- MODAL PRONTUÁRIO COMPLETO --- */}
      {isDocumentsModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121214] border border-[#323238] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

            {/* 1. Cabeçalho Fixo */}
            <div className="bg-[#202024] p-6 border-b border-[#323238] flex justify-between items-start shrink-0">
              <div className="flex gap-5">
                <div className="w-16 h-16 rounded-full bg-[#121214] border-2 border-[#850000] flex items-center justify-center text-3xl font-bold text-white shadow-[0_0_15px_rgba(133,0,0,0.3)]">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedEmployee.name}</h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm">
                    <span className="text-[#850000] font-bold uppercase tracking-wider bg-[#850000]/10 px-2 py-0.5 rounded border border-[#850000]/20">{selectedEmployee.role}</span>
                    <span className="text-gray-600">|</span>
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${selectedEmployee.active ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                      <div className={`w-2 h-2 rounded-full ${selectedEmployee.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      {selectedEmployee.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setIsDocumentsModalOpen(false); setSelectedEmployee(null); }}
                className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-[#323238] transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* 2. Corpo com Sidebar */}
            <div className="flex-1 flex overflow-hidden">
              {/* Menu Lateral */}
              <div className="w-64 bg-[#1a1a1a] border-r border-[#323238] p-4 space-y-2 shrink-0 overflow-y-auto">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-2">Menu</div>

                <button
                  onClick={() => setEmployeeTab('dados')}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm flex items-center gap-3 transition-all
      ${employeeTab === 'dados'
                      ? 'bg-[#202024] border-[#323238] text-white font-medium shadow-sm'
                      : 'hover:bg-[#202024] border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                  <User size={18} className={employeeTab === 'dados' ? 'text-[#850000]' : ''} /> Dados
                </button>

                <button
                  onClick={() => setEmployeeTab('anexos')}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm flex items-center gap-3 transition-all
      ${employeeTab === 'anexos'
                      ? 'bg-[#202024] border-[#323238] text-white font-medium shadow-sm'
                      : 'hover:bg-[#202024] border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                  <FileText size={18} className={employeeTab === 'anexos' ? 'text-[#850000]' : ''} /> Anexos
                </button>

                <button
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#202024] text-gray-400 hover:text-white font-medium text-sm flex items-center gap-3 transition-all opacity-50 cursor-not-allowed"
                  title="Em breve"
                >
                  <DollarSign size={18} /> Financeiro
                </button>

                <button
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#202024] text-gray-400 hover:text-white font-medium text-sm flex items-center gap-3 transition-all opacity-50 cursor-not-allowed"
                  title="Em breve"
                >
                  <Clock size={18} /> Histórico
                </button>
              </div>


              {/* Área Principal */}
              <div className="flex-1 p-8 overflow-y-auto bg-[#121214] custom-scrollbar">

                {/* ---------------- DADOS ---------------- */}
                {employeeTab === 'dados' && (
                  <>
                    {/* Cartões de Resumo */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-[#202024] p-4 rounded-xl border border-[#323238]">
                        <label className="text-xs text-gray-500 uppercase font-bold">Telefone</label>
                        <p className="text-white font-medium mt-1">{selectedEmployee.phone || '-'}</p>
                      </div>
                      <div className="bg-[#202024] p-4 rounded-xl border border-[#323238]">
                        <label className="text-xs text-gray-500 uppercase font-bold">Contrato</label>
                        <p className="text-white font-medium mt-1 capitalize">{selectedEmployee.type?.replace('_', ' ')}</p>
                      </div>
                      <div className="bg-[#202024] p-4 rounded-xl border border-[#323238] relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-3 opacity-10">
                          <DollarSign size={40} className="text-green-500" />
                        </div>
                        <label className="text-xs text-gray-500 uppercase font-bold">Base Salarial</label>
                        <p className="text-green-400 font-bold font-mono mt-1 text-lg">
                          {selectedEmployee.type === 'hora_aula' ? `R$ ${selectedEmployee.value}/h` : `R$ ${selectedEmployee.value}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      {/* Coluna Esquerda: Detalhes */}
                      <div className="flex-1 space-y-6">
                        <div className="bg-[#202024] rounded-xl border border-[#323238] p-5">
                          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <Settings size={18} className="text-gray-400" />
                            Detalhes do Contrato
                          </h3>
                          <div className="space-y-4">
                            <div className="flex justify-between border-b border-[#323238] pb-2">
                              <span className="text-gray-400 text-sm">Data de Admissão</span>
                              <span className="text-white text-sm font-medium">
                                {selectedEmployee.createdAt?.seconds
                                  ? new Date(selectedEmployee.createdAt.seconds * 1000).toLocaleDateString('pt-BR')
                                  : 'Não registrado'}
                              </span>
                            </div>

                            {selectedEmployee.type === 'mensalista' && (
                              <div className="flex justify-between border-b border-[#323238] pb-2">
                                <span className="text-gray-400 text-sm">Custo Real (Empresa)</span>
                                <span className="text-[#850000] text-sm font-mono font-bold">R$ {selectedEmployee.costReal || '0.00'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Coluna Direita: Obs */}
                      <div className="flex-1">
                        <div className="bg-[#202024] rounded-xl border border-[#323238] p-5 h-full flex flex-col">
                          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-gray-400" />
                            Anotações Internas
                          </h3>
                          <textarea
                            className="flex-1 bg-[#121214] border border-[#323238] rounded-lg p-3 text-gray-300 text-sm outline-none focus:border-[#850000] resize-none"
                            placeholder="(Por enquanto só informativo aqui)"
                            disabled
                          ></textarea>
                          <button
                            disabled
                            className="mt-3 bg-[#323238] text-white py-2 rounded-lg text-sm font-medium transition-colors opacity-50 cursor-not-allowed"
                          >
                            Salvar Nota
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ---------------- ANEXOS ---------------- */}
                {employeeTab === 'anexos' && (
                  <div className="space-y-4">
                    <div className="bg-[#202024] border border-[#323238] rounded-xl p-5">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-white font-bold flex items-center gap-2">
                          <FileText size={18} className="text-gray-400" />
                          Anexos do Colaborador
                        </h3>

                        <label
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#323238] bg-[#121214] text-white text-sm cursor-pointer hover:border-[#850000] transition-all
              ${uploadingAttachments ? 'opacity-50 pointer-events-none' : ''}`}
                          title="Adicionar anexos"
                        >
                          <Plus size={16} />
                          {uploadingAttachments ? 'Enviando...' : 'Adicionar'}
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleUploadEmployeeAttachments(e.target.files)}
                          />
                        </label>
                      </div>

                      {attachmentsLoading ? (
                        <p className="text-gray-400 text-sm">Carregando anexos...</p>
                      ) : attachments.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">Nenhum anexo cadastrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {attachments.map(att => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between gap-3 bg-[#121214] border border-[#323238] rounded-lg p-3"
                            >
                              <div className="min-w-0">
                                <p className="text-white text-sm font-medium truncate">{att.name}</p>
                                <p className="text-gray-500 text-xs">
                                  {toDateTimeLabel(att.createdAt)} • {formatBytes(att.size)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {att.url && (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-[#202024] border border-[#323238] text-gray-200 text-xs hover:border-[#850000] transition-all"
                                  >
                                    Abrir
                                  </a>
                                )}

                                <button
                                  onClick={() => handleRemoveAttachment(att)}
                                  className="px-3 py-1.5 rounded-lg bg-red-900/10 border border-red-900/30 text-red-400 text-xs hover:bg-red-900/20 transition-all"
                                  title="Remover anexo"
                                  disabled={loading}
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-600">
                      *Salva em: <span className="font-mono">employees/{selectedEmployee?.id}/attachments</span> (Firestore) e Storage.
                    </p>
                  </div>
                )}
              </div>


            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Employees;