'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Users,
  CreditCard,
  Calendar,
  MessageSquare,
  BarChart3,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Menu,
  X,
  Phone,
  Mail,
  Smartphone,
  Award,
  Clock,
  Zap,
  Building2,
  FileSpreadsheet,
  Check,
  PlayCircle,
  Eye,
  Lock,
  Globe,
  Landmark,
} from 'lucide-react';
import { formatFCFA } from '@/lib/utils/formatters';

interface PricingPlan {
  id: 'mensuel' | 'annuel' | 'triennal';
  name: string;
  badge?: string;
  saveBadge?: string;
  price: number;
  period: string;
  description: string;
  monthlyEquiv: string;
  features: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
  buttonText: string;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'mensuel',
    name: 'Plan Mensuel',
    badge: 'Flexible',
    price: 30000,
    period: 'par mois scolaire',
    description: 'Facturation mensuelle de Septembre à Mai (9 mensualités)',
    monthlyEquiv: '💡 Total sur 9 mois : 270 000 FCFA',
    features: [
      'Accès immédiat dès le paiement',
      'Facturation mensuelle le 1er du mois',
      'Résiliation possible en fin de mois',
      'Rappel SMS & Email 5 jours avant',
      'Zéro frais pendant les vacances d’été',
      'Toutes les fonctionnalités incluses',
      'Support par email & WhatsApp',
    ],
    buttonText: 'Choisir le mensuel (30 000 F)',
  },
  {
    id: 'annuel',
    name: 'Plan 1 An Scolaire',
    badge: '⭐ Meilleure offre',
    saveBadge: 'Économisez 20 000 FCFA',
    price: 250000,
    period: 'pour 1 année scolaire complète (9 mois)',
    description: 'Paiement unique pour l’année — Valable du 1er sept. au 31 mai',
    monthlyEquiv: '💰 Soit 27 778 FCFA / mois (20 000 FCFA d’économie)',
    features: [
      'Paiement unique en début d’année',
      '9 mois d’activité scolaire complète',
      'Économie directe de 20 000 FCFA (270 000 F → 250 000 F)',
      'Renouvellement automatique ou manuel',
      'Accès continu et archivage sécurisé',
      'Toutes les fonctionnalités incluses',
      'Support prioritaire 7j/7 dédié',
    ],
    isPopular: true,
    buttonText: 'Choisir l’annuel — Recommandé',
  },
  {
    id: 'triennal',
    name: 'Plan 3 Ans Scolaires',
    badge: '🏆 Meilleure valeur',
    saveBadge: 'Économisez 60 000 FCFA',
    price: 750000,
    period: 'pour 3 années scolaires (27 mois)',
    description: 'Paiement unique pour 3 ans — 27 mois scolaires consécutifs',
    monthlyEquiv: '🔥 Soit 250 000 FCFA / an (60 000 FCFA d’économie)',
    features: [
      'Paiement unique pour 3 années scolaires',
      '27 mois scolaires d’accès illimité garanti',
      'Économie massive de 60 000 FCFA (810 000 F → 750 000 F)',
      'Tarif 100% gelé et garanti sans hausse pendant 3 ans',
      'Toutes les fonctionnalités incluses + Mises à jour',
      'Support VIP dédié + Formation personnalisée des équipes',
    ],
    isBestValue: true,
    buttonText: 'Choisir le plan 3 ans (750 000 F)',
  },
];

const FAQS = [
  {
    question: "Qu'est-ce qu'une « année scolaire » chez SchoolFlow ?",
    answer:
      "Une année scolaire correspond à 9 mois d'activité pédagogique, du 1er septembre au 31 mai. Les mois de vacances d'été (juin, juillet et août) ne sont jamais facturés. Tous nos forfaits s'ajustent précisément à cette réalité des écoles d'Afrique de l'Ouest.",
  },
  {
    question: "Comment est calculée la réduction de 20 000 FCFA sur le Plan 1 An (250 000 FCFA) ?",
    answer:
      "Avec le plan mensuel à 30 000 FCFA / mois, une année de 9 mois revient à 270 000 FCFA (30 000 × 9). En choisissant le Plan 1 An à 250 000 FCFA, l'établissement bénéficie d'une réduction immédiate de 20 000 FCFA, soit un coût mensuel de seulement 27 778 FCFA.",
  },
  {
    question: "Comment fonctionne l'économie de 60 000 FCFA sur le Plan 3 Ans (750 000 FCFA) ?",
    answer:
      "Sur 3 années scolaires (27 mois), le tarif mensuel normal s'élèverait à 810 000 FCFA (270 000 FCFA × 3 ans). En réglant le forfait 3 ans à 750 000 FCFA, votre école réalise une économie nette de 60 000 FCFA et garantit le blocage absolu de son prix sur 3 ans sans risque d'inflation.",
  },
  {
    question: "Puis-je résilier mon abonnement mensuel ?",
    answer:
      "Oui ! Avec le plan mensuel à 30 000 FCFA, vous êtes libre de suspendre ou résilier à la fin de chaque mois scolaire. Un rappel automatique vous est envoyé par SMS et email 5 jours avant le terme.",
  },
  {
    question: "Que se passe-t-il pendant les vacances d'été (juillet et août) ?",
    answer:
      "Aucune facturation n'est prélevée pendant les vacances scolaires d'été. Vos données, notes, archives d'élèves et historiques comptables restent sauvegardés en toute sécurité et reprennent immédiatement en septembre.",
  },
];

