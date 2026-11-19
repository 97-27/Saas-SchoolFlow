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
  const digitCells = code
    .split('')
    .map(
      (d) =>
        `<td style="padding:0 4px"><div style="width:44px;height:56px;line-height:56px;text-align:center;font-size:30px;font-weight:800;color:#065f46;background:#ecfdf5;border:2px solid #34d399;border-radius:12px;font-family:Arial,Helvetica,sans-serif">${d}</div></td>`
    )
    .join('');
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">
   <tr><td style="background:#047857;background-image:linear-gradient(135deg,#064e3b,#059669);padding:28px 24px;text-align:center">
     <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">School<span style="color:#fcd34d">Flow</span> <span style="font-weight:600;color:#a7f3d0">Africa</span></div>
     <div style="margin-top:6px;font-size:12px;color:#a7f3d0;letter-spacing:2px;text-transform:uppercase">Confirmation de votre e-mail</div>
   </td></tr>
   <tr><td style="padding:30px 26px 8px;color:#334155;font-size:15px;line-height:1.6">
     <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a">Bonjour 👋</p>
     <p style="margin:0">Vous êtes sur le point de créer l’espace de l’établissement <b style="color:#047857">${escapeHtml(schoolName)}</b> sur SchoolFlow Africa.</p>
     <p style="margin:14px 0 0">Saisissez ce code de confirmation dans la fenêtre d’inscription :</p>
   </td></tr>
   <tr><td align="center" style="padding:18px 26px 6px">
     <table role="presentation" cellpadding="0" cellspacing="0"><tr>${digitCells}</tr></table>
   </td></tr>
   <tr><td style="padding:14px 26px 26px;text-align:center;color:#64748b;font-size:13px;line-height:1.6">
     ⏱ Ce code est valable <b>15 minutes</b>.<br/>
     Votre espace ne sera créé qu’après cette confirmation.
   </td></tr>
   <tr><td style="padding:0 26px 26px">
     <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;color:#92400e;font-size:12px;line-height:1.5">
       🔒 <b>Sécurité :</b> ne communiquez jamais ce code. Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message : aucun compte ne sera créé.
     </div>
   </td></tr>
   <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0">
     SchoolFlow Africa — La gestion scolaire simple pour les établissements africains<br/>
     Besoin d’aide ? WhatsApp +225 01 70 36 36 56
   </td></tr>
  </table>
 </td></tr>
</table></body></html>`;
  const text = `SchoolFlow Africa — Votre code de confirmation : ${code}\n\nÉtablissement : ${schoolName}\nCode valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `Votre code de confirmation SchoolFlow Africa : ${code}`, html, text }),
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
