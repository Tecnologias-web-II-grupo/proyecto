const TOKEN_KEY = 'api_factura_portal_token';

export function getToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(token){ token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); }

export async function api(path, options={}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) { const error=new Error(data?.detalle || data?.error || `HTTP ${response.status}`); error.data=data; error.status=response.status; throw error; }
  return data;
}
