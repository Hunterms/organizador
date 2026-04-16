import { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function Login() {
  const { signInWithMagicLink, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogle = async () => {
    setStatus('sending');
    setErrorMsg('');
    const { error } = await signInWithGoogle();
    if (error) {
      setStatus('error');
      setErrorMsg(error.message || 'Erro ao logar com Google');
    }
    // On success, page redirects automatically
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    const { error } = await signInWithMagicLink(email.trim());
    if (error) {
      setStatus('error');
      setErrorMsg(error.message || 'Erro ao enviar o link');
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-x">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">Organizador</h1>
          <p className="text-sm text-zinc-500">Entre pra continuar</p>
        </div>

        {status === 'sent' ? (
          <div className="card flex flex-col items-center text-center gap-4 py-10">
            <CheckCircle2 size={32} className="text-green-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-white mb-1">Link enviado!</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Confere seu email <span className="text-zinc-300">{email}</span> e clica no link pra entrar.
              </p>
            </div>
            <button onClick={() => { setStatus('idle'); setShowEmailLogin(false); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-2">
              Voltar
            </button>
          </div>
        ) : (
          <div className="card space-y-5">
            {/* Google login (primary) */}
            <button onClick={handleGoogle} disabled={status === 'sending'}
              className="w-full bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 font-medium py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-3 min-h-[48px]">
              {status === 'sending' ? (
                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Conectando...</>
              ) : (
                <><GoogleIcon size={18} /> Continuar com Google</>
              )}
            </button>

            {!showEmailLogin && (
              <button onClick={() => setShowEmailLogin(true)}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Ou usar email
              </button>
            )}

            {showEmailLogin && (
              <form onSubmit={handleEmail} className="space-y-4 pt-2 border-t border-zinc-800/60">
                <div>
                  <label htmlFor="login-email" className="text-xs text-zinc-500 mb-2 block">Email</label>
                  <input id="login-email" type="email" autoComplete="email" required
                    placeholder="voce@email.com" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-base" autoFocus />
                </div>
                <button type="submit" disabled={status === 'sending' || !email.trim()}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 text-white font-medium py-3 rounded-xl transition-colors text-xs flex items-center justify-center gap-2 min-h-[44px]">
                  <Mail size={14} aria-hidden="true" /> Receber link no email
                </button>
                <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
                  Vamos enviar um link magico — clique nele pra entrar.
                </p>
              </form>
            )}

            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-red-300 leading-relaxed">{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-zinc-700 text-center mt-8 leading-relaxed">
          Sua sessao fica salva por semanas. Voce so loga de novo se sair manualmente.
        </p>
      </div>
    </div>
  );
}