const OFFICIAL_PARTNERS_MARQUEE = [
  {
    id: 'mena-ci',
    flagOrIcon: '🇨🇮',
    title: 'Ministère de l’Éducation Nationale (MENA)',
    subtitle: 'Côte d’Ivoire • Conforme Programmes Officiels',
    badge: 'Conforme MENA',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'mena-sn',
    flagOrIcon: '🇸🇳',
    title: 'Ministère de l’Éducation Nationale',
    subtitle: 'Sénégal • Bulletins & Coefficients Harmonisés',
    badge: 'Norme Pédagogique',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'uepa',
    flagOrIcon: '🏛️',
    title: 'Union des Établissements Privés d’Afrique',
    subtitle: 'Réseau Écoles Privées & Laïques UEMOA',
    badge: 'Partenaire Officiel',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'ssl-sec',
    flagOrIcon: '🛡️',
    title: 'Certification Sécurité SSL & Chiffrement 256-bit',
    subtitle: 'Données Scolaires 100% Sécurisées & Sauvegardées',
    badge: 'Certifié Sécurisé',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    id: 'uemoa',
    flagOrIcon: '🌍',
    title: 'Espace Francophone UEMOA & CEMAC',
    subtitle: '09 Pays d’Afrique • Monnaie FCFA Intégrée',
    badge: '09 Pays Actifs',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    id: 'mobile-money',
    flagOrIcon: '📱',
    title: 'Orange Money • Wave • MTN MoMo • Moov',
    subtitle: 'Encaissement Automatisé & Reçus Instantanés',
    badge: 'Paiements Instantanés',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'banks',
    flagOrIcon: '🏦',
    title: 'Banque Atlantique • Ecobank • SGCI • BNI',
    subtitle: 'Rapprochement Bancaire & Virements Directs',
    badge: 'Partenariat Bancaire',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
];

function ModernPartnerLogo({ id }: { id: string }) {
  switch (id) {
    case 'mena-ci':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 via-emerald-600 to-emerald-800 p-0.5 shadow-lg shadow-emerald-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/25 to-orange-500/25" />
            <GraduationCap className="w-4 h-4 text-emerald-300 relative z-10" />
            <span className="text-[8px] font-black text-amber-300 font-mono tracking-wider relative z-10 mt-0.5">CI 🇨🇮</span>
          </div>
        </div>
      );
    case 'mena-sn':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-amber-400 to-rose-600 p-0.5 shadow-lg shadow-emerald-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/25 to-rose-500/25" />
            <BookOpen className="w-4 h-4 text-amber-300 relative z-10" />
            <span className="text-[8px] font-black text-amber-300 font-mono tracking-wider relative z-10 mt-0.5">SN 🇸🇳</span>
          </div>
        </div>
      );
    case 'uepa':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-amber-500/20" />
            <Landmark className="w-4 h-4 text-amber-400 relative z-10" />
            <span className="text-[8px] font-black text-amber-200 uppercase tracking-widest relative z-10 mt-0.5">UEPA</span>
          </div>
        </div>
      );
    case 'ssl-sec':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-lg shadow-blue-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-500/20" />
            <ShieldCheck className="w-4 h-4 text-cyan-300 relative z-10" />
            <span className="text-[8px] font-bold text-cyan-200 uppercase font-mono relative z-10 mt-0.5">256-BIT</span>
          </div>
        </div>
      );
    case 'uemoa':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-purple-600 p-0.5 shadow-lg shadow-purple-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-purple-500/20" />
            <Globe className="w-4 h-4 text-purple-300 relative z-10" />
            <span className="text-[8px] font-black text-emerald-300 uppercase tracking-tighter relative z-10 mt-0.5">09 PAYS</span>
          </div>
        </div>
      );
    case 'mobile-money':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-blue-500 p-0.5 shadow-lg shadow-orange-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-orange-500/20" />
            <Smartphone className="w-4 h-4 text-amber-400 relative z-10" />
            <span className="text-[7px] font-black text-blue-300 uppercase tracking-tighter relative z-10 mt-0.5">FINTECH</span>
          </div>
        </div>
      );
    case 'banks':
      return (
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg shadow-emerald-950/60 flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-emerald-500/20" />
            <Building2 className="w-4 h-4 text-emerald-300 relative z-10" />
            <span className="text-[8px] font-bold text-teal-200 uppercase font-mono relative z-10 mt-0.5">BANQUES</span>
          </div>
        </div>
      );
    default:
      return (
        <div className="w-11 h-11 rounded-2xl bg-white/10 p-2 flex items-center justify-center text-white">
          <Award className="w-5 h-5 text-emerald-400" />
        </div>
      );
  }
}

