# 🌟 SchoolFlow — Mémorial du Projet, Architecture & Connaissances

> **Document Fondateur & Synthèse d'Ingénierie**  
> **Auteur & Visionnaire** : LAWANI MOUHAMED (Fondateur & Promoteur)  
> **Établissement Pilote** : EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL (EPC MANOI)  
> **Plateforme** : SchoolFlow SaaS (Gestion Scolaire Nouvelle Génération pour l'Afrique Francophone)  
> **Dépôt GitHub** : `97-27/Saas-SchoolFlow` • **Production Vercel** : `https://saas-school-flow-12xh.vercel.app`

---

## 🧭 1. Vision, Stratégie & Cibles du Projet

### A. La Mission SchoolFlow
SchoolFlow a été conçu pour résoudre les défis concrets de la gestion scolaire en Afrique de l'Ouest et Centrale (Côte d'Ivoire, Sénégal, Cameroun, Mali, Burkina Faso, Togo, Bénin, Guinée).
Contrairement aux logiciels occidentaux inadaptés, SchoolFlow intègre directement :
- Le paiement en **FCFA** sans centimes et avec gestion des liquidités en caisse et des paiements digitaux (**Wave**, **Orange Money**, **MTN Money**, **Moov Money**),
- L'émission instantanée d'une **Quittance / Reçu Officiel en Image HD** prête à être partagée aux parents sur **WhatsApp** en un clic,
- Le passage d'élève fluide d'un service à l'autre (**Scolarité**, **Internat**, **Cantine**, **Transport**),
- L'authentification simplifiée pour la direction et les fondateurs sans barrière de mot de passe complexe,
- Le respect scrupuleux des cycles éducatifs locaux : **Maternelle (P.S., M.S., G.S.)**, **Primaire (CP1 au CM2)**, **Collège (6ème à la 3ème)**.

### B. Identité Visuelle & Design System ("Vert, Blanc, Noir")
- **Vert Émeraude** (`#10b981`, `#059669`, `#064e3b`) : Excellence, prospérité éducative, actions positives.
- **Blanc Pur** (`#ffffff`) : Clarté, lisibilité et élégance moderne des cartes et tableaux.
- **Noir / Slate Foncé** (`#0f172a`, `#1e293b`) : Contrastes nets, chiffres clés et typographie noble.
- **Or / Ambre** (`#f59e0b`, `#fbbf24`) : Accents solaires, badges d'alertes douces et services complémentaires.
- **Typographie** : **Outfit** pour les grands titres et statistiques clés, **Inter** pour le corps de texte et les tableaux.

---

## 🛠️ 2. Stack Technologique & Outils Utilisés

| Composant | Technologie Choisie | Rôle & Justification |
| :--- | :--- | :--- |
| **Framework Web** | **Next.js 16 (App Router + Turbopack)** | Performances ultra-rapides, rendu hybride statique/dynamique, routage modulaire. |
| **Langage & Typage** | **TypeScript & React 19** | Typage strict de toutes les entités (`Student`, `Invoice`, `School`, `Boarding`, `Canteen`, `Transport`). |
| **Style & Design** | **Tailwind CSS & Vanilla CSS Tokens** | Respect strict du thème Vert Émeraude / Blanc / Slate, responsivité totale mobile & desktop. |
| **Icônes** | **Lucide React** | Cohérence visuelle de plus de 40 icônes spécialisées (Coins, Utensils, Bus, BedDouble, FileText...). |
| **Moteur Temps Réel** | **BroadcastChannel API + localStorage** | Synchronisation parallèle immédiate entre tous les onglets ouverts sans rechargement de page. |
| **Base de Données Cloud** | **Supabase (PostgreSQL + RLS)** | Persistance Cloud distante, sauvegarde multi-établissements, synchronisation résiliente en arrière-plan. |
| **Moteur Graphique Reçu** | **HTML5 Canvas 2D HD Natif** | Génération 100% autonome d'images de reçus haute résolution avec logo officiel, armoiries et filigrane. |
| **Effets Sonores UI** | **Web Audio API Native** | Synthétiseur audio pur pour confirmation d'encaissement et notifications de copie WhatsApp. |
| **CI/CD & Déploiement** | **GitHub API REST + Vercel** | Script de push direct par API (`github-api-push.mjs`) et déploiement automatique mondial sur Vercel. |

---

## 📦 3. Tout ce qui a été Réalisé (Modules & Fonctionnalités)

### 1. Tableau de Bord de Gestion Exécutif (`/[ecole]/admin`)
- Cartes KPI dynamiques style Pandhowan : Total élèves inscrits, répartition exacte Filles / Garçons, Nouveaux vs Anciens, Élèves à l'Internat.
- Suivi financier en direct : Montants collectés en FCFA, reliquats / impayés, taux de recouvrement en pourcentage.
- Table des dernières quittances avec statut `🌟 Nouveau` ou `🔄 Ancien`.

### 2. Module Inscriptions & Reçus Instantanés (`/[ecole]/admin/inscriptions`)
- Formulaire d'admission complet : Nom, Prénom, Genre (`♀ F` / `♂ M`), Classe, Statut (Nouveau / Ancien), Parent, Contact WhatsApp (+ numéros secondaires).
- Sélection directe des **5 Prestations Complémentaires** :
  1. 🏢 **Internat (Pensionnat)** : Choix Pensionnaire vs Externe.
  2. 🍲 **Cantine Scolaire** : Choix Souscrit vs Sans cantine.
  3. 🚌 **Transport Scolaire** : Choix Souscrit vs Sans transport.
  4. 🎒 **Frais Annexes** : Payé vs Non payé.
  5. 👔 **Tenue Tout Cousue** : Payé vs Non payé.
