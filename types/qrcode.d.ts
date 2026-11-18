/**
 * Déclarations minimales des paquets « qrcode » (génération du QR des cartes scolaires) et « jsqr »
 * (lecture du QR quand le navigateur n'a pas BarcodeDetector) : installés par Vercel au déploiement ;
 * ces déclarations permettent la vérification TypeScript locale.
 */
declare module 'qrcode' {
  export interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  const QRCode: { toDataURL: typeof toDataURL };
  export default QRCode;
}

declare module 'jsqr' {
  export interface QRCodeResult {
    data: string;
  }
  export default function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }): QRCodeResult | null;
}
