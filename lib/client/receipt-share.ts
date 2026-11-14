'use client';

/**
 * Reçu en image (PNG) pour la cantine et le transport — même comportement que la scolarité,
 * l'internat et les salaires :
 *  1. le reçu est photographié (html2canvas) ;
 *  2. l'image est téléchargée automatiquement sur l'appareil (galerie / Téléchargements) ;
 *  3. l'image est copiée dans le presse-papier (Ctrl+V dans WhatsApp) quand le navigateur le permet.
 */

export async function captureReceiptPng(element: HTMLElement | null): Promise<Blob | null> {
  if (!element) return null;
  try {
    const mod = await import('html2canvas');
    const html2canvas = mod.default;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 8000,
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) return blob;
    const res = await fetch(canvas.toDataURL('image/png'));
    return await res.blob();
  } catch {
    return null;
  }
}

/** Copie l'image dans le presse-papier. Renvoie false si le navigateur refuse (action manuelle possible). */
export async function copyPngToClipboard(blob: Blob): Promise<boolean> {
  try {
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (!navigator.clipboard || !ClipboardItemCtor) return false;
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Téléchargement direct du PNG sur l'appareil. */
export function downloadPng(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Laisse le temps au téléchargement de démarrer avant de libérer l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
