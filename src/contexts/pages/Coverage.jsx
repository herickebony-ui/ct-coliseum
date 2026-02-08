import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { BarChart3, Users, Clock, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h até 22h

const Coverage = () => {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

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

  // Contar pessoas em um horário específico
  const countPeople = (day, hour) => {
    return shifts.filter(shift => {
      if (shift.day !== day) return false;
      const start = parseInt(shift.start.split(':')[0]);
      const end = parseInt(shift.end.split(':')[0]);
      return hour >= start && hour < end;
    }).length;
  };

  // Pegar quem está trabalhando em um horário
  const getWorkingPeople = (day, hour) => {
    return shifts
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
          shift: shift
        };
      });
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

  // Estatísticas gerais
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
      {/* Cabeçalho */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Cobertura Semanal</h2>
        <p className="text-gray-400 mt-1">Visualização de cobertura por horário</p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center justify-center">
              <BarChart3 className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400">Cobertura Boa</p>
              <p className="text-2xl font-bold text-white">
                {DAYS.reduce((acc, day) => acc + HOURS.filter(hour => countPeople(day, hour) >= 3).length, 0)}h
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">3+ pessoas no salão</p>
        </div>

        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-yellow-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400">Cobertura Crítica</p>
              <p className="text-2xl font-bold text-white">{totalCriticalHours}h</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">Apenas 1 pessoa no salão</p>
        </div>

        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center justify-center">
              <Clock className="text-red-400" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400">Descoberto</p>
              <p className="text-2xl font-bold text-white">{totalEmptyHours}h</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">Nenhuma pessoa escalada</p>
        </div>
      </div>

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

      {/* Heatmap / Timeline */}
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
                  const count = countPeople(day, hour);
                  return (
                    <td 
                      key={`${day}-${hour}`} 
                      className="p-2 border-b border-r border-[#323238] text-center cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedCell({ day, hour })}
                    >
                      <div className={`${getCellColor(count)} border rounded-lg p-2 min-h-[50px] flex items-center justify-center`}>
                        <span className={`text-lg font-bold ${getCellTextColor(count)}`}>
                          {count}
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

      {/* Modal de Detalhes ao Clicar */}
      {selectedCell && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCell(null)}
        >
          <div 
            className="bg-[#29292e] border border-[#323238] rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {selectedCell.day} - {selectedCell.hour}h
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {getWorkingPeople(selectedCell.day, selectedCell.hour).length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="mx-auto text-red-400 mb-3" size={40} />
                <p className="text-gray-400">Nenhuma pessoa escalada neste horário</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getWorkingPeople(selectedCell.day, selectedCell.hour).map((person, idx) => (
                  <div key={idx} className="bg-[#1a1a1a] border border-[#323238] rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#29292e] border border-[#323238] flex items-center justify-center text-sm font-bold text-white">
                        {person.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-medium">{person.name}</p>
                        <p className="text-xs text-[#850000]">{person.area}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {person.shift.start} - {person.shift.end}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div> 
      )}
    </MainLayout>
  );
};

export default Coverage;