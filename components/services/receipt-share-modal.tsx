'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Download, Smartphone, X, AlertCircle } from 'lucide-react';
import { copyPngToClipboard, downloadPng } from '@/lib/client/receipt-share';

export interface ReceiptShareData {
  imageUrl: string;
  blob: Blob;
  fileName: string;
  waUrl: string;
  recipient: string;
  name: string;
  copied: boolean;
}

interface ReceiptShareModalProps {
  data: ReceiptShareData;
  onClose: () => void;
}

/**
 * Aperçu du reçu envoyé à WhatsApp : l'image a déjà été téléchargée sur l'appareil ; ici on peut
 * la recopier dans le presse-papier, la retélécharger et ouvrir la discussion du parent.
 */
export function ReceiptShareModal({ data, onClose }: ReceiptShareModalProps) {
  const [copied, setCopied] = useState(data.copied);
  const [copyError, setCopyError] = useState(false);
  const [downloadedAgain, setDownloadedAgain] = useState(false);

  const handleCopy = async () => {
    const ok = await copyPngToClipboard(data.blob);
    setCopied(ok);
    setCopyError(!ok);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">Reçu prêt pour WhatsApp</h3>
              <p className="text-xs text-slate-500">
                Parent : <strong className="text-slate-900 font-mono whitespace-nowrap">{data.recipient || 'non renseigné'}</strong> ({data.name})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-50 max-h-72 overflow-y-auto p-1.5 shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.imageUrl} alt="Reçu" className="w-full object-contain rounded-xl shadow-xs" />
        </div>

        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            copied ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold">
              {copied ? 'Reçu téléchargé sur cet appareil et copié.' : 'Reçu téléchargé sur cet appareil.'}
            </p>
            <p className="text-[11px] leading-tight mt-0.5">
              {copied
                ? 'Ouvrez la discussion WhatsApp du parent puis faites Ctrl + V (ou Coller) pour joindre l’image.'
                : copyError
                ? 'Le navigateur a refusé la copie. Retélécharger ou ouvrir le fichier téléchargé, puis l’envoyer depuis WhatsApp.'
                : 'Si la copie n’a pas fonctionné, utilisez « Recopier l’image » puis Ctrl + V dans WhatsApp.'}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <a
            href={data.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Ouvrir WhatsApp du parent</span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Recopier l&apos;image</span>
            </button>
            <button
              type="button"
              onClick={() => {
                downloadPng(data.blob, data.fileName);
                setDownloadedAgain(true);
              }}
              className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{downloadedAgain ? 'Téléchargé à nouveau' : 'Télécharger PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