const ROTATING_HERO_TEXTS = [
  'en toute simplicité',
  'avec bulletins en 1 clic',
  'avec scolarités en FCFA',
  'avec appel en 30 secondes',
  'conforme aux normes MENA',
  'accessible sur smartphone',
];

export function LandingView() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoActiveTab, setDemoActiveTab] = useState<'dashboard' | 'bulletins' | 'caisse'>('dashboard');

  // Compteurs statistiques animés avec montée progressive douce (0 -> 500+, 0 -> 50 000+, 0 -> 09)
  const [counterEcoles, setCounterEcoles] = useState(0);
  const [counterEleves, setCounterEleves] = useState(0);
  const [counterPays, setCounterPays] = useState(0);

  // Texte animé dynamique dans le Hero (Fonctionne à 100% sur Mobile, Tablette et PC)
  const [heroTextIndex, setHeroTextIndex] = useState(0);
  const [heroCurrentText, setHeroCurrentText] = useState('');
  const [isHeroDeleting, setIsHeroDeleting] = useState(false);

  useEffect(() => {
    const fullText = ROTATING_HERO_TEXTS[heroTextIndex];
    const speed = isHeroDeleting ? 30 : 65;

    const timer = setTimeout(() => {
      if (!isHeroDeleting) {
        setHeroCurrentText(fullText.slice(0, heroCurrentText.length + 1));
        if (heroCurrentText.length + 1 === fullText.length) {
          setTimeout(() => setIsHeroDeleting(true), 2400);
        }
      } else {
        setHeroCurrentText(fullText.slice(0, heroCurrentText.length - 1));
        if (heroCurrentText.length - 1 === 0) {
          setIsHeroDeleting(false);
          setHeroTextIndex((prev) => (prev + 1) % ROTATING_HERO_TEXTS.length);
        }
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [heroCurrentText, isHeroDeleting, heroTextIndex]);

  // Observer de Défilement (Scroll Reveal) actif sur Mobile (touch), Tablette et Ordinateur
  useEffect(() => {
    const revealElements = document.querySelectorAll('.reveal-hidden');
    if (!revealElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    revealElements.forEach((el) => observer.observe(el));

    // Force la révélation des éléments déjà dans le viewport au chargement initial
    setTimeout(() => {
      revealElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('reveal-visible');
        }
      });
    }, 150);

    return () => {
      revealElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);

    // Animation progressive douce et fluide (3500ms) pour les compteurs
    const duration = 3500;
    const steps = 80;
    const intervalTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);

      setCounterEcoles(Math.round(500 * ease));
      setCounterEleves(Math.round(50000 * ease));
      setCounterPays(Math.round(9 * ease));

      if (step >= steps) {
        clearInterval(timer);
        setCounterEcoles(500);
        setCounterEleves(50000);
        setCounterPays(9);
      }
    }, intervalTime);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(timer);
    };
  }, []);

  const handleSelectPlan = (plan: PricingPlan) => {
    router.push(`/login?mode=signup&plan=${plan.id}&price=${plan.price}`);
  };

  return (
    <div className="min-h-screen bg-[#07270f] text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* ═══════════════ NAVIGATION HEADER ═══════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0a0a0a]/92 backdrop-blur-xl border-b border-white/10 py-3 shadow-xl'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center text-2xl font-extrabold font-heading tracking-tight text-white">
                <span className="text-emerald-400">School</span>
                <span className="text-amber-400">Flow</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                Gérer • Réussir • Grandir
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-200">
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              Fonctionnalités
            </a>
            <a href="#direction" className="hover:text-emerald-400 transition-colors">
              Direction
            </a>
            <a href="#pricing" className="hover:text-emerald-400 transition-colors">
              Tarifs & Abonnements
            </a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">
              FAQ
            </a>
            <button
              type="button"
              onClick={() => setIsDemoModalOpen(true)}
              className="text-amber-300 hover:text-amber-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg border border-amber-400/30"
            >
              <PlayCircle className="w-4 h-4 text-amber-400" /> Aperçu Démo
            </button>
          </nav>

          {/* Actions CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login?mode=login"
              className="px-4 py-2 text-xs font-bold text-white hover:text-emerald-300 transition-colors border border-white/20 hover:border-white/40 rounded-xl cursor-pointer"
            >
              Espace Connexion
            </Link>
            <Link
              href="/login?mode=signup"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-xl shadow-md shadow-amber-500/20 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              Prendre un abonnement
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu (Full Responsive) */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-950/98 border-b border-white/10 px-5 py-6 space-y-4 backdrop-blur-2xl animate-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col gap-3.5 text-base font-semibold text-slate-200">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-400 py-1 flex items-center justify-between"
              >
                <span>Fonctionnalités</span>
                <span className="text-xs text-slate-500">→</span>
              </a>
              <a
                href="#direction"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-400 py-1 flex items-center justify-between"
              >
                <span>Espace Direction</span>
                <span className="text-xs text-slate-500">→</span>
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-400 py-1 flex items-center justify-between"
              >
                <span>Tarifs & Abonnements</span>
                <span className="text-xs text-slate-500">→</span>
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-emerald-400 py-1 flex items-center justify-between"
              >
                <span>Questions Fréquentes</span>
                <span className="text-xs text-slate-500">→</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsDemoModalOpen(true);
                }}
                className="text-amber-400 flex items-center gap-2 py-1 font-bold text-left cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" /> Voir l'aperçu Démo
              </button>
            </nav>
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <Link
                href="/login?mode=login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-xl border border-white/20 text-white font-bold text-sm bg-white/5 active:scale-98"
              >
                Connexion École
              </Link>
              <Link
                href="/login?mode=signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 active:scale-98"
              >
                Prendre un abonnement
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#0b3d18] via-[#135326] to-[#07270f] text-white">
        {/* Animated ambient glowing floating orbs */}
        <div className="absolute top-1/4 -right-20 w-[30rem] h-[30rem] bg-emerald-500/25 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-10 -left-20 w-[28rem] h-[28rem] bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: '5s' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Content with Animated Reveal from Left */}
            <div
              data-reveal="left"
              className="reveal-hidden lg:col-span-6 space-y-5 sm:space-y-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-semibold text-emerald-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Plateforme N°1 de gestion scolaire africaine
              </div>

              {/* Titre Principal avec Animation d'Écriture Dynamique (Typewriter) */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-heading leading-[1.18] tracking-tight">
                Gérez votre école <br />
                <span className="inline-block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent underline decoration-amber-400/40 min-h-[1.25em]">
                  {heroCurrentText || 'en toute simplicité'}
                  <span className="inline-block w-0.5 sm:w-1 h-6 sm:h-9 bg-amber-400 ml-1.5 animate-blink align-middle" />
                </span>
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-slate-200 max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
                Bulletins automatisés, encaissements scolarité en <strong className="text-white">FCFA</strong>, notes et présences en direct. Spécifiquement conçu pour les écoles et collèges d&apos;Afrique francophone.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <a
                  href="#pricing"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 shadow-xl shadow-amber-500/25 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Prendre un abonnement <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setIsDemoModalOpen(true)}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PlayCircle className="w-5 h-5 text-amber-400" /> Voir un aperçu
                </button>
              </div>

              {/* Stats Counters with Progressive Animation (0 -> 500+, 0 -> 50 000+, 0 -> 09) */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-6 sm:pt-8 border-t border-white/15 max-w-lg mx-auto lg:mx-0">
                <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/15 text-center shadow-lg transition-transform hover:scale-102">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading text-amber-400">
                    {counterEcoles}+
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-200 font-semibold mt-1">Écoles actives</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/15 text-center shadow-lg transition-transform hover:scale-102">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading text-amber-400">
                    {counterEleves.toLocaleString('fr-FR')}+
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-200 font-semibold mt-1">Élèves gérés</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/15 text-center shadow-lg transition-transform hover:scale-102">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading text-amber-400">
                    {String(counterPays).padStart(2, '0')}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-200 font-semibold mt-1">Pays d&apos;Afrique</div>
                </div>
              </div>
            </div>

            {/* Right Interactive Dashboard Mockup Card with Animated Reveal from Right */}
            <div
              data-reveal="right"
              className="reveal-hidden lg:col-span-6 relative"
            >
              {/* Floating Badge 1 (Top Right) - Visible sur Mobile & Desktop */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 absolute -top-3 -right-2 sm:-top-4 sm:-right-4 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-900/95 text-white border border-emerald-500/40 shadow-2xl backdrop-blur-md animate-float-slow z-20">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] sm:text-xs font-bold text-emerald-300">100% Conforme MENA 🇨🇮 🇸🇳</span>
              </div>

              {/* Floating Badge 2 (Bottom Left) - Visible sur Mobile & Desktop */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 absolute -bottom-3 -left-2 sm:-bottom-4 sm:-left-4 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-900/95 text-white border border-amber-500/40 shadow-2xl backdrop-blur-md animate-float-reverse z-20">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                <span className="text-[10px] sm:text-xs font-bold text-amber-300">+35% Recouvrement Caisse</span>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-7 shadow-2xl shadow-black/50 border border-white/20 text-slate-800 relative z-10">
                {/* Mockup Header Neutral */}
                <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      SF
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Tableau de bord Général</div>
                      <div className="text-[10px] text-slate-400">Année Scolaire 2026–2027</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    🟢 Système Actif
                  </span>
                </div>

                {/* KPI mini widgets */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4 sm:mb-5">
                  <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-100 text-center">
                    <div className="text-base sm:text-xl font-extrabold font-heading text-emerald-600">1 243</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Élèves</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-100 text-center">
                    <div className="text-base sm:text-xl font-extrabold font-heading text-amber-600">87%</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Recouvrement</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-100 text-center">
                    <div className="text-base sm:text-xl font-extrabold font-heading text-blue-600">24</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Absences/J</div>
                  </div>
                </div>

                {/* Sub grid: Monthly Bars + Recent Payments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  {/* Monthly Receipts */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center justify-between">
                      <span>Recettes mensuelles</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">FCFA</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { month: 'Sep', pct: '92%', color: 'bg-emerald-500' },
                        { month: 'Oct', pct: '85%', color: 'bg-emerald-500' },
                        { month: 'Nov', pct: '78%', color: 'bg-emerald-500' },
                        { month: 'Déc', pct: '60%', color: 'bg-amber-500' },
                        { month: 'Jan', pct: '50%', color: 'bg-orange-500' },
                      ].map((item) => (
                        <div key={item.month} className="flex items-center gap-2 text-[11px]">
                          <span className="w-7 text-slate-400 font-semibold">{item.month}</span>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full`} style={{ width: item.pct }} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600">{item.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Payments */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 mb-2">Encaissements récents</div>
                      <div className="space-y-2">
                        {[
                          { name: 'K. Aya (CM2)', amount: '35 000 F', status: 'Payé', bg: 'bg-emerald-100 text-emerald-800' },
                          { name: 'B. Kofi (6ème)', amount: '20 000 F', status: 'Partiel', bg: 'bg-amber-100 text-amber-800' },
                          { name: 'D. Fatou (3ème)', amount: '50 000 F', status: 'Payé', bg: 'bg-emerald-100 text-emerald-800' },
                          { name: 'M. Soro (CE1)', amount: '0 F', status: 'En retard', bg: 'bg-rose-100 text-rose-800' },
                        ].map((pay, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
                            <span className="font-semibold text-slate-700 truncate max-w-[100px]">{pay.name}</span>
                            <span className="font-mono text-slate-600 font-medium">{pay.amount}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pay.bg}`}>
                              {pay.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert Footer */}
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-amber-900">
                  <span className="text-base">📄</span>
                  <span className="font-medium truncate">
                    3 bulletins PDF générés pour la <strong>3ème A</strong> · Prêts à l’impression
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TRUST TICKER / PARTNERS MARQUEE (DÉFILEMENT INFINI DE DROITE À GAUCHE) ═══════════════ */}
      <section
        data-reveal="up"
        className="reveal-hidden bg-slate-950 py-6 sm:py-7 border-y border-white/10 overflow-hidden relative group"
      >
        {/* Glow ambient lines */}
        <div className="absolute inset-y-0 left-0 w-20 sm:w-36 bg-gradient-to-r from-slate-950 via-slate-950/90 to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-20 sm:w-36 bg-gradient-to-l from-slate-950 via-slate-950/90 to-transparent z-20 pointer-events-none" />

        <div className="animate-marquee flex items-center gap-4 sm:gap-6">
          {[...OFFICIAL_PARTNERS_MARQUEE, ...OFFICIAL_PARTNERS_MARQUEE].map((partner, index) => (
            <div
              key={`${partner.id}-${index}`}
              className="flex items-center gap-3.5 px-4 sm:px-5 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-emerald-400/40 backdrop-blur-md shadow-xl transition-all duration-300 shrink-0 cursor-default group/card"
            >
              <ModernPartnerLogo id={partner.id} />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white font-heading tracking-tight whitespace-nowrap group-hover/card:text-amber-300 transition-colors">
                    {partner.title}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider whitespace-nowrap shadow-xs ${partner.badgeColor}`}>
                    {partner.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium whitespace-nowrap mt-0.5">
                  {partner.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ FEATURES SECTION ═══════════════ */}
      <section id="features" className="py-16 lg:py-24 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            data-reveal="up"
            className="reveal-hidden text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3 sm:space-y-4"
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 shadow-2xs">
              ✨ Fonctionnalités Complètes
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-slate-900 tracking-tight">
              Tout ce dont votre établissement a besoin
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Une suite tout-en-un développée sur-mesure pour la réalité des écoles en Côte d’Ivoire, au Sénégal et dans toute la zone UEMOA / CEMAC.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Gestion des Notes & Évaluations',
                desc: 'Saisie ultra-rapide par matière, calcul automatique des coefficients et génération des moyennes en un éclair.',
              },
              {
                icon: FileSpreadsheet,
                title: 'Bulletins Scolaires Officiels',
                desc: 'Bulletins trimestriels ou semestriels conformes aux normes ministérielles, téléchargeables et imprimables en PDF A4.',
              },
              {
                icon: CreditCard,
                title: 'Comptabilité & Scolarité en FCFA',
                desc: 'Facturation par tranches, suivi des impayés, reçus numérotés automatiques et intégration Mobile Money.',
              },
              {
                icon: Users,
                title: 'Effectifs & Dossiers Élèves',
                desc: 'Gestion complète : fiches individuelles, matricules uniques, suivi médical, réduction fratrie et bourses.',
              },
              {
                icon: Clock,
                title: 'Présences & Assiduité en Temps Réel',
                desc: 'Appel en classe en 30 secondes par les professeurs, alertes directes et statistiques d’absentéisme.',
              },
              {
                icon: MessageSquare,
                title: 'Communication & SMS Parents',
                desc: 'Envoi d’avis de paiement, alertes d’absence et convocations directement sur les téléphones des parents.',
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  data-reveal="up"
                  className="reveal-hidden bg-white rounded-2xl p-5 sm:p-7 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-400 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-xs group-hover:scale-110">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Showcase 1: Direction & Pilotage (Photo Africaine Authentique + Hover Micro-animation) */}
          <div
            id="direction"
            className="mt-14 sm:mt-16 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-slate-800 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div
              data-reveal="left"
              className="reveal-hidden lg:col-span-7 space-y-4 text-left"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                👔 Espace Direction & Pilotage
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                Un contrôle total sur la vie financière et académique
              </h3>
              <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
                Pilotez votre école en toute sérénité depuis votre bureau ou votre smartphone. Accédez instantanément au recouvrement global, aux effectifs par niveau et signez les bulletins en un clic.
              </p>
              <ul className="space-y-2.5 pt-2">
                {[
                  'Validation et signature officielle des bulletins en un clic',
                  'Suivi en temps réel des encaissements en caisse et par Mobile Money',
                  'Rapports d’audit clairs pour les fondateurs et directeurs d’études',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm text-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              data-reveal="right"
              className="reveal-hidden lg:col-span-5"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-white/15 group relative cursor-pointer">
                <img
                  src="/images/african_school_director.jpg"
                  alt="Directeur d'établissement africain pilotant son école avec SchoolFlow"
                  className="w-full h-64 sm:h-80 object-cover transition-all duration-700 ease-out transform group-hover:scale-108 group-hover:brightness-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <span className="text-xs font-bold text-white bg-emerald-600/90 px-3 py-1.5 rounded-lg backdrop-blur-md">
                    Direction & Pilotage d'Excellence
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SCHOOL YEAR CALENDAR BANNER ═══════════════ */}
      <section className="py-14 sm:py-16 bg-slate-950 text-white border-y border-white/10 relative overflow-hidden">
        <div
          data-reveal="up"
          className="reveal-hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6"
        >
          <div className="space-y-2">
            <h2 className="text-xl sm:text-3xl font-extrabold font-heading text-white">
              📆 Année scolaire active : Septembre → Mai (9 Mois d’activité)
            </h2>
            <p className="text-xs sm:text-base text-slate-400 max-w-2xl mx-auto">
              Nos formules s’adaptent au calendrier scolaire réel. Vous ne payez absolument rien pendant les vacances d’été (juin, juillet, août).
            </p>
          </div>

          {/* 12 Months Visualizer */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 pt-2">
            {['Sept', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai'].map((m) => (
              <span
                key={m}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/30"
              >
                {m} ✓
              </span>
            ))}
            {['Juin', 'Juil', 'Août'].map((m) => (
              <span
                key={m}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold bg-white/5 text-slate-500 border border-white/10 line-through"
              >
                {m} (Vacances)
              </span>
            ))}
          </div>

          {/* Showcase 2: Secrétariat & Inscriptions (Photo Africaine + Micro-animation) */}
          <div className="mt-10 sm:mt-12 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-slate-800 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
            <div
              data-reveal="left"
              className="reveal-hidden lg:col-span-5 order-2 lg:order-1"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-white/15 group relative cursor-pointer">
                <img
                  src="/images/african_school_secretary.jpg"
                  alt="Secrétariat et accueil des parents avec SchoolFlow"
                  className="w-full h-64 sm:h-80 object-cover transition-all duration-700 ease-out transform group-hover:scale-108 group-hover:brightness-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <span className="text-xs font-bold text-white bg-amber-500/90 px-3 py-1.5 rounded-lg backdrop-blur-md">
                    Secrétariat & Accueil des Familles
                  </span>
                </div>
              </div>
            </div>
            <div
              data-reveal="right"
              className="reveal-hidden lg:col-span-7 space-y-4 order-1 lg:order-2"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🤝 Secrétariat & Inscriptions
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                Une relation fluide et transparente avec les familles
              </h3>
              <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
                Délivrez des reçus de caisse certifiés avec quittance officielle instantanée. Simplifiez les inscriptions et éliminez les longues files d’attente à la rentrée.
              </p>
              <ul className="space-y-2.5 pt-2">
                {[
                  'Inscriptions rapides et attribution automatique des classes',
                  'Encaissement instantané avec quittance officielle imprimable',
                  'Historique complet des versements par élève et relance automatique',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm text-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING SECTION (30 000, 250 000, 750 000 FCFA) ═══════════════ */}
      <section id="pricing" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            data-reveal="up"
            className="reveal-hidden text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3 sm:space-y-4"
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 shadow-2xs">
              💎 Formules d'Abonnement en FCFA
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold font-heading text-slate-900 tracking-tight">
              Choisissez votre formule d'abonnement
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Des tarifs transparents, adaptés au calendrier scolaire (Septembre → Mai). Aucun frais d’installation caché.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-6xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                data-reveal="up"
                className={`reveal-hidden rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.isPopular
                    ? 'bg-slate-950 text-white border-2 border-emerald-500 shadow-2xl shadow-emerald-600/20 lg:-translate-y-3'
                    : plan.isBestValue
                    ? 'bg-white border-2 border-amber-400 shadow-xl'
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-lg'
                }`}
              >
                <div>
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {plan.badge && (
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          plan.isPopular
                            ? 'bg-emerald-500 text-white'
                            : plan.isBestValue
                            ? 'bg-amber-400 text-slate-950 font-extrabold'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    )}
                    {plan.saveBadge && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {plan.saveBadge}
                      </span>
                    )}
                  </div>

                  <h3
                    className={`text-xl font-bold font-heading mb-2 ${
                      plan.isPopular ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {plan.name}
                  </h3>

                  {/* Price in FCFA */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`text-3xl sm:text-4xl font-extrabold font-heading tracking-tight ${
                        plan.isPopular ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {formatFCFA(plan.price)}
                    </span>
                  </div>
                  <div className={`text-xs mb-4 ${plan.isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                    {plan.period}
                  </div>

                  <p
                    className={`text-xs pb-4 mb-4 border-b ${
                      plan.isPopular
                        ? 'text-slate-300 border-white/10'
                        : 'text-slate-600 border-slate-100'
                    }`}
                  >
                    {plan.description}
                  </p>

                  <div
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold mb-6 inline-block ${
                      plan.isPopular
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : plan.isBestValue
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {plan.monthlyEquiv}
                  </div>

                  {/* Features list */}
                  <ul className="space-y-2.5 sm:space-y-3 mb-8">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <CheckCircle2
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            plan.isPopular ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        />
                        <span className={plan.isPopular ? 'text-slate-200' : 'text-slate-700'}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-600/30'
                      : plan.isBestValue
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 shadow-amber-500/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {plan.buttonText} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ TEACHERS MOBILE SHOWCASE (Photo Africaine + Micro-animation) ═══════════════ */}
      <section className="py-16 lg:py-20 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-slate-800 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div
              data-reveal="left"
              className="reveal-hidden lg:col-span-7 space-y-4 text-left"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                📱 Application Mobile Enseignants
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                Saisie des notes et appel des absences directement en classe
              </h3>
              <p className="text-xs sm:text-sm lg:text-base text-slate-300 leading-relaxed">
                Les professeurs gagnent un temps précieux : appel en moins de 30 secondes chrono, saisie simplifiée des notes d’interrogations et calcul instantané du classement.
              </p>
              <ul className="space-y-2.5 pt-2">
                {[
                  'Compatible avec tous les smartphones (Android & iOS)',
                  'Alertes immédiates envoyées aux parents en cas d’absence',
                  'Zéro ressaisie papier pour le secrétariat et la direction',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm text-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              data-reveal="right"
              className="reveal-hidden lg:col-span-5"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-white/15 group relative cursor-pointer">
                <img
                  src="/images/african_teachers_classroom.jpg"
                  alt="Enseignant africain utilisant SchoolFlow sur smartphone en salle de classe"
                  className="w-full h-64 sm:h-80 object-cover transition-all duration-700 ease-out transform group-hover:scale-108 group-hover:brightness-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <span className="text-xs font-bold text-white bg-blue-600/90 px-3 py-1.5 rounded-lg backdrop-blur-md">
                    Gestion Pédagogique & Appel Mobile
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ACCORDION ═══════════════ */}
      <section id="faq" className="py-16 lg:py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            data-reveal="up"
            className="reveal-hidden text-center mb-10 sm:mb-12 space-y-3"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 shadow-2xs">
              ❓ Questions Fréquentes
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
              Tout ce que vous devez savoir sur nos abonnements
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  data-reveal="up"
                  className="reveal-hidden bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-5 sm:px-6 py-4 text-left flex items-center justify-between font-bold text-xs sm:text-sm lg:text-base text-slate-800 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
                        isOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ FINAL CALL TO ACTION ═══════════════ */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-[#0b3d18] via-[#135326] to-[#07270f] text-white text-center relative overflow-hidden">
        <div
          data-reveal="zoom"
          className="reveal-hidden max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-5 sm:space-y-6"
        >
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold font-heading leading-tight">
            Prêt à digitaliser votre établissement ?
          </h2>
          <p className="text-xs sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed">
            Rejoignez plus de 500 établissements scolaires d’Afrique qui font confiance à SchoolFlow pour leur gestion quotidienne.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-xl shadow-amber-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Prendre un abonnement maintenant <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all text-center"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="bg-black text-slate-400 py-12 border-t border-white/10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-extrabold text-xl font-heading">
              <span className="text-emerald-400">School</span>
              <span className="text-amber-400">Flow</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              La solution de référence pour la gestion des écoles maternelles, primaires et collèges en Afrique francophone.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Fonctionnalités
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Abonnements & Tarifs
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setIsDemoModalOpen(true)}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Aperçu Démo
                </button>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Portail de Connexion
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3">Modules Clés</h4>
            <ul className="space-y-2">
              <li>Gestion des Élèves & Effectifs</li>
              <li>Scolarité & Facturation FCFA</li>
              <li>Bulletins & Relevés de Notes</li>
              <li>Présences & SMS aux Parents</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-xs mb-3">Assistance & Contact</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-white">
                <Phone className="w-4 h-4 text-emerald-400" /> +225 07 48 92 11 00
              </li>
              <li className="flex items-center gap-2 text-white">
                <Mail className="w-4 h-4 text-emerald-400" /> contact@schoolflow.ci
              </li>
              <li className="text-slate-400">Abidjan, Côte d'Ivoire & Dakar, Sénégal</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p>© 2026-2027 SchoolFlow. Tous droits réservés.</p>
          <p className="text-emerald-400 font-medium">Fait avec 💚 pour l'excellence de l'éducation en Afrique</p>
        </div>
      </footer>

      {/* ═══════════════ MODALE APERÇU DÉMO (Reste sur la Landing Page) ═══════════════ */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsDemoModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/30">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900">
                  Aperçu de la Démo SchoolFlow
                </h3>
                <p className="text-xs text-slate-500">
                  Découvrez les interfaces clés avant de souscrire votre abonnement
                </p>
              </div>
            </div>

            {/* Demo Navigation Tabs */}
            <div className="flex items-center gap-2 mb-5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDemoActiveTab('dashboard')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  demoActiveTab === 'dashboard'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Tableau de Bord
              </button>
              <button
                type="button"
                onClick={() => setDemoActiveTab('bulletins')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  demoActiveTab === 'bulletins'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📜 Bulletins & Notes
              </button>
              <button
                type="button"
                onClick={() => setDemoActiveTab('caisse')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  demoActiveTab === 'caisse'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💰 Caisse & Scolarités
              </button>
            </div>

            {/* Tab Contents Preview */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6 space-y-3">
              {demoActiveTab === 'dashboard' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Pilotage en Direct</span>
                    <span className="text-emerald-600">Données Sécurisées</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Vue consolidée des effectifs de la Maternelle à la 3ème, taux de recouvrement des scolarités en FCFA, alertes d'absences en classe et statistiques académiques en temps réel.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-emerald-600">1 243</div>
                      <div className="text-[10px] text-slate-400">Total Élèves</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-amber-600">87%</div>
                      <div className="text-[10px] text-slate-400">Recouvrement</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-blue-600">24/jour</div>
                      <div className="text-[10px] text-slate-400">Présences</div>
                    </div>
                  </div>
                </div>
              )}

              {demoActiveTab === 'bulletins' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Génération PDF A4 & Coefficients</span>
                    <span className="text-emerald-600">Conforme MENA</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Saisie instantanée des notes d'interrogations et compositions. Calcul automatique des moyennes pondérées, des rangs par classe et impression en 1 clic de quittances et bulletins certifiés.
                  </p>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">📄 Bulletin Trimestre 1 — 3ème A</span>
                    <span className="text-emerald-700 font-bold">Prêt à l'impression</span>
                  </div>
                </div>
              )}

              {demoActiveTab === 'caisse' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Gestion des Versements en FCFA</span>
                    <span className="text-emerald-600">Mobile Money & Espèces</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Suivi des tranches de paiement, gestion des bourses et réductions fratrie, génération immédiate de reçus numérotés et rapports de caisse journaliers infalsifiables.
                  </p>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">💳 Encaissements du jour</span>
                    <span className="font-mono font-bold text-emerald-800">450 000 FCFA</span>
                  </div>
                </div>
              )}
            </div>

            {/* Call to action in modal */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <a
                href="#pricing"
                onClick={() => setIsDemoModalOpen(false)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-center bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Prendre un abonnement pour activer votre école <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setIsDemoModalOpen(false)}
                className="w-full sm:w-auto py-3 px-5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
              >
                Fermer l'aperçu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
