import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { TrendingDown, Users, AlertCircle, Plus, Trash2, DollarSign } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';

const Financial = () => {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  // Lista de custos (agora começa vazia e vem do banco)
  const [fixedCosts, setFixedCosts] = useState([]);

  // Estados para novo custo
  const [newCostName, setNewCostName] = useState('');
  const [newCostValue, setNewCostValue] = useState('');

  const [ticketMedio, setTicketMedio] = useState(120);

  useEffect(() => {
    const fetchData = async () => {
      // Busca Funcionários
      const empSnap = await getDocs(collection(db, "employees"));
      setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Busca Escalas
      const shiftSnap = await getDocs(collection(db, "schedules"));
      setShifts(shiftSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Busca Custos Operacionais (NOVO)
      const costsSnap = await getDocs(collection(db, "operational_costs"));
      setFixedCosts(costsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // --- CÁLCULOS ---
  const calculatePersonnelCost = () => {
    let total = 0;
    const activeEmployees = employees.filter(emp => shifts.some(s => s.employeeId === emp.id));

    activeEmployees.forEach(emp => {
      // Se for CLT (mensalista), usa o custo real se existir, ou o valor base
      if (emp.type === 'mensalista') {
        // Prioriza o campo "custo real" (costReal), senão usa o "value" normal
        total += parseFloat(emp.costReal || emp.value) || 0;
      } else {
        // Horistas
        const empShifts = shifts.filter(s => s.employeeId === emp.id);
        const weeklyCost = empShifts.reduce((acc, shift) => {
          const start = parseInt(shift.start.split(':')[0]);
          const end = parseInt(shift.end.split(':')[0]);
          const val = emp.valuesByArea?.[shift.area] || parseFloat(emp.value) || 0;
          return acc + ((end - start) * val);
        }, 0);
        total += weeklyCost * 4.5;
      }
    });
    return total;
  };

  const personnelCost = calculatePersonnelCost();
  const operationalCost = fixedCosts.reduce((acc, item) => acc + item.value, 0);
  const totalCost = personnelCost + operationalCost;
  const breakEvenStudents = Math.ceil(totalCost / ticketMedio);

  // Adicionar novo custo (Salva no Firebase)
  const handleAddCost = async (e) => {
    e.preventDefault();
    if (!newCostName || !newCostValue) return;
    
    try {
      const docRef = await addDoc(collection(db, "operational_costs"), {
        name: newCostName,
        value: parseFloat(newCostValue)
      });
      // Atualiza a tela imediatamente
      setFixedCosts([...fixedCosts, { id: docRef.id, name: newCostName, value: parseFloat(newCostValue) }]);
      setNewCostName('');
      setNewCostValue('');
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar custo. Verifique o console.");
    }
  };

  // Remover custo (Remove do Firebase)
  const handleDeleteCost = async (id) => {
    try {
      await deleteDoc(doc(db, "operational_costs", id));
      setFixedCosts(fixedCosts.filter(item => item.id !== id));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  // Atualizar valor na Tela (enquanto digita)
  const handleCostChange = (id, newValue) => {
    setFixedCosts(fixedCosts.map(item => 
      item.id === id ? { ...item, value: parseFloat(newValue) || 0 } : item
    ));
  };

  // Salvar Edição no Banco (ao sair do campo)
  const saveCostToDb = async (id, value) => {
    try {
      const costRef = doc(db, "operational_costs", id);
      await updateDoc(costRef, { value: parseFloat(value) });
    } catch (error) {
      console.error("Erro ao atualizar:", error);
    }
  };

  return (
    <MainLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Painel Financeiro</h2>
        <p className="text-gray-400">Custos operacionais e ponto de equilíbrio.</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#29292e] p-6 rounded-2xl border border-[#323238] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#850000] opacity-10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <p className="text-gray-400 text-sm mb-1">Custo Total Previsto</p>
          <h3 className="text-3xl font-bold text-white">R$ {totalCost.toLocaleString('pt-BR')}</h3>
          <div className="mt-4 flex gap-2 text-xs">
            <span className="bg-[#1a1a1a] px-2 py-1 rounded text-gray-400 border border-[#323238]">Pessoal: {((personnelCost/totalCost)*100).toFixed(0)}%</span>
            <span className="bg-[#1a1a1a] px-2 py-1 rounded text-gray-400 border border-[#323238]">Fixo: {((operationalCost/totalCost)*100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="bg-[#29292e] p-6 rounded-2xl border border-[#323238]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Ponto de Equilíbrio</p>
              <h3 className="text-3xl font-bold text-[#850000]">{breakEvenStudents} Alunos</h3>
            </div>
            <Users className="text-[#850000]" opacity={0.5} />
          </div>
          <div className="mt-4">
            <label className="text-xs text-gray-500 block mb-1">Ticket Médio (Simulação)</label>
            <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 rounded border border-[#323238] w-32">
              <span className="text-gray-400 text-xs pl-2">R$</span>
              <input 
                type="number" 
                value={ticketMedio} 
                onChange={(e) => setTicketMedio(e.target.value)}
                className="bg-transparent text-white w-full outline-none text-sm font-bold"
              />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#202024] p-6 rounded-2xl border border-[#323238]">
           <div className="flex items-center gap-3 mb-4">
             <AlertCircle className="text-yellow-500" />
             <h4 className="font-bold text-white">Diária Necessária</h4>
           </div>
           <p className="text-sm text-gray-400">
             Sua meta diária de faturamento para não ter prejuízo é de aprox. <strong className="text-white">R$ {(totalCost/30).toLocaleString('pt-BR', {maximumFractionDigits: 0})}</strong> (todos os dias).
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tabela Editável de Custos Fixos */}
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <TrendingDown className="text-red-400" size={20} />
            Custos Operacionais Fixos
          </h3>
          
          {/* Formulário de Adição */}
          <form onSubmit={handleAddCost} className="flex gap-2 mb-4 p-3 bg-[#1a1a1a] rounded-lg border border-[#323238] border-dashed">
            <input 
              type="text" 
              placeholder="Nome do custo (ex: Contador)" 
              value={newCostName}
              onChange={e => setNewCostName(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
            />
            <input 
              type="number" 
              placeholder="Valor" 
              value={newCostValue}
              onChange={e => setNewCostValue(e.target.value)}
              className="w-24 bg-transparent text-white text-sm outline-none text-right placeholder-gray-600 border-l border-[#323238] pl-2"
            />
            <button type="submit" className="bg-[#323238] hover:bg-[#850000] text-white p-1 rounded transition-colors">
              <Plus size={18} />
            </button>
          </form>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {fixedCosts.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#323238] group">
                <span className="text-gray-300 text-sm">{item.name}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-xs">R$</span>
                    <input
                      type="number"
                      value={item.value}
                      onChange={(e) => handleCostChange(item.id, e.target.value)}
                      onBlur={() => saveCostToDb(item.id, item.value)}
                      className="bg-transparent text-white text-right font-mono font-medium outline-none w-20 border-b border-transparent focus:border-[#850000] transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => handleDeleteCost(item.id)}
                    className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="pt-4 mt-4 border-t border-[#323238] flex justify-between items-center">
            <span className="text-white font-bold">Total Operacional</span>
            <span className="text-white font-bold text-lg">R$ {operationalCost.toLocaleString('pt-BR')}</span>
          </div>
        </div>

        {/* Resumo de Pessoal */}
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Users className="text-blue-400" size={20} />
            Resumo de Pessoal
          </h3>
          
          <div className="overflow-hidden rounded-lg border border-[#323238]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className="p-3 text-xs text-gray-400 uppercase">Cargo</th>
                  <th className="p-3 text-xs text-gray-400 uppercase text-right">Custo Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#323238]">
                {Object.entries(employees.reduce((acc, emp) => {
                  if (!shifts.some(s => s.employeeId === emp.id)) return acc;
                  let cost = 0;
                  if (emp.type === 'mensalista') {
                    // Aqui está a mágica: usa o Custo Real se houver, senão usa o valor base
                    cost = parseFloat(emp.costReal || emp.value) || 0;
                  } else {
                     const weekly = shifts
                      .filter(s => s.employeeId === emp.id)
                      .reduce((sum, s) => {
                        const val = emp.valuesByArea?.[s.area] || parseFloat(emp.value) || 0;
                        const h = parseInt(s.end) - parseInt(s.start);
                        return sum + (h * val);
                      }, 0);
                     cost = weekly * 4.5;
                  }
                  acc[emp.role] = (acc[emp.role] || 0) + cost;
                  return acc;
                }, {})).map(([role, value]) => (
                  <tr key={role} className="bg-[#29292e]">
                    <td className="p-3 text-white text-sm capitalize">{role}</td>
                    <td className="p-3 text-right text-blue-300 font-mono text-sm">R$ {value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#1a1a1a]">
                 <tr>
                    <td className="p-3 text-white font-bold">Total Folha</td>
                    <td className="p-3 text-right text-blue-400 font-bold font-mono">R$ {personnelCost.toLocaleString('pt-BR')}</td>
                 </tr>
              </tfoot>
            </table>
          </div>
           <p className="text-xs text-gray-500 mt-4 bg-[#1a1a1a] p-3 rounded border border-[#323238]">
             ℹ️ O cálculo de pessoal considera automaticamente o "Custo Real" para mensalistas (se cadastrado) e horas escaladas para horistas.
           </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Financial;