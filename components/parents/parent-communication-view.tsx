'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { getLiveSchool, getLiveStudents, DATA_UPDATED_EVENT, broadcastLiveUpdate } from '@/lib/data/live-store';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
} from 'lucide-react';

interface ParentCommunicationViewProps {
  schoolSlug?: string;
  initialSchool?: School;
  initialStudents?: Student[];
}

interface ParentMessage {
  id: string;
  parentName: string;
  studentName: string;
  studentGrade: string;
  parentPhone: string;
  subject: string;
  message: string;
  category: 'absence' | 'finance' | 'document' | 'info';
  timestamp: string;
  status: 'new' | 'in_progress' | 'resolved';
  unread: boolean;
  directorReply?: string;
  directorReplyAt?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  absence: { label: 'Absence', icon: '🩺' },
  finance: { label: 'Finances / Reçu', icon: '💳' },
  document: { label: 'Document', icon: '📄' },
  info: { label: 'Information', icon: 'ℹ️' },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: 'Envoyé — en attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'En cours de traitement', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  resolved: { label: 'Traité par la Direction', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export function ParentCommunicationView({ schoolSlug = 'epc-manoi', initialSchool, initialStudents }: ParentCommunicationViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School | undefined>(initialSchool);
  const [allStudents, setAllStudents] = useState<Student[]>(initialStudents || []);
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    const updateSchool = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, initialSchool));
      const live = getLiveStudents(initialStudents || [], schoolSlug);
      setAllStudents(live || []);
    };
    updateSchool();
    window.addEventListener(DATA_UPDATED_EVENT, updateSchool);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, updateSchool);
  }, [schoolSlug, initialSchool, initialStudents]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('schoolflow_active_session_v2');
      if (stored) setActiveSession(JSON.parse(stored));
    } catch (e) {}
  }, []);

  // Famille du parent connecté : mêmes règles de correspondance que la page Bulletins.
  const activeFamily = useMemo(() => {
    if (activeSession?.matchedChildrenIds && activeSession.matchedChildrenIds.length > 0) {
      const matched = allStudents.filter((s) => activeSession.matchedChildrenIds.includes(s.id));
      if (matched.length > 0) {
        return {
          guardianName: activeSession.fullName || matched[0].guardianName || 'Parent d\'élève',
          phone: matched[0].guardianPhone || activeSession.phone || '+225 07 08 09 10 11',
          children: matched,
        };
      }
    }
    // Aucun repli par correspondance approximative de nom : un match par sous-chaîne de nom
    // ("JEAN" correspondant à "KOUASSI JEAN MARC") pouvait faire apparaître les données d'une
    // AUTRE famille. matchedChildrenIds (fixé une seule fois à la connexion, par téléphone) est
    // la seule source fiable — si elle est vide, la connexion elle-même a un problème à corriger,
    // pas une raison d'élargir la recherche par nom.
    return null;
  }, [activeSession, allStudents]);

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  useEffect(() => {
    if (activeFamily?.children?.length && !selectedChildId) {
      setSelectedChildId(activeFamily.children[0].id);
    }
  }, [activeFamily, selectedChildId]);

  const activeChild = useMemo(() => {
    return activeFamily?.children.find((c) => c.id === selectedChildId) || activeFamily?.children[0];
  }, [activeFamily, selectedChildId]);

  const [msgCategory, setMsgCategory] = useState<'absence' | 'finance' | 'document' | 'info'>('absence');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgToast, setMsgToast] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [sentMessages, setSentMessages] = useState<ParentMessage[]>([]);

  const loadHistory = useMemo(
    () => () => {
      try {
        const PARENT_MESSAGES_KEY = 'schoolflow_parent_messages_v1';
        const raw = localStorage.getItem(`${PARENT_MESSAGES_KEY}_${schoolSlug}`) || localStorage.getItem(PARENT_MESSAGES_KEY);
        const all: ParentMessage[] = raw ? JSON.parse(raw) : [];
        const myPhone = (activeFamily?.phone || '').replace(/\D/g, '');
        const myName = (activeSession?.fullName || '').toLowerCase().trim();
        const mine = all.filter((m) => {
          const mPhone = (m.parentPhone || '').replace(/\D/g, '');
          return (myPhone && mPhone === myPhone) || (myName && (m.parentName || '').toLowerCase().trim() === myName);
        });
        setSentMessages(mine);
      } catch (e) {}
    },
    [schoolSlug, activeFamily, activeSession]
  );

  useEffect(() => {
    loadHistory();

    // Tirer aussi l'historique/le statut à jour depuis le cloud (mis à jour par la Direction).
    const pullCloud = () => {
      fetch(`/api/sync?slug=${encodeURIComponent(schoolSlug)}&t=${Date.now()}`)
        .then((res) => res.json())
        .then((result) => {
          const cloudAll: ParentMessage[] = Array.isArray(result?.data?.parentMessages) ? result.data.parentMessages : [];
          if (cloudAll.length === 0) return;
          try {
            const PARENT_MESSAGES_KEY = 'schoolflow_parent_messages_v1';
            const rawLocal = localStorage.getItem(`${PARENT_MESSAGES_KEY}_${schoolSlug}`);
            const localAll: ParentMessage[] = rawLocal ? JSON.parse(rawLocal) : [];
            const byId = new Map<string, ParentMessage>();
            [...localAll, ...cloudAll].forEach((m) => byId.set(m.id, m));
            const merged = Array.from(byId.values()).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
            localStorage.setItem(`${PARENT_MESSAGES_KEY}_${schoolSlug}`, JSON.stringify(merged));
            localStorage.setItem(PARENT_MESSAGES_KEY, JSON.stringify(merged));
          } catch (e) {}
          loadHistory();
        })
        .catch(() => {});
    };
    pullCloud();
    const interval = setInterval(pullCloud, 60000);
    window.addEventListener(DATA_UPDATED_EVENT, loadHistory);
    return () => {
      clearInterval(interval);
      window.removeEventListener(DATA_UPDATED_EVENT, loadHistory);
    };
  }, [loadHistory, schoolSlug]);

  const handleSendParentMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgSubject.trim() || !msgBody.trim()) {
      alert('Veuillez renseigner l’objet et le message.');
      return;
    }

    const parentName = activeSession?.fullName || activeFamily?.guardianName || 'Parent d’élève';
    const parentPhone = activeFamily?.phone || '+225 07 08 09 10 11';
    const childName = activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : 'Élève';
    const childGrade = activeChild?.grade || 'Collège';

    const newMsg: ParentMessage = {
      id: `msg-${Date.now()}`,
      parentName,
      studentName: childName,
      studentGrade: childGrade,
      parentPhone,
      subject: msgSubject.trim(),
      message: msgBody.trim(),
      category: msgCategory,
      timestamp: new Date().toISOString(),
      status: 'new',
      unread: true,
    };

    setIsSending(true);

    try {
      const PARENT_MESSAGES_KEY = 'schoolflow_parent_messages_v1';
      const keySchool = `${PARENT_MESSAGES_KEY}_${schoolSlug}`;
      const rawSchool = localStorage.getItem(keySchool);
      const prevSchool = rawSchool ? JSON.parse(rawSchool) : [];
      const updatedSchool = [newMsg, ...prevSchool];
      localStorage.setItem(keySchool, JSON.stringify(updatedSchool));

      const rawGlobal = localStorage.getItem(PARENT_MESSAGES_KEY);
      const prevGlobal = rawGlobal ? JSON.parse(rawGlobal) : [];
      const updatedGlobal = [newMsg, ...prevGlobal];
      localStorage.setItem(PARENT_MESSAGES_KEY, JSON.stringify(updatedGlobal));

      broadcastLiveUpdate({ action: 'parent_message_sent', message: newMsg, schoolSlug });
      setSentMessages((prev) => [newMsg, ...prev]);

      fetch(`/api/sync?slug=${encodeURIComponent(schoolSlug)}&t=${Date.now()}`)
        .then((res) => res.json())
        .then((result) => {
          const cloudAll = Array.isArray(result?.data?.parentMessages) ? result.data.parentMessages : [];
          const mergedAll = [newMsg, ...cloudAll.filter((m: any) => m.id !== newMsg.id)];
          return fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: schoolSlug, parentMessages: mergedAll }),
          });
        })
        .catch(() => {})
        .finally(() => setIsSending(false));

      setMsgToast('✓ Votre message a été transmis en direct à la Direction de l’école !');
      setMsgSubject('');
      setMsgBody('');
      setTimeout(() => setMsgToast(null), 5000);
    } catch (err) {
      console.error('Erreur envoi message parent:', err);
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Espace Famille • Année {currentSchool?.academicYear || '2026-2027'}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight">Écrire à la Direction</h1>
        <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
          Transmettez une demande, un justificatif ou une information directement à la Direction et au Secrétariat de l’établissement.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <form onSubmit={handleSendParentMessage} className="space-y-4">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Élève concerné(e) :</span>
                <strong className="text-slate-900 font-heading">
                  {activeChild ? `${activeChild.firstName} ${activeChild.lastName} (${activeChild.grade})` : '—'}
                </strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Parent expéditeur :</span>
                <span className="font-semibold text-slate-800">
                  {activeSession?.fullName || activeFamily?.guardianName || 'Parent'}
                </span>
              </div>

              {(activeFamily?.children?.length || 0) > 1 && (
                <div className="pt-2">
                  <select
                    value={selectedChildId}
                    onChange={(e) => setSelectedChildId(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700"
                  >
                    {activeFamily!.children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} ({c.grade})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Motif / Catégorie du message *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(CATEGORY_LABELS).map(([id, cat]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMsgCategory(id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      msgCategory === id
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-extrabold ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-[11px]">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Objet du message *</label>
              <input
                type="text"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                placeholder="Ex : Justificatif d'absence médicale de ce jeudi..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Votre message à la Direction *</label>
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                rows={5}
                placeholder="Expliquez votre situation ou formulez votre demande avec précision..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isSending ? 'Envoi en cours...' : 'Envoyer à la Direction'}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 font-heading flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-600" />
            Vos messages envoyés
          </h3>
          {sentMessages.length === 0 ? (
            <p className="text-xs text-slate-500">Aucun message envoyé pour le moment.</p>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {sentMessages.map((m) => {
                const st = STATUS_LABELS[m.status] || STATUS_LABELS.new;
                const cat = CATEGORY_LABELS[m.category] || CATEGORY_LABELS.info;
                return (
                  <div key={m.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {cat.icon} {m.subject}
                      </span>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-3">{m.message}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(m.timestamp).toLocaleString('fr-FR')}</span>
                    </div>
                    {m.directorReply && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-0.5">
                        <p className="text-[10px] font-black text-emerald-800 uppercase">Réponse de la Direction</p>
                        <p className="text-[11px] text-emerald-900 leading-snug">{m.directorReply}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {msgToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-900 text-white shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-md">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold leading-snug">{msgToast}</p>
        </div>
      )}
    </div>
  );
}
