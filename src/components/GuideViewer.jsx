import { useEffect, useState } from 'react';
import { getGuide } from '../store';
import { X, Loader2, BookOpen } from 'lucide-react';

// Fullscreen viewer for a task's study guide. The guide is a standalone HTML
// document (with its own styles + MathJax), rendered isolated in an iframe.
export default function GuideViewer({ guideId, onClose }) {
  const [s, setS] = useState({ loading: true, html: '', title: '', error: false });

  useEffect(() => {
    let alive = true;
    getGuide(guideId)
      .then(g => { if (alive) setS({ loading: false, html: g.html, title: g.title, error: false }); })
      .catch(e => { console.error('guide load failed:', e); if (alive) setS({ loading: false, html: '', title: '', error: true }); });
    return () => { alive = false; };
  }, [guideId]);

  return (
    <div className="fixed inset-0 z-[60] bg-[#09090b] flex flex-col animate-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <p className="text-sm font-medium text-white flex items-center gap-2 min-w-0">
          <BookOpen size={15} className="text-indigo-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{s.title || 'Guia de estudo'}</span>
        </p>
        <button onClick={onClose} aria-label="Fechar guia"
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white shrink-0"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0">
        {s.loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-indigo-400" aria-label="Carregando" /></div>
        ) : s.error ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-sm text-red-300">Nao consegui carregar o guia. Confere a conexao.</p>
          </div>
        ) : (
          <iframe title={s.title} srcDoc={s.html} className="w-full h-full border-0"
            sandbox="allow-scripts allow-popups" />
        )}
      </div>
    </div>
  );
}
