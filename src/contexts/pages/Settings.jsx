import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Clock, Save, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DIAS_SEMANA = [
  { id: 'segunda', label: 'Segunda-feira' },
  { id: 'terca', label: 'Terça-feira' },
  { id: 'quarta', label: 'Quarta-feira' },
  { id: 'quinta', label: 'Quinta-feira' },
  { id: 'sexta', label: 'Sexta-feira' },
  { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' }
];

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [horarios, setHorarios] = useState({
    segunda: { abertura: '06:00', fechamento: '22:00', fechado: false },
    terca: { abertura: '06:00', fechamento: '22:00', fechado: false },
    quarta: { abertura: '06:00', fechamento: '22:00', fechado: false },
    quinta: { abertura: '06:00', fechamento: '22:00', fechado: false },
    sexta: { abertura: '06:00', fechamento: '22:00', fechado: false },
    sabado: { abertura: '08:00', fechamento: '18:00', fechado: false },
    domingo: { abertura: '08:00', fechamento: '14:00', fechado: true }
  });

  // Carregar configurações
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      const docRef = doc(db, 'settings', 'horarios_funcionamento');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setHorarios(docSnap.data());
      }
      setLoading(false);
    };
    loadSettings();
  }, []);

  // Atualizar horário específico
  const handleChange = (dia, campo, valor) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [campo]: valor
      }
    }));
  };

  // Salvar no Firebase
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'horarios_funcionamento'), horarios);
      alert('Horários salvos com sucesso!');
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-400">Carregando configurações...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Configurações</h2>
        <p className="text-gray-400 mt-1">Defina os horários de funcionamento da academia</p>
      </div>

      {/* Alerta Informativo */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="text-blue-400 mt-0.5" size={20} />
        <div>
          <p className="text-blue-400 font-medium">Importante</p>
          <p className="text-gray-400 text-sm mt-1">
            Estes horários serão usados para validar as escalas. Não será possível criar turnos fora destes horários.
          </p>
        </div>
      </div>

      {/* Grid de Horários */}
      <div className="space-y-4">
        {DIAS_SEMANA.map(dia => (
          <div 
            key={dia.id} 
            className={`bg-[#29292e] border rounded-xl p-6 transition-all ${
              horarios[dia.id]?.fechado 
                ? 'border-red-500/30 opacity-60' 
                : 'border-[#323238] hover:border-[#850000]/30'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className={horarios[dia.id]?.fechado ? 'text-red-400' : 'text-[#850000]'} size={20} />
                <h3 className="text-lg font-bold text-white">{dia.label}</h3>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-400">Fechado</span>
                <input
                  type="checkbox"
                  checked={horarios[dia.id]?.fechado || false}
                  onChange={(e) => handleChange(dia.id, 'fechado', e.target.checked)}
                  className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#323238] checked:bg-[#850000] cursor-pointer"
                />
              </label>
            </div>

            {!horarios[dia.id]?.fechado && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Abertura</label>
                  <input
                    type="time"
                    value={horarios[dia.id]?.abertura || '06:00'}
                    onChange={(e) => handleChange(dia.id, 'abertura', e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fechamento</label>
                  <input
                    type="time"
                    value={horarios[dia.id]?.fechamento || '22:00'}
                    onChange={(e) => handleChange(dia.id, 'fechamento', e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#323238] rounded-lg px-4 py-3 text-white focus:border-[#850000] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botão Salvar */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#850000] hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save size={20} />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </MainLayout>
  );
};

export default Settings;