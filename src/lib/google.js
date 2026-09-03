// ==========================================================================
// OAuth do Google via Google Identity Services (fluxo de token, no navegador).
//
// RESTAURADO do commit c497c1c ("chore: remove integracoes Calendar/Moodle/
// Classroom", 16/07/2026), que apagou 1569 linhas porque as integracoes "so
// tinham funcao de notificar, que agora e feito por push nativo". A remocao
// estava certa naquele objetivo. O objetivo agora e outro: em 02/09/2026 o
// Hunter nomeou a causa da nao-adesao — o dia dele nao aparece no app — e a
// atividade da faculdade e metade desse dia.
//
// O QUE ESTE FLUXO NAO FAZ, e por que isso e aceitavel aqui.
// `initTokenClient` devolve access token e NENHUM refresh token. Ou seja: nao
// da pra rodar no servidor as 6:50 sem o Hunter. Ele sincroniza quando o app
// abre. Para REUNIAO isso seria inutil (reuniao das 10h precisa estar la antes
// de ele abrir), e por isso reuniao vai por cron + iCal no servidor. Para
// ATIVIDADE serve: prazo tem dias de folga, entao pegar na primeira abertura
// do dia chega na hora.
//
// O caminho server-side existe (codigo de autorizacao com access_type=offline)
// e custa: redirect URI registrado no console do Google e client secret
// guardado. Fica pra quando o ganho justificar.
//
// ESCOPO MAIS ESTREITO QUE O ORIGINAL: o antigo pedia `calendar` (leitura E
// escrita da agenda) e `classroom.announcements.readonly`, e nao usa nenhum dos
// dois aqui. Pedir escrita na agenda pra ler atividade e pedir o que nao se vai
// usar.
// ==========================================================================
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
].join(' ');

let gisReady = false;
let tokenClient = null;
let cachedToken = null;
let tokenExpiresAt = 0;

export const googleConfigurado = () => !!CLIENT_ID;

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (gisReady) return resolve();
    const existente = document.getElementById('google-gis-script');
    if (existente) {
      // Script no ar mas ainda carregando: espera a API aparecer em vez de
      // injetar de novo.
      const t = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(t); gisReady = true; resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(t); reject(new Error('GIS demorou demais')); }, 10000);
      return;
    }
    const s = document.createElement('script');
    s.id = 'google-gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => { gisReady = true; resolve(); };
    s.onerror = () => reject(new Error('nao consegui carregar o Google Identity Services'));
    document.head.appendChild(s);
  });
}

const tokenValido = () => cachedToken && Date.now() < tokenExpiresAt - 30000;

function pedeToken(prompt = '') {
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        cachedToken = r.access_token;
        tokenExpiresAt = Date.now() + (r.expires_in || 3600) * 1000;
        resolve(cachedToken);
      },
      error_callback: (e) => reject(new Error(e?.message || 'erro de OAuth')),
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

/**
 * Token de acesso. `silencioso: true` NUNCA abre popup: serve pro sync
 * automatico na abertura do app, que nao pode roubar o foco do usuario.
 * Sem token em cache, ele lanca e quem chamou engole.
 */
export async function pegaToken({ silencioso = false } = {}) {
  if (tokenValido()) return cachedToken;
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID nao configurado');
  if (silencioso) throw new Error('sem token em cache');
  await loadGIS();
  // Tenta sem prompt; se o consentimento ainda nao existe, ai sim pede.
  try { return await pedeToken(''); }
  catch { return await pedeToken('consent'); }
}

export function limpaToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/** GET numa API do Google, com o token corrente. */
export async function gGet(url, opts = {}) {
  const token = await pegaToken(opts);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${new URL(url).pathname} devolveu ${r.status}`);
  return r.json();
}