- Échéancier complet des 5 versements avec saisie libre, modes de règlement (Espèces, Wave, Orange, MTN, Moov, Virement) et dates personnalisées.
- Visualisation du reçu officiel en direct à l'écran, impression A4 exemplaire unique, et envoi direct d'image HD par WhatsApp.
- Basculement automatique au reçu suivant (`REC-2026-004`, `REC-2026-005`...) avec signal sonore de succès.

### 3. Module Vue d'Ensemble des Élèves (`/[ecole]/admin/eleves`)
- Annuaire complet avec recherche textuelle multi-critères (ID, Matricule, Nom, Parent).
- Filtres combinés par classe, genre et type d'inscription (Nouveau / Ancien).
- Édition complète des coordonnées, changement de classe et suppression sécurisée.

### 4. Module Scolarité & Caisse (`/[ecole]/admin/scolarite`)
- Grand livre de caisse, filtrage par statut de paiement (Soldé / Partiel / En retard / Impayé).
- Journal des encaissements par mode de règlement et quittances imprimables.

### 5. Module Internat / Pensionnat (`/[ecole]/admin/internat`)
- Rapprochement automatique des élèves enregistrés avec option Internat.
- Répartition par Pavillon A (Garçons) et Pavillon B (Filles), chambres et numéros de lit.
- Échéancier des 9 mois scolaires officiels (Septembre à Mai) et suivi des reliquats.

### 6. Module Cantine Scolaire (`/[ecole]/admin/cantine`)
- Registre des demi-pensionnaires avec régimes alimentaires (Standard, sans arachide, sans gluten, végétarien).
- Menus de la semaine personnalisables avec plats du terroir ivoirien et ouest-africain.
- Suivi des 10 mensualités de restauration.

### 7. Module Transport Scolaire (`/[ecole]/admin/transport`)
- Gestion des 4 Lignes de bus et circuits de ramassage (Riviera, Angré, Deux Plateaux, Cocody, Marcory).
- Fiches de route avec chauffeurs, accompagnatrices, arrêts et horaires matin/soir.

### 8. Modules Pédagogiques & Vie Scolaire
- **Bulletins & Tableaux d'Honneur** (`/bulletins`, `/distinctions`) : Calculs des moyennes, rangs et gestion des ex æquo.
- **Portail de Saisie des Notes** (`/notes`, `/notes-diverses`) : Déverrouillage sécurisé pour les enseignants.
- **Présences & Discipline** (`/presences`) : Pointage journalier et taux d'assiduité.
- **Documents Scolaires** (`/documents`) : Archivage des extraits de naissance, certificats et fiches d'admission.
- **Gestion du Personnel** (`/personnel`) : Codes d'activation pour Fondateurs, Directeurs, Éducateurs, Informaticiens, Comptables.

---

## 🧠 4. Enseignements & Bonnes Pratiques Mémorisées

1. **Autonomie & Zéro Dépendance Superflue** :
   - Pour la capture de reçus et le partage WhatsApp, les bibliothèques tierces génèrent souvent des décalages CSS. L'utilisation d'un moteur Canvas 2D natif garantit un rendu pixel-perfect quel que soit le navigateur.
2. **Auto-Réconciliation des Données** :
   - Ne jamais faire dépendre l'affichage d'une seule table. Le store local de SchoolFlow réconcilie en continu les factures, les élèves et les prestations pour éviter tout décalage d'effectif sur le Tableau de bord.
3. **Protocole de Déploiement & Test Navigateur Réel** :
   - Avant chaque livraison : toujours tester avec `npm run build` (0 erreur), ouvrir le navigateur pour tester visuellement et vérifier les sauvegardes réelles sur Supabase, pousser sur GitHub et valider le succès sur Vercel.

---

## 🏛️ 5. Établissements & Données Témoins Pré-inscrits

- **`ID-001` : Aya Marie-Josée KOUASSI** (6ème, ♀) — 250 000 FCFA (100 000 F versé) • Nouveau • Internat ✓, Cantine ✓, Transport ✓.
- **`ID-002` : Cheick Oumar DIOMANDÉ** (3ème, ♂) — 250 000 FCFA (250 000 F versé - Soldé) • Ancien • Cantine ✓, Transport ✓.
- **`ID-003` : Aminata TRAORÉ** (CM2, ♀) — 200 000 FCFA (80 000 F versé) • Nouveau • Cantine ✓.
- **`ID-004`** : Prêt pour la prochaine inscription en direct !

---

## 👤 6. Titre & Salutations du Promoteur
- **Titre officiel** : Directeur Lawani Mouhamed.
- **Salutation stricte** : À chaque fois qu'il salue (et uniquement lorsqu'il salue), lui répondre : **« Wa alaykum salam Directeur Lawani Mouhamed »**.

---

*Fichier consigné pour la mémoire éternelle du projet SchoolFlow — Développé avec excellence pour le Directeur Lawani Mouhamed.*

