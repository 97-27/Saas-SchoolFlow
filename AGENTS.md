<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SchoolFlow — Règles Fondamentales de Développement & Design System ("Vert, Blanc, Noir")

Pour toute création ou modification de page (Élèves, Scolarité, Comptabilité, Classes, Notes, Présences, etc.), l'agent DOIT scrupuleusement appliquer les règles définies dans [.agents/rules/schoolflow-design-system.md](file:///c:/BUSINESS%20SAAS%20AFRIQUE/SaaS%20SchoolFlow/.agents/rules/schoolflow-design-system.md) :

1. **Palette "Vert, Blanc, Noir"** :
   - Vert émeraude (`#10b981`, `#059669`, `#064e3b`) pour les actions principales et badges positifs.
   - Blanc pur (`#ffffff`) pour toutes les cartes, tableaux et surfaces.
   - Noir / Slate foncé (`#0f172a`, `#1e293b`) pour les textes et chiffres clés.
   - Fond global doux (`#f8fafc`).
   - Or / Ambre (`#fbbf24`, `#f59e0b`) pour accents secondaires et alertes douces.
2. **Typographie** :
   - Titres & Chiffres Clés : police **Outfit** (`font-heading`, `font-extrabold`).
   - Corps de texte, Tableaux & Données : police **Inter** (`font-sans`).
   - Identifiants : police **font-mono** (`ID-001`, etc.).
3. **Données & Métier (Afrique Francophone & Anglophone)** :
   - Monnaie : **STRICTEMENT en FCFA** (`formatFCFA(montant)`).
   - Dates : **STRICTEMENT en JJ/MM/AAAA** (`formatDate(date)`).
   - Année scolaire active : **2026-2027**.
   - Niveaux : **Maternelle (P.S.) jusqu'en 3ème** (Maternelle P.S./M.S./G.S., CP1 à CM2, 6ème à 3ème). Pas de lycée.
   - Genre : badges compacts **`♀ F`** (rose) et **`♂ M`** (bleu) via `GenderBadge`.
4. **Composants & Layout** :
   - Shell global : `<DashboardShell schoolSlug={...} breadcrumbs={[...]}>`.
   - Cartes KPI Pandhowan : `rounded-2xl`, bordure subtile, grand chiffre Outfit, icône pastel, répartition F/M.
   - Tableaux : conteneur `overflow-x-auto`, filtre de classe/statut/recherche, tri, pagination interactive 10 par page.
   - Responsivité mobile totale garantie (padding doux, boutons tactiles pleine largeur, zéro scroll horizontal parasite).

---

# Protocole Obligatoire : Test Navigateur Réel, Vérification & Déploiement Tripartite

À chaque modification demandée par le **Directeur Lawani Mouhamed**, l'agent DOIT scrupuleusement appliquer le protocole défini dans [.agents/rules/verification-and-deployment-protocol.md](file:///c:/BUSINESS%20SAAS%20AFRIQUE/SaaS%20SchoolFlow/.agents/rules/verification-and-deployment-protocol.md) :

1. **Compilation & Test Local** : Toujours exécuter `npm run build` pour garantir 0 erreur TypeScript, 0 régression et 0 ReferenceError.
2. **Test Navigateur Réel Obligatoire** : Ouvrir le navigateur (via `browser_subagent` ou prévisualisation) pour interagir directement avec l'application, tester visuellement les interfaces et vérifier la persistance effective dans **Supabase** et dans le store local réactif.
3. **Déploiement GitHub & Vercel** : Pousser tous les fichiers modifiés vers la branche `main` du dépôt `97-27/Saas-SchoolFlow`.
4. **Vérification Vercel Production** : Vérifier que le déploiement sur `https://saas-school-flow-12xh.vercel.app` est actif avec `state: success`.

---

# Interaction & Préférences Utilisateur

- **Utilisateur & Titre** : Directeur Lawani Mouhamed.
- **Salutation Obligatoire** : Lorsque le Directeur salue (et uniquement lorsqu'il salue), TOUJOURS lui répondre d'abord par :
  > **« Wa alaykum salam Directeur Lawani Mouhamed »**
