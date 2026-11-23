/**
 * Imprime un morceau de page (un reçu, une liste…) SEUL, sur UNE page A4.
 *
 * Ancienne méthode (window.print() sur toute la page) : le menu, les panneaux défilants et les
 * conteneurs de l'écran restaient dans la mise en page → une première page blanche, puis le reçu
 * coupé sur la 2e et la 3e page. Ici le contenu est copié dans un cadre invisible qui ne contient
 * QUE lui (avec les mêmes feuilles de style), puis réduit automatiquement s'il est plus haut que
 * la page.
 */

const MM_TO_PX = 96 / 25.4;

export type PrintOnePageOptions = {
  /** Titre du document (nom du fichier PDF proposé par le navigateur). */
  title?: string;
  /** Marge de la page en mm (défaut 8). */
  marginMm?: number;
  /** Largeur du contenu en mm (défaut : largeur utile de la page A4 portrait). */
  widthMm?: number;
  /** Paysage au lieu de portrait. */
  landscape?: boolean;
  /** Réduction maximale autorisée (défaut 0,45). Au-delà, le contenu déborde sur une 2e page. */
  minScale?: number;
};

function waitFor(el: HTMLElement | Document, test: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (test() || Date.now() - start > timeoutMs) resolve();
      else setTimeout(tick, 60);
    };
    tick();
  });
}

export async function printOnePage(html: string, opts: PrintOnePageOptions = {}): Promise<void> {
  if (typeof document === 'undefined') return;
  const margin = opts.marginMm ?? 8;
  const pageW = opts.landscape ? 297 : 210;
  const pageH = opts.landscape ? 210 : 297;
  const widthMm = opts.widthMm ?? pageW - margin * 2;
  const usableHpx = (pageH - margin * 2) * MM_TO_PX - 4; // 4 px de sécurité
  const minScale = opts.minScale ?? 0.45;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.round(pageW * MM_TO_PX)}px;height:${Math.round(
    pageH * MM_TO_PX
  )}px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    window.print();
    return;
  }

  // Mêmes feuilles de style que l'application (Tailwind, polices) : le reçu garde son aspect.
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${(opts.title || 'Document').replace(/[<>&]/g, '')}</title>
${styles}
<style>
  @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: ${margin}mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  body { font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #sf-print-root { width: ${widthMm}mm; margin: 0 auto; break-inside: avoid; page-break-inside: avoid; page-break-after: avoid; }
  #sf-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print\\:hidden { display: none !important; }
</style></head><body><div id="sf-print-root">${html}</div></body></html>`);
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 1500);

  try {
    // Attend les feuilles de style puis les images (logo, emblème, tampon).
    await waitFor(doc, () => Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).every((l) => !!(l as HTMLLinkElement).sheet), 4000);
    await waitFor(doc, () => Array.from(doc.images).every((img) => img.complete), 4000);
    if ((doc as any).fonts?.ready) await Promise.race([(doc as any).fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

    // Tient sur une page : si le contenu est plus haut que la page, on le réduit.
    const root = doc.getElementById('sf-print-root') as HTMLElement | null;
    if (root) {
      const h = root.scrollHeight;
      if (h > usableHpx) {
        const scale = Math.max(minScale, Math.floor((usableHpx / h) * 100) / 100);
        (root.style as any).zoom = String(scale);
      }
    }

    win.focus();
    win.addEventListener('afterprint', cleanup, { once: true });
    win.print();
    // Secours si « afterprint » ne part pas (certains navigateurs mobiles).
    setTimeout(() => iframe.remove(), 120000);
  } catch {
    cleanup();
  }
}
