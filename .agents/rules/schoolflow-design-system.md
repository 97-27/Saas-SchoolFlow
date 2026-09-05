---
trigger: always_on
glob: "**/*"
description: "Règles directrices de style, design system (Vert, Blanc, Noir), composants HTML/CSS et conventions métier pour toutes les pages de SchoolFlow."
---

# SchoolFlow — Règle Maîtresse : Design System, CSS/HTML & Conventions UI ("Vert, Blanc, Noir")

Cette règle constitue le **référentiel absolu** pour la conception, le style et l'implémentation de toutes les pages de la plateforme SchoolFlow (Élèves, Scolarité, Comptabilité, Classes, Notes, Présences, Personnel, etc.).
**Toute nouvelle page ou tout nouveau composant DOIT impérativement respecter les directives suivantes sans aucune déviation.**

---

## 1. Palette de Couleurs Officielle ("Vert, Blanc, Noir")

L'identité visuelle de SchoolFlow repose sur une alliance de **Vert émeraude d'excellence**, de **Blanc pur et lumineux** et de **Noir/Slate contrasté**, complétée par des touches d'or/ambre chaleureux.

| Rôle | Token / Classe Tailwind | Code Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Vert Primaire (Accent)** | `bg-emerald-600`, `text-emerald-600` | `#10b981` / `#059669` | Boutons d'action prioritaires, onglets actifs, pagination sélectionnée, jauges |
| **Vert Foncé (Titres/Hover)** | `hover:bg-emerald-700`, `text-emerald-950`| `#047857` / `#064e3b` | Effets de survol, contrastes forts, accents identitaires |
| **Vert Pastel (Fonds doux)** | `bg-emerald-50`, `border-emerald-200` | `#ecfdf5` / `#a7f3d0` | Badges de statut "Payé/Actif", fonds d'icônes, surlignages |
| **Or / Ambre (Secondaire)** | `text-amber-500`, `bg-amber-50` | `#f59e0b` / `#fbbf24` | Badge "Flow", alertes douces, cantine/transports |
| **Blanc Pur (Surfaces)** | `bg-white` | `#ffffff` | Cartes, conteneurs, tableaux, modales, fonds de champs de saisie |
| **Fond Global de Page** | `bg-[#f8fafc]` (slate-50) | `#f8fafc` | Arrière-plan doux sous le dashboard et les écrans |
| **Noir / Slate Foncé (Textes)** | `text-slate-900`, `text-slate-800` | `#0f172a` / `#1e293b` | Titres H1/H2/H3, montants en FCFA, noms d'élèves |
| **Slate Moyen (Métadonnées)** | `text-slate-500`, `text-slate-400` | `#64748b` / `#94a3b8` | Libellés, sous-titres, placeholders, dates |
| **Bordures Subtiles** | `border-slate-200/70`, `border-slate-100` | `#e2e8f0` / `#f1f5f9` | Délimitation des cartes et des cellules de tableaux |

> [!CAUTION]
> **Interdiction formelle** : Ne jamais utiliser de couleurs criardes non harmonisées (bleu roi par défaut, rouge vif saturé, vert fluo). Utiliser exclusivement la gamme Tailwind émeraude/slate/amber/rose/blue avec leurs variantes douces.

---

## 2. Typographie & Hiérarchie des Textes

- **Titres & Chiffres Clés** : Police **`Outfit`** (`font-heading`).
  - H1 de page : `text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading`
  - Titres de cartes : `text-sm sm:text-base font-bold text-slate-900 font-heading`
  - Grands chiffres de statistiques : `text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading`
- **Textes, Données & Tableaux** : Police **`Inter`** (`font-sans`).
  - Corps de texte : `text-xs sm:text-sm text-slate-600 font-sans`
  - En-têtes de colonnes : `text-[11px] font-bold uppercase tracking-wider text-slate-400`
  - Cellules de données : `text-xs font-medium text-slate-700`
- **Identifiants & Codes (ID Élève, Facture)** : Police **`font-mono`** (`font-mono text-[11px] font-semibold text-slate-900`).

---

## 3. Données & Conventions Métier SchoolFlow (Afrique Francophone)

Toutes les pages doivent impérativement respecter les règles de données suivantes :

1. **Devise & Montants Monétaires** :
   - **STRICTEMENT en FCFA**.
   - Toujours formater via la fonction standardisée `formatFCFA(amount)` (ex: `250 000 FCFA`, `12 150 000 FCFA`).
   - Ne jamais afficher d'euros (€), de dollars ($) ou de montants sans espace séparateur de milliers.

2. **Dates** :
   - **STRICTEMENT au format français JJ/MM/AAAA**.
   - Toujours formater via `formatDate(date)` (ex: `27/08/2026`).

3. **Année Scolaire** :
   - L'année en cours est **`2026-2027`**. Toujours l'indiquer avec un badge vert émeraude : `bg-emerald-100 text-emerald-800 border-emerald-200`.

4. **Niveaux & Classes de l'Établissement (Maternelle jusqu'en 3ème — Pas de Lycée)** :
   - **Maternelle** : `Maternelle (P.S.)`, `Maternelle (M.S.)`, `Maternelle (G.S.)`
   - **Primaire** : `CP1`, `CP2`, `CE1`, `CE2`, `CM1`, `CM2`
   - **Collège** : `6ème`, `5ème`, `4ème`, `3ème`
   - *Règle d'affichage dans les tableaux* : Toujours centrer horizontalement avec `text-center`, dans un badge `inline-flex items-center justify-center font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap shadow-2xs`. Le `whitespace-nowrap` évite que `(P.S.)` ne se coupe sous `Maternelle`.

