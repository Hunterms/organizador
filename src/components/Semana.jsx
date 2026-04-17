import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { generateReviewSchedule, getDateKey } from '../store';

function urgencyMeta(d) {
  if (d < 7) return { label: 'Urgente', cls: 'urgency-high', Icon: AlertTriangle };
  if (d < 14) return { label: 'Em breve', cls: 'urgency-mid', Icon: Clock };
  return { label: 'Tranquilo', cls: 'urgency-low', Icon: Calendar };
}

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const categoryDotColors = {
  estudos: 'bg-violet-500',
  trabalho: 'bg-blue-500',
  terreiro: 'bg-green-500',
  pessoal: 'bg-amber-500',
  casa: 'bg-pink-500',
};

function getWeekDays(offset = 0) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
}

// Alias the canonical local-timezone helper so we don't drift into UTC here.
const dateKey = getDateKey;

export default function Semana({ state }) {
  const [weekOffset, setWeekOffset] = useState(0);
  // Start focused on today so the "Hoje" panel is visible without a click.
  // Only resets when the user explicitly picks another day.
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const days = getWeekDays(weekOffset);
  const todayStr = dateKey(new Date());

  const upcomingExams = useMemo(() => {
    const now = new Date();
    return state.subjects
      .flatMap(s => s.exams.map(e => ({ ...e, subject: s.name })))
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);
  }, [state.subjects]);

  // Collect review dates for the week
  const reviewDatesMap = useMemo(() => {
    const map = {};
    state.subjects.forEach(s => {
      s.exams.forEach(e => {
        generateReviewSchedule(e.date).forEach(d => {
          if (!map[d]) map[d] = [];
          map[d].push(s.name);
        });
      });
    });
    return map;
  }, [state.subjects]);

  const getTasksForDay = (dayStr) => state.tasks.filter(t => t.date === dayStr);

  const getCategoryDots = (dayStr) => {
    const tasks = getTasksForDay(dayStr);
    const cats = [...new Set(tasks.map(t => t.category))];
    if (reviewDatesMap[dayStr]) cats.push('estudos');
    return [...new Set(cats)].slice(0, 4);
  };

  const hasExam = (dayStr) => state.subjects.some(s => s.exams.some(e => e.date === dayStr));
  const hasReview = (dayStr) => !!reviewDatesMap[dayStr];

  const selectedDayTasks = selectedDay ? getTasksForDay(dateKey(selectedDay)) : [];
  const selectedDayReviews = selectedDay ? (reviewDatesMap[dateKey(selectedDay)] || []) : [];

  return (
    <div className="section-gap animate-in">
      {/* Upcoming Exams Banner */}
      {upcomingExams.length > 0 && (
        <div className="card space-y-2">
          <p className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-400" aria-hidden="true" /> Provas proximas
          </p>
          {upcomingExams.map((exam, i) => {
            const daysUntil = Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24));
            const u = urgencyMeta(daysUntil);
            return (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <span className="text-zinc-300 truncate">{exam.subject} - {exam.name}</span>
                <span className={`${u.cls} text-xs font-medium whitespace-nowrap inline-flex items-center gap-1 shrink-0`}>
                  <u.Icon size={11} aria-hidden="true" />
                  {daysUntil}d
                  <span className="sr-only"> — {u.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(p => p - 1)} aria-label="Semana anterior" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-xl transition-colors">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="text-sm text-zinc-300 font-medium">
          {days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - {days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
        </span>
        <button onClick={() => setWeekOffset(p => p + 1)} aria-label="Proxima semana" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-xl transition-colors">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dk = dateKey(day);
          const isToday = dk === todayStr;
          const isSelected = selectedDay && dateKey(selectedDay) === dk;
          const dots = getCategoryDots(dk);
          const exam = hasExam(dk);
          const review = hasReview(dk);

          const label = `${day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${exam ? ' — tem prova' : review ? ' — tem revisao' : ''}${isToday ? ' — hoje' : ''}`;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              aria-label={label}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors min-h-[64px] ${
                isSelected ? 'bg-indigo-500/20 ring-1 ring-indigo-500' :
                isToday ? 'bg-[#27272a]' :
                'bg-[#1c1c22] hover:bg-[#27272a]'
              }`}
            >
              <span className="text-[10px] text-zinc-500" aria-hidden="true">{dayNames[i]}</span>
              <span className={`text-sm font-medium ${isToday ? 'text-indigo-400' : 'text-white'}`} aria-hidden="true">
                {day.getDate()}
              </span>
              {exam && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />}
              {review && !exam && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-500" aria-hidden="true" />}
              <div className="flex gap-0.5 mt-0.5" aria-hidden="true">
                {dots.map((cat, j) => (
                  <div key={j} className={`w-1.5 h-1.5 rounded-full ${categoryDotColors[cat] || 'bg-zinc-600'}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Prova</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500" /> Revisao</span>
      </div>

      {/* Selected Day */}
      {selectedDay && (
        <div className="space-y-2 animate-in">
          <h3 className="text-sm font-medium text-zinc-300">
            {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>

          {selectedDayReviews.length > 0 && (
            <div className="card-inner !p-3 border-l-[3px] border-l-violet-500">
              <p className="text-xs text-violet-300 font-medium">Revisao espaçada</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{selectedDayReviews.join(', ')}</p>
            </div>
          )}

          {selectedDayTasks.length === 0 && selectedDayReviews.length === 0 ? (
            <p className="text-xs text-zinc-600 py-6 text-center">Nenhuma tarefa nesse dia</p>
          ) : (
            selectedDayTasks.map(task => (
              <div key={task.id} className="card-inner !p-3 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${categoryDotColors[task.category] || 'bg-zinc-600'}`} />
                <div className="flex-1">
                  <p className={`text-sm ${task.done ? 'line-through text-zinc-500' : 'text-white'}`}>{task.title}</p>
                  {task.time && <p className="text-[11px] text-zinc-500 mt-0.5">{task.time}</p>}
                </div>
                <span className={`tag tag-${task.category} capitalize`}>{task.category}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
