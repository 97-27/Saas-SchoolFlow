/**
 * ══════════════════════════════════════════════════════════════════
 * SESSION SERVEUR SIGNÉE (HMAC-SHA256)
 * ══════════════════════════════════════════════════════════════════
 * Le cookie sf_admin_session était auparavant un simple JSON posé par le navigateur
 * (document.cookie) : n'importe qui pouvait fabriquer {"slug":"x","roleId":"directeur"} et
 * passer proxy.ts. Il est désormais émis UNIQUEMENT par le serveur (/api/auth/*), en httpOnly
 * (illisible et non modifiable par le JavaScript de la page) et signé avec SESSION_SECRET :
 * toute modification du contenu invalide la signature.
 *
 * Utilise exclusivement Web Crypto (crypto.subtle) pour fonctionner à la fois dans proxy.ts
 * et dans les routes API.
 */

export const SESSION_COOKIE = 'sf_admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export interface SessionPayload {
  slug: string;
  roleId: string;
  /** Clé d'identité : code d'accès du membre du personnel, ou PARENT-<chiffres> pour un parent. */
  code: string;
  staffId?: string;
  /** Parents uniquement : identifiants des enfants vérifiés à la connexion. */
  childIds?: string[];
  /** Parents uniquement : numéros (chiffres seuls) enregistrés sur les fiches de leurs enfants. */
  parentPhones?: string[];
  subscriptionEndDate?: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== 'production') {
    return 'schoolflow-dev-only-secret-ne-pas-utiliser-en-production';
  }
  throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum) dans les variables d’environnement.');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function createSessionToken(data: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { ...data, iat: now, exp: now + SESSION_MAX_AGE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await getKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  try {
    // crypto.subtle.verify compare en temps constant.
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      fromBase64Url(signature) as BufferSource,
      encoder.encode(body)
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as SessionPayload;
    if (!payload.slug || !payload.roleId || !payload.exp) return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