5. **Affichage du Genre (Compact & Lisible)** :
   - Toujours utiliser `GenderBadge` :
     - Garçon : **`♂ M`** en bleu doux (`bg-blue-50 text-blue-700 border-blue-200/70 font-bold px-1.5 py-0.5 rounded-md text-xs`)
     - Fille : **`♀ F`** en rose doux (`bg-pink-50 text-pink-700 border-pink-200/70 font-bold px-1.5 py-0.5 rounded-md text-xs`)
   - Ne jamais afficher "Masc.", "Fém." ou le texte complet qui surcharge inutilement les colonnes.

---

## 4. Composants UI & Motifs de Design Récurrents

### A. Cartes Statistiques KPI (Style Pandhowan)
```tsx
<div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
  {/* En-tête : Icône sur fond pastel + Titre en majuscules légères */}
  <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
    </div>
    <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
      Total Élèves Inscrits
    </h3>
  </div>

  {/* Chiffre clé Outfit + Badge d'évolution */}
  <div className="flex items-baseline gap-2">
    <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
      1 248
    </span>
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      +8%
    </span>
  </div>

  {/* Répartition de genre (si applicable) : Filles / Garçons + jauge */}
  <div className="mt-3 space-y-1.5">
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200/70 font-semibold text-[11px]">
        ♀ 640 Filles
      </span>
      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold text-[11px]">
        ♂ 608 Garçons
      </span>
    </div>
  </div>
</div>
```

### B. Tableaux de Données (Data Tables)
- **Conteneur** : `bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden`.
- **Barre d'outils (Toolbar)** :
  - Champ de recherche : icône `Search`, pleine largeur sur mobile (`w-full sm:flex-1`).
  - Menus déroulants : `select` avec `appearance-none`, flèche chevron `lucide-react`, style `rounded-xl border-slate-200 text-xs`.
  - Bouton réinitialiser : `RotateCcw` visible uniquement si un filtre est actif.
- **Scroll mobile** : Toujours envelopper la table dans `<div className="overflow-x-auto">`.
- **Lignes de table** :
  - Survol discret : `hover:bg-emerald-50/30 transition-colors`.
  - Case à cocher : case verte émeraude `text-emerald-600 focus:ring-emerald-500`.
  - Actions : bouton trois points `MoreHorizontal` avec menu flottant `shadow-lg border-slate-200 rounded-xl`.
- **Pagination** :
  - Bas de tableau interactif : "Affichage de X à Y sur Z éléments".
  - Boutons "Précédent" / "Suivant" avec `ChevronLeft` / `ChevronRight`.
  - Touches directes de pages numérotées : page active `bg-emerald-600 text-white font-bold`.

### C. Boutons d'Action
- **Bouton Primaire (Action principale)** :
  ```tsx
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5"
  ```
- **Bouton Secondaire (Export, Annuler, Filtre)** :
  ```tsx
  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs"
  ```

### D. Badges de Statut (Color-Coded Statuses)
- **Payé / Validé / Présent** : `bg-emerald-50 text-emerald-700 border border-emerald-200/80` (point vert `bg-emerald-500`)
- **Envoyé / En cours / En attente** : `bg-amber-50 text-amber-800 border border-amber-200/80` (point ambre `bg-amber-500`)
- **Brouillon / Non renseigné** : `bg-slate-100 text-slate-600 border border-slate-200` (point gris `bg-slate-400`)
- **En retard / Impayé / Absent** : `bg-rose-50 text-rose-700 border border-rose-200/80` (point rose `bg-rose-500`)

---

## 5. Architecture de Page & Responsivité Mobile

Pour chaque nouvelle page créée dans `app/[ecole]/admin/[module]/page.tsx` :

1. **Intégration dans le Shell** :
   - Toutes les vues administrateur sont rendues à l'intérieur du layout global qui utilise `<DashboardShell schoolSlug={...} breadcrumbs={['Admin', 'Module']}>`.
2. **Padding Responsive** :
   - Le conteneur principal utilise `p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-7 pb-12`.
3. **Comportement Mobile Strict** :
   - Tous les boutons d'action d'en-tête utilisent `flex-1 sm:flex-none` pour s'étaler confortablement au toucher sur smartphone.
   - Les grilles utilisent `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (ou `xl:grid-cols-5`) pour s'adapter à la largeur disponible sans coupure de texte.
   - Aucun élément ne doit provoquer de scroll horizontal involontaire en dehors du conteneur `overflow-x-auto` dédié au tableau.

---

## 6. Structure des Dossiers & Imports Standardisés

- **Types** : `@/lib/data/types.ts`
- **Formatteurs** : `@/lib/utils/formatters.ts` (`formatFCFA`, `formatDate`)
- **Données Mocks** : `@/lib/data/mock-data.ts` (`mockSchools`, `mockKPIs`, `mockInvoices`, `availableClasses`)
- **Badges UI** : `@/components/ui/badge.tsx` (`InvoiceStatusBadge`, `GenderBadge`, `TrendBadge`)
- **Composants Layout** : `@/components/layout/dashboard-shell.tsx`, `@/components/layout/sidebar.tsx`, `@/components/layout/topbar.tsx`
- **Icônes** : Toujours utiliser `lucide-react`.

---

**Appliquer scrupuleusement ces règles pour chaque nouvelle page (Élèves, Comptabilité, Scolarité, Classes, etc.) afin de garantir une expérience utilisateur haut de gamme, uniforme et sans faille.**
