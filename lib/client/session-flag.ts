'use client';

/**
 * Session déjà validée par le serveur dans cet onglet (connexion qui vient de réussir, ou
 * vérification déjà faite) : l'espace de gestion s'affiche sans refaire l'aller-retour.
 * Une déconnexion recharge entièrement la page, ce qui remet cette valeur à faux.
 */
let verified = false;

export function markSessionVerified() {
  verified = true;
}

export function isSessionVerified(): boolean {
  return verified;
}
