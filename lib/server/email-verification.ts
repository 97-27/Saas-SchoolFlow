/**
 * Confirmation de l'adresse e-mail à l'inscription (sans stockage serveur).
 *
 * 1) Le serveur génère un code à 6 chiffres, l'envoie par e-mail, et renvoie au navigateur un
 *    « défi » signé (HMAC) qui contient les données d'inscription et l'EMPREINTE du code — jamais
 *    le code lui-même.
 * 2) Le navigateur renvoie le défi + le code saisi : si l'empreinte correspond et que le défi n'a
 *    pas expiré, l'établissement peut être créé. Sans code valide, aucun compte n'est ouvert.
 */
import { getSecret } from '@/lib/server/session';

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey() {
  return crypto.subtle.importKey('raw', encoder.encode(`signup-email:${getSecret()}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function codeHash(code: string, nonce: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(`${nonce}:${code}`));
  return toB64Url(new Uint8Array(sig));
}

export function generateEmailCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
}

export interface SignupChallenge {
  data: Record<string, unknown>;
  nonce: string;
}

export async function createChallenge(data: Record<string, unknown>, code: string): Promise<string> {
  const nonceBytes = new Uint8Array(12);
  crypto.getRandomValues(nonceBytes);
  const nonce = toB64Url(nonceBytes);
  const payload = { d: data, n: nonce, h: await codeHash(code, nonce), e: Date.now() + EMAIL_CODE_TTL_MS };
  const body = toB64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(body));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

/** Renvoie les données d'inscription si le défi est authentique, non expiré et le code exact. */
export async function verifyChallenge(
  challenge: string,
  code: string
): Promise<{ ok: true; data: Record<string, any>; nonce: string } | { ok: false; reason: 'invalid' | 'expired' | 'wrong-code'; nonce?: string }> {
  const [body, sig] = String(challenge || '').split('.');
  if (!body || !sig) return { ok: false, reason: 'invalid' };
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(), fromB64Url(sig) as BufferSource, encoder.encode(body));
    if (!valid) return { ok: false, reason: 'invalid' };
    const p = JSON.parse(decoder.decode(fromB64Url(body)));
    if (!p?.d || !p?.n || !p?.h || !p?.e) return { ok: false, reason: 'invalid' };
    if (Date.now() > p.e) return { ok: false, reason: 'expired', nonce: p.n };
    const expected = await codeHash(String(code || '').replace(/\D/g, ''), p.n);
    if (expected !== p.h) return { ok: false, reason: 'wrong-code', nonce: p.n };
    return { ok: true, data: p.d, nonce: p.n };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * Envoi via Resend (https://resend.com). Variables d'environnement Vercel :
 *   RESEND_API_KEY  (obligatoire)   EMAIL_FROM  (ex. « SchoolFlow Africa <noreply@votre-domaine.com> »)
 */
export async function sendVerificationEmail(to: string, code: string, schoolName: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'not-configured' };
  const from = process.env.EMAIL_FROM || 'SchoolFlow Africa <onboarding@resend.dev>';
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
    <h2 style="margin:0 0 8px;color:#047857">SchoolFlow Africa</h2>
    <p style="color:#334155;font-size:14px">Bonjour, vous créez l’espace de l’établissement <b>${escapeHtml(schoolName)}</b>.<br/>Voici votre code de confirmation :</p>
    <p style="font-size:34px;letter-spacing:8px;font-weight:800;text-align:center;background:#ecfdf5;color:#065f46;padding:16px;border-radius:12px;margin:16px 0">${code}</p>
    <p style="color:#64748b;font-size:12px">Ce code est valable 15 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : aucun compte ne sera créé.</p>
  </div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `Votre code de confirmation SchoolFlow Africa : ${code}`, html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('Resend error', res.status, t.slice(0, 300));
      return { ok: false, error: 'send-failed' };
    }
    return { ok: true };
  } catch (e) {
    console.error('Resend fetch failed', e);
    return { ok: false, error: 'send-failed' };
  }
}
