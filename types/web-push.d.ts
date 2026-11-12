/**
 * Déclaration minimale du paquet « web-push » (notifications en arrière-plan) : le paquet est
 * installé par Vercel au déploiement ; cette déclaration permet la vérification TypeScript locale.
 */
declare module 'web-push' {
  export interface PushSubscriptionLike {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  }
  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }
  export class WebPushError extends Error {
    statusCode: number;
    body: string;
    endpoint: string;
  }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  export function sendNotification(
    subscription: PushSubscriptionLike,
    payload?: string | Buffer | null,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string; timeout?: number }
  ): Promise<SendResult>;
  const _default: {
    setVapidDetails: typeof setVapidDetails;
    generateVAPIDKeys: typeof generateVAPIDKeys;
    sendNotification: typeof sendNotification;
    WebPushError: typeof WebPushError;
  };
  export default _default;
}
