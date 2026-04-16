import { useState, useMemo } from 'react';
import { Droplets, Plus } from 'lucide-react';
import { getDateKey, setWaterLog as setWaterLogDb } from '../store';

export default function Agua({ state, updateState, userId }) {
  const today = getDateKey();
  const { weight, bottleSize, waterGoal } = state.settings;
  // Add one extra bottle slot so user can always register more water than goal
  const bottlesNeeded = Math.ceil(waterGoal / bottleSize) + 1;
  const currentBottles = state.water[today] || 0;
  const currentMl = currentBottles * bottleSize;
  const percentage = Math.min(100, Math.round((currentMl / waterGoal) * 100));
  const [animating, setAnimating] = useState(null);

  const toggleBottle = (index) => {
    setAnimating(index);
    setTimeout(() => setAnimating(null), 300);
    const newCount = currentBottles === index + 1 ? index : index + 1;
    updateState(prev => ({ ...prev, water: { ...prev.water, [today]: newCount } }));
    // Persist to Supabase — upsert on (user_id, date) so repeated taps update
    // the same row instead of stacking.
    if (userId) {
      setWaterLogDb(userId, today, newCount).catch(e => console.error('water sync failed:', e));
    }
  };

  const history = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = getDateKey(d);
      const bottles = state.water[key] || 0;
      const ml = bottles * bottleSize;
      const pct = Math.min(100, Math.round((ml / waterGoal) * 100));
      return {
        day: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
        ml, pct,
        metGoal: ml >= waterGoal,
        isToday: key === today,
      };
    });
  }, [state.water, today, bottleSize, waterGoal]);

  const circumference = 2 * Math.PI * 52;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="section-gap animate-in">
      {/* Main tracker */}
      <div className="card flex flex-col items-center py-10">
        <div className="relative w-40 h-40 mb-8">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${currentMl} de ${waterGoal}ml`}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#27272a" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#06b6d4" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <Droplets size={20} className="text-cyan-400" aria-hidden="true" />
            <span className="text-3xl font-bold text-white tracking-tight leading-none">{currentMl}</span>
            <span className="text-[11px] text-zinc-500">/ {waterGoal} ml</span>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-2">
          {percentage >= 100 ? 'Meta atingida! Parabens!' : `Faltam ${Math.max(0, waterGoal - currentMl)} ml`}
        </p>
        <p className="text-[11px] text-zinc-500 mb-12 text-center px-4 leading-relaxed">
          {weight}kg &rarr; {waterGoal}ml/dia &rarr; {Math.ceil(waterGoal / bottleSize)} garrafinhas de {bottleSize}ml
        </p>

        {/* Bottles */}
        <div className="grid grid-cols-5 gap-2 w-full px-1">
          {Array.from({ length: bottlesNeeded }, (_, i) => {
            const isFilled = i < currentBottles;
            const isExtra = i >= Math.ceil(waterGoal / bottleSize);
            const colorFill = isExtra ? 'border-cyan-400 bg-cyan-400/10' : 'border-cyan-500 bg-cyan-500/10';
            const innerFill = isExtra ? 'bg-cyan-400/50' : 'bg-cyan-500/45';
            return (
              <button key={i} onClick={() => toggleBottle(i)}
                aria-label={`Garrafinha ${i + 1}${isExtra ? ' (extra)' : ''}, ${isFilled ? 'cheia' : 'vazia'}. Clique para ${isFilled ? 'esvaziar' : 'encher'}.`}
                aria-pressed={isFilled}
                className={`relative pt-3 pb-1 flex flex-col items-center transition-transform active:scale-95 ${animating === i ? 'water-pulse' : ''}`}
              >
                <div className="relative">
                  <div className={`rounded-[14px] rounded-t-[10px] border-[1.5px] flex items-end overflow-hidden transition-colors ${
                    isFilled ? colorFill : 'border-zinc-700 bg-[#1f1f23]'
                  }`} style={{ width: '48px', height: '72px' }}>
                    <div className={`w-full transition-[height] duration-400 ease-out ${isFilled ? `${innerFill} h-full` : 'h-0'}`} />
                    {/* Water surface highlight */}
                    {isFilled && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-white/10 to-transparent" aria-hidden="true" />
                    )}
                  </div>
                  {/* Bottle cap */}
                  <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-3 rounded-t-md border-[1.5px] border-b-0 transition-colors ${
                    isFilled ? (isExtra ? 'border-cyan-400 bg-cyan-400/30' : 'border-cyan-500 bg-cyan-500/25') : 'border-zinc-700 bg-[#1f1f23]'
                  }`} aria-hidden="true" />
                </div>
                <p className="text-[10px] text-zinc-500 mt-3 text-center flex items-center gap-0.5" aria-hidden="true">
                  {isExtra && <Plus size={8} className="text-cyan-400/80" />}
                  {bottleSize}ml
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-700 mt-5">A ultima e bonus pra superar a meta</p>
      </div>

      {/* History */}
      <div className="card">
        <h3 className="text-sm font-medium text-white mb-6">Historico da semana</h3>
        <div className="grid grid-cols-7 gap-2">
          {history.map((day, i) => (
            <div key={i} className="flex flex-col items-center" aria-label={`${day.day}: ${day.ml}ml, ${day.metGoal ? 'meta atingida' : 'abaixo da meta'}`}>
              <div className="w-full h-24 bg-[#27272a] rounded-xl relative overflow-hidden flex items-end mb-2">
                <div
                  className={`w-full rounded-xl transition-[height] duration-500 ease-out ${day.metGoal ? 'bg-cyan-500/50' : day.pct > 0 ? 'bg-cyan-500/25' : ''}`}
                  style={{ height: `${day.pct}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium mb-0.5 ${day.isToday ? 'text-cyan-400' : 'text-zinc-500'}`}>{day.day}</span>
              <span className="text-[9px] text-zinc-600 tabular-nums">{day.ml > 0 ? `${day.ml}` : '-'}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-zinc-800/60 text-[10px]">
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500/50" aria-hidden="true" /> Meta atingida</span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500/25" aria-hidden="true" /> Abaixo da meta</span>
        </div>
      </div>
    </div>
  );
}
