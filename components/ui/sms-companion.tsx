'use client';

import { useEffect, useState } from 'react';
import { startVersionWatch } from '@/lib/data/live-store';

/**
 * Envoi par SMS en plus de WhatsApp, PARTOUT où l'application propose WhatsApp.
 *  - Lien WhatsApp (<a href="https://wa.me/…?text=…">) : un petit bouton « SMS » est ajouté juste à côté.
 *    Il ouvre l'application SMS du téléphone avec le numéro ET le message déjà rédigé.
 *  - Ouverture par bouton (window.open vers WhatsApp) : une petite fenêtre propose WhatsApp ou SMS.
 */

type Parsed = { phone: string; text: string };

function parseWhatsApp(raw: string): Parsed | null {
  try {
    const u = new URL(raw, window.location.href);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'wa.me' && host !== 'api.whatsapp.com' && host !== 'web.whatsapp.com') return null;
    let phone = '';
    if (host === 'wa.me') phone = u.pathname.replace(/\D/g, '');
    else phone = (u.searchParams.get('phone') || '').replace(/\D/g, '');
    const text = u.searchParams.get('text') || '';
    return { phone, text };
  } catch {
    return null;
  }
}

function smsHref({ phone, text }: Parsed): string {
  const num = phone ? `+${phone}` : '';
  return `sms:${num}${text ? `?&body=${encodeURIComponent(text)}` : ''}`;
}

const MARK = 'data-sf-sms';

function enhance(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"], a[href*="whatsapp.com/send"]').forEach((a) => {
    if (a.hasAttribute(MARK) || a.closest('[data-no-sms]')) return;
    const parsed = parseWhatsApp(a.href);
    if (!parsed) return;
    // Lien sans numéro ni message (ex. support) : pas de SMS.
    if (!parsed.phone && !parsed.text) return;
    a.setAttribute(MARK, '1');
    const sms = document.createElement('a');
    sms.setAttribute(MARK, 'sms');
    sms.href = smsHref(parsed);
    sms.textContent = '✉ SMS';
    sms.title = 'Envoyer par SMS (message déjà rédigé)';
    sms.className = 'sf-sms-btn';
    sms.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:4px 10px;border-radius:10px;' +
      'background:#0ea5e9;color:#fff;font:700 11px/1.2 inherit;text-decoration:none;white-space:nowrap;cursor:pointer;' +
      'box-shadow:0 2px 6px rgba(14,165,233,.3)';
    sms.addEventListener('click', (e) => e.stopPropagation());
    a.insertAdjacentElement('afterend', sms);
  });
}

export function SmsCompanion() {
  const [choice, setChoice] = useState<{ url: string; parsed: Parsed } | null>(null);

  useEffect(() => {
    // Message « Nouvelle version » : actif sur toutes les pages, connexion comprise.
    startVersionWatch();
    let scheduled = false;
    const run = () => {
      scheduled = false;
      enhance(document);
    };
    const obs = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(run, 150);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    run();

    const nativeOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const href = url ? String(url) : '';
      const parsed = href ? parseWhatsApp(href) : null;
      if (parsed && (parsed.phone || parsed.text)) {
        setChoice({ url: href, parsed });
        return null;
      }
      return nativeOpen(url as string, target, features);
    }) as typeof window.open;

    return () => {
      obs.disconnect();
      window.open = nativeOpen;
    };
  }, []);

  if (!choice) return null;
  const close = () => setChoice(null);
  return (
    <div
      role="dialog"
      aria-label="Choisir le mode d’envoi"
      onClick={close}
      className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center bg-slate-900/50 p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3">
        <p className="text-sm font-extrabold text-slate-900">Envoyer le message par…</p>
        <p className="text-xs text-slate-500 line-clamp-3">{choice.parsed.text || 'Message prêt à envoyer.'}</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={choice.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="rounded-xl bg-emerald-600 py-2.5 text-center text-xs font-bold text-white hover:bg-emerald-700"
          >
            WhatsApp
          </a>
          <a
            href={smsHref(choice.parsed)}
            onClick={close}
            className="rounded-xl bg-sky-500 py-2.5 text-center text-xs font-bold text-white hover:bg-sky-600"
          >
            ✉ SMS
          </a>
        </div>
        <button type="button" onClick={close} className="w-full rounded-xl py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
          Annuler
        </button>
      </div>
    </div>
  );
}
