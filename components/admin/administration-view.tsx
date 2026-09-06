'use client';

import React, { useState, useEffect } from 'react';
import {
  StaffUser,
  getLiveStaffUsers,
  saveLiveStaffUsers,
  updateStaffAuthCode,
  updateFullStaffUser,
  addLiveStaffUser,
  deleteLiveStaffUser,
  getLiveSchool,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import {
  KeyRound,
  Users,
  ShieldCheck,
  Search,
  Plus,
  Copy,
  Check,
  Smartphone,
  Edit2,
  Lock,
  Unlock,
  X,
  BookOpen,
  CheckCircle2,
  UserCheck,
  Shield,
  Eye,
  GraduationCap,
  Trash2,
  Share2,
} from 'lucide-react';

interface AdministrationViewProps {
  schoolSlug: string;
}

export function AdministrationView({ schoolSlug }: AdministrationViewProps) {
  const [staffList, setStaffList] = useState<StaffUser[]>(() => getLiveStaffUsers(schoolSlug));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'enseignants' | 'administration'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modale d'ajout — Postes nécessitant un code d'authentification uniquement
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'enseignant' | 'secretaire' | 'comptable' | 'assistant_direction' | 'educateur' | 'informaticien'>('enseignant');
  const [newMatricule, setNewMatricule] = useState('');
  const [newSubject, setNewSubject] = useState('Toutes les matières (Enseignant Titulaire / Polyvalent)');
  const [newClasses, setNewClasses] = useState('Toutes les classes');
  const [newDiploma, setNewDiploma] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAuthCode, setNewAuthCode] = useState('');

  // Modale de Fiche Détaillée & Plus d'Informations (Empêche le défilement horizontal et permet une vue exhaustive)
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffUser | null>(null);

  // Modale d'édition Complète du Membre
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'directeur' | 'enseignant' | 'secretaire' | 'comptable' | 'assistant_direction' | 'educateur' | 'informaticien'>('enseignant');
  const [editMatricule, setEditMatricule] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editClasses, setEditClasses] = useState('');
  const [editDiploma, setEditDiploma] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAuthCodeValue, setEditAuthCodeValue] = useState('');
  const [editStatus, setEditStatus] = useState<'Actif' | 'En attente' | 'Verrouillé'>('Actif');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadStaff = () => {
    setStaffList(getLiveStaffUsers(schoolSlug));
  };

  useEffect(() => {
    loadStaff();
    window.addEventListener(DATA_UPDATED_EVENT, loadStaff);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, loadStaff);
  }, [schoolSlug]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Copier le code dans le presse-papier
  const handleCopyCode = (code: string, id: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(code);
      setCopiedId(id);
      showToast(`Code d'authentification ${code} copié dans le presse-papier !`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Générer un code aléatoire sécurisé
  const generateRandomCode = (role: string) => {
    const prefix =
      role === 'enseignant'
        ? 'ENS'
        : role === 'assistant_direction'
        ? 'AST'
        : role === 'educateur'
        ? 'EDU'
        : role === 'informaticien'
        ? 'INF'
        : role === 'comptable'
        ? 'CPT'
        : role === 'secretaire'
        ? 'SEC'
        : 'STF';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  // Ouvrir la modale d'édition complète
  const openEditModal = (staff: StaffUser) => {
    // Le fondateur ne peut jamais être modifié (lecture seule uniquement)
    if (staff.roleId === 'fondateur' || staff.id === 'staff-founder') {
      alert("Les coordonnées du Fondateur sont protégées et ne peuvent pas être modifiées.");
      return;
    }
    setEditingStaff(staff);
    setEditFullName(staff.fullName);
    const validRoles: ('directeur' | 'enseignant' | 'secretaire' | 'comptable' | 'assistant_direction' | 'educateur' | 'informaticien')[] = [
      'directeur', 'enseignant', 'secretaire', 'comptable', 'assistant_direction', 'educateur', 'informaticien'
    ];
    setEditRole(validRoles.includes(staff.roleId as any) ? (staff.roleId as any) : 'enseignant');
    setEditMatricule(staff.matricule || `EMP-${staff.authCode}`);
    setEditSubject(staff.subjectOrGrade || (staff.roleId === 'directeur' ? 'Direction Générale des Études' : 'Toutes les matières (Enseignant Titulaire / Polyvalent)'));
    setEditClasses(staff.assignedClasses || 'Toutes les classes');
    setEditDiploma(staff.diplomaOrExperience || '');
    setEditAddress(staff.address || '');
    setEditEmail(staff.email || '');
    setEditPhone(staff.phone || '');
    setEditAuthCodeValue(staff.authCode || 'DIR-2026');
    setEditStatus(staff.status);
  };

  // Basculer statut Actif / Verrouillé (Accès immédiatement bloqué si verrouillé)
  const toggleStatus = (staff: StaffUser) => {
    const nextStatus = staff.status === 'Actif' ? 'Verrouillé' : 'Actif';
    const updated = staffList.map((s) => (s.id === staff.id ? { ...s, status: nextStatus as any } : s));
    saveLiveStaffUsers(updated, schoolSlug);
    showToast(
      nextStatus === 'Verrouillé'
        ? `🔒 Compte de ${staff.fullName} verrouillé. L'accès lui est désormais strictement bloqué.`
        : `✅ Compte de ${staff.fullName} réactivé avec succès.`
    );
  };

  // Partager les accès officiels sur WhatsApp
  const handleShareWhatsApp = (staff: StaffUser) => {
    const school = getLiveSchool(schoolSlug);
    const cleanPhone = (staff.phone || '').replace(/[^0-9]/g, '');
    const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/${schoolSlug}/login` : `https://saas-school-flow-12xh.vercel.app/${schoolSlug}/login`;
    const message = `👋 *Bonjour ${staff.fullName}*,\n\nVoici vos accès officiels sur la plateforme *SchoolFlow* de l’établissement *${school.shortName || school.name}* :\n\n👤 *Poste / Rôle* : ${staff.role}\n🆔 *Matricule* : ${staff.matricule || 'Attribué'}\n🔑 *Code d'Authentification* : *${staff.authCode}*\n🌐 *Lien de Connexion Direct* : ${loginUrl}\n\n_(Gardez ce code strictement personnel et confidentiel pour accéder à votre espace de travail)._`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    showToast(`Lien et code de ${staff.fullName} prêts sur WhatsApp`);
  };

  // Supprimer / Révoquer un profil et son code
  const handleDeleteStaff = (staff: StaffUser) => {
    if (staff.roleId === 'directeur' || staff.roleId === 'fondateur' || staff.id === 'staff-founder' || staff.id === 'staff-001') {
      alert("Impossible de supprimer un compte de Direction Principale.");
      return;
    }
    if (confirm(`Confirmez-vous la révocation définitive du compte de « ${staff.fullName} » ? Son code d'accès sera immédiatement désactivé.`)) {
      deleteLiveStaffUser(staff.id, schoolSlug);
      showToast(`Compte et code de ${staff.fullName} révoqués avec succès.`);
    }
  };

  // Sauvegarder l'édition complète d'un membre
  const handleSaveFullEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editFullName.trim()) return;

    const roleTitleMap: Record<string, string> = {
      directeur: 'Directeur des Études (Admin)',
      assistant_direction: 'Assistant(e) de Direction',
      educateur: 'Éducateur / Conseiller d’Éducation (Vie Scolaire)',
      informaticien: 'Informaticien / Responsable IT (Systèmes & Réseau)',
      comptable: 'Comptable / Gestionnaire',
      secretaire: 'Secrétaire de Direction',
      enseignant: 'Enseignant / Professeur Titulaire (Toutes matières)',
      fondateur: 'Fondateur / Fondatrice (Supervision)',
      parent: 'Parent d’Élève (Espace Famille)',
    };

    const updatedUser: StaffUser = {
      ...editingStaff,
      fullName: editFullName.trim(),
      role: roleTitleMap[editRole] || editingStaff.role || 'Membre du Personnel',
      roleId: editRole,
      matricule: editMatricule.trim() || `EMP-${editAuthCodeValue.trim()}`,
      subjectOrGrade: editSubject.trim() || (editRole === 'enseignant' ? 'Toutes les matières (Enseignant Polyvalent)' : 'Administration'),
      assignedClasses: editClasses.trim() || (editRole === 'enseignant' ? 'Toutes les classes' : 'Toutes'),
      diplomaOrExperience: editDiploma.trim() || undefined,
      address: editAddress.trim() || undefined,
      email: editEmail.trim() || editingStaff.email,
      phone: editPhone.trim(),
      authCode: editAuthCodeValue.trim().toUpperCase(),
      status: editStatus,
    };

    updateFullStaffUser(updatedUser, schoolSlug);
    showToast(`✅ Informations de ${updatedUser.fullName} mises à jour avec succès !`);
    setEditingStaff(null);
  };

  // Ajouter un nouveau membre (Email et Adresse retirés à la saisie, email alimenté lors de la connexion)
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) return;

    const generatedCode = newAuthCode.trim() || generateRandomCode(newRole);
    const roleTitleMap: Record<string, string> = {
      assistant_direction: 'Assistant(e) de Direction',
      educateur: 'Éducateur / Conseiller d’Éducation (Vie Scolaire)',
      informaticien: 'Informaticien / Responsable IT (Systèmes & Réseau)',
      comptable: 'Comptable / Gestionnaire',
      secretaire: 'Secrétaire de Direction',
      enseignant: 'Enseignant / Professeur Titulaire (Toutes matières)',
    };

    const cleanSlug = schoolSlug || 'schoolflow';
    const autoEmail = newEmail.trim() || `${newFullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '.')}@${cleanSlug}.ci`;

    const newStaffMember: StaffUser = {
      id: `staff-${Date.now().toString().slice(-4)}`,
      fullName: newFullName.trim(),
      role: roleTitleMap[newRole] || 'Membre du Personnel',
      roleId: newRole,
      matricule: newMatricule.trim() || `EMP-${generatedCode.toUpperCase()}`,
      subjectOrGrade: newSubject.trim() || (newRole === 'enseignant' ? 'Toutes les matières (Enseignant Polyvalent)' : 'Administration'),
      assignedClasses: newClasses.trim() || (newRole === 'enseignant' ? 'Toutes les classes' : 'Toutes'),
      diplomaOrExperience: newDiploma.trim() || 'Diplôme d’État & Expérience reconnue',
      address: newAddress.trim() || 'Abidjan, Côte d’Ivoire',
      joinDate: '01/09/2026',
      email: autoEmail,
      phone: newPhone.trim() || '+225 07 00 00 00 00',
      authCode: generatedCode.toUpperCase(),
      status: 'Actif',
      lastLogin: 'Jamais connecté',
    };

    addLiveStaffUser(newStaffMember, schoolSlug);
    showToast(`Compte configuré pour ${newStaffMember.fullName} (Code: ${newStaffMember.authCode})`);
    
    // Reset
    setNewFullName('');
    setNewMatricule('');
    setNewSubject('Toutes les matières (Enseignant Titulaire / Polyvalent)');
    setNewClasses('Toutes les classes');
    setNewDiploma('');
    setNewAddress('');
    setNewEmail('');
    setNewPhone('');
    setNewAuthCode('');
    setIsAddModalOpen(false);
  };

  // Filtrage
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.authCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.subjectOrGrade && s.subjectOrGrade.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.assignedClasses && s.assignedClasses.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || s.roleId === roleFilter;

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'enseignants' && s.roleId === 'enseignant') ||
      (activeTab === 'administration' && s.roleId !== 'enseignant');

    return matchesSearch && matchesRole && matchesTab;
  });

  // Statistiques
  const totalUsers = staffList.length;
  const teachersCount = staffList.filter((s) => s.roleId === 'enseignant').length;
  const adminCount = staffList.filter((s) => s.roleId !== 'enseignant' && s.roleId !== 'parent').length;
  const activeCount = staffList.filter((s) => s.status === 'Actif').length;

  return (
    <div className="space-y-6">
      
      {/* ================= EN-TÊTE DE PAGE ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-heading">
                Administration & Codes d&apos;Accès Sécurisés
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Espace Direction • Attribution, réinitialisation des codes d&apos;authentification et gestion du personnel
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewAuthCode(generateRandomCode(newRole));
              setNewSubject('Toutes les matières (Enseignant Titulaire / Polyvalent)');
              setNewClasses('Toutes les classes');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Utilisateur & Code</span>
          </button>
        </div>
      </div>

      {/* ================= 4 CARTES KPI STATISTIQUES ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Utilisateurs */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Personnel
              </h3>
              <span className="text-2xl font-extrabold text-slate-900 font-heading">
                {totalUsers}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Membres et profils répertoriés</p>
        </div>

        {/* Enseignants */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Corps Enseignant
              </h3>
              <span className="text-2xl font-extrabold text-slate-900 font-heading">
                {teachersCount}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Professeurs avec code d&apos;accès actif</p>
        </div>

        {/* Direction & Administration */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pôle Gestion & Secrétariat
              </h3>
              <span className="text-2xl font-extrabold text-slate-900 font-heading">
                {adminCount}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Comptable, Secrétaire, Assistante, IT</p>
        </div>

        {/* Codes Actifs */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Codes Authentifiés
              </h3>
              <span className="text-2xl font-extrabold text-teal-700 font-heading">
                {activeCount} / {totalUsers}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-teal-700 font-semibold">Comptes autorisés et actifs</p>
        </div>

      </div>

      {/* ================= ONGLETS DE NAVIGATION & GESTION ================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => { setActiveTab('all'); setRoleFilter('all'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Tous les Utilisateurs ({totalUsers})
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('enseignants'); setRoleFilter('enseignant'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'enseignants'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Corps Enseignant & Codes ({teachersCount})</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('administration'); setRoleFilter('all'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'administration'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Administration & Secrétariat ({adminCount})</span>
        </button>
      </div>

      {/* ================= TABLEAU DE GESTION DU PERSONNEL & CODES SANS BARRE DE DÉFILEMENT PARASITE ================= */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* BARRE D'OUTILS & FILTRES */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-88">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher enseignant, matière, classe, email ou code..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-emerald-600 focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les postes avec code</option>
              <option value="enseignant">Enseignants (Toutes matières)</option>
              <option value="secretaire">Secrétaires</option>
              <option value="comptable">Comptables</option>
              <option value="assistant_direction">Assistant(e) Direction</option>
              <option value="educateur">Éducateurs (Vie Scolaire)</option>
              <option value="informaticien">Informaticiens (IT)</option>
            </select>
          </div>
        </div>

        {/* TABLE DES MEMBRES ET CODES (Affichage fluide de toutes les colonnes sans défilement horizontal) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3.5">Membre & Contact</th>
                <th className="py-3 px-2.5 text-center">Poste & Matricule</th>
                <th className="py-3 px-2.5">Attributions & Matières</th>
                <th className="py-3 px-2.5 text-center">Code d&apos;Authentification</th>
                <th className="py-3 px-2 text-center">Statut d&apos;Accès</th>
                <th className="py-3 px-2.5 text-center">Dernière Connexion</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucun membre trouvé pour ces critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-emerald-50/40 transition-colors">
                    
                    {/* 1. Nom, Contact & Avatar */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 font-extrabold flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs text-xs">
                          {member.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <strong className="block text-slate-900 font-bold font-heading text-xs truncate max-w-[180px]">
                            {member.fullName}
                          </strong>
                          <span className="text-[10.5px] text-slate-500 font-mono block truncate max-w-[180px]">
                            {member.email}
                          </span>
                          <span className="text-[10.5px] text-emerald-800 font-mono font-medium block">
                            {member.phone}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Poste & Matricule */}
                    <td className="py-3 px-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold border whitespace-nowrap mb-1 ${
                        member.roleId === 'enseignant'
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
                          : member.roleId === 'secretaire'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : member.roleId === 'comptable'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : member.roleId === 'assistant_direction'
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : member.roleId === 'educateur'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : member.roleId === 'informaticien'
                          ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        {member.roleId === 'enseignant'
                          ? '👨‍🏫 Enseignant'
                          : member.roleId === 'secretaire'
                          ? '📝 Secrétaire'
                          : member.roleId === 'comptable'
                          ? '💼 Comptable'
                          : member.roleId === 'assistant_direction'
                          ? '📋 Assistante'
                          : member.roleId === 'educateur'
                          ? '🛡️ Éducateur'
                          : member.roleId === 'informaticien'
                          ? '💻 IT'
                          : member.role}
                      </span>
                      <span className="block font-mono font-bold text-slate-700 text-[10.5px]">
                        {member.matricule || `EMP-${member.authCode}`}
                      </span>
                    </td>

                    {/* 3. Attributions & Matières */}
                    <td className="py-3 px-2.5">
                      {member.roleId === 'enseignant' ? (
                        <>
                          <span className="font-bold text-emerald-900 block text-[11px] truncate max-w-[190px]">
                            {member.subjectOrGrade || 'Toutes les matières'}
                          </span>
                          <span className="text-[10.5px] text-slate-500 font-medium block truncate max-w-[190px]">
                            {member.assignedClasses || 'Toutes les classes'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-slate-800 block text-[11px] truncate max-w-[190px]">
                            {member.role}
                          </span>
                          <span className="text-[10.5px] text-slate-500 block truncate max-w-[190px]">
                            Ligne : {member.phone}
                          </span>
                        </>
                      )}
                    </td>

                    {/* 4. Code d'authentification */}
                    <td className="py-3 px-2.5 text-center">
                      {member.roleId === 'directeur' || member.roleId === 'fondateur' || member.id === 'staff-founder' || member.id === 'staff-001' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-mono font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-2xs whitespace-nowrap">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>👑 Accès Direct (Admin)</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs whitespace-nowrap">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono font-black text-slate-900 tracking-wider text-xs">
                            {member.authCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(member.authCode, member.id)}
                            className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            title="Copier le code d'authentification"
                          >
                            {copiedId === member.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* 5. Statut d'Accès */}
                    <td className="py-3 px-2 text-center">
                      {member.roleId === 'directeur' || member.roleId === 'fondateur' || member.id === 'staff-founder' || member.id === 'staff-001' ? (
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>👑 Permanent</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStatus(member)}
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all hover:scale-105 cursor-pointer whitespace-nowrap ${
                            member.status === 'Actif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                              : 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                          }`}
                          title={member.status === 'Actif' ? 'Cliquez pour verrouiller et bloquer l’accès' : 'Cliquez pour réactiver le compte'}
                        >
                          {member.status === 'Actif' ? (
                            <Unlock className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Lock className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{member.status}</span>
                        </button>
                      )}
                    </td>

                    {/* 6. Dernière Connexion */}
                    <td className="py-3 px-2.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono font-semibold text-slate-700">
                        <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Actif' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span>{member.lastLogin || '01/09/2026 à 11:05'}</span>
                      </div>
                    </td>

                    {/* 7. Actions (Voir coordonnées, Modifier, Supprimer) */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {/* 1. Consulter fiche complète & Coordonnées (Accessible pour tous : Fondateur, Directeur, Personnel) */}
                        <button
                          type="button"
                          onClick={() => setSelectedStaffDetail(member)}
                          className="p-1.5 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                          title="Voir les coordonnées complètes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* 2. Modifier les coordonnées et informations : Autorisé pour le Directeur et le Personnel, strictement verrouillé pour le Fondateur */}
                        {!(member.roleId === 'fondateur' || member.id === 'staff-founder') && (
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                            title="Modifier les coordonnées et informations"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* 3. Révoquer / Supprimer : Réservé au personnel enseignant/technique (interdit pour Fondateur et Directeur) */}
                        {!(member.roleId === 'directeur' || member.roleId === 'fondateur' || member.id === 'staff-founder' || member.id === 'staff-001') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(member)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                            title="Révoquer définitivement ce compte et son code d'accès"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ================= MODALE 1 : FICHE COMPLÈTE & PLUS D'INFORMATIONS DU MEMBRE DU PERSONNEL ================= */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-lg flex items-center justify-center shadow-xs">
                  {selectedStaffDetail.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    {selectedStaffDetail.fullName}
                  </h3>
                  <p className="text-xs text-emerald-700 font-bold">
                    {selectedStaffDetail.role}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps de la fiche */}
            <div className="space-y-3 text-xs">
              
              {/* Informations Pédagogiques (Enseignant) ou Informations Administratives (Autres Rôles) */}
              {selectedStaffDetail.roleId === 'enseignant' ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <span>Attributions Pédagogiques (Toutes Matières)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Matières Enseignées :</span>
                      <strong className="text-slate-900">{selectedStaffDetail.subjectOrGrade || 'Toutes les matières (Enseignant Polyvalent)'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Classes Assignées :</span>
                      <strong className="text-slate-900">{selectedStaffDetail.assignedClasses || 'Toutes les classes'}</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 text-[11px] block">Diplôme & Expérience :</span>
                      <strong className="text-slate-900">{selectedStaffDetail.diplomaOrExperience || 'Diplôme d’État & Certification Pédagogique'}</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Date de prise de fonction :</span>
                      <strong className="text-slate-900 font-mono">{selectedStaffDetail.joinDate || '01/09/2026'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Informations Administratives du Poste</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Fonction / Rôle :</span>
                      <strong className="text-slate-900">{selectedStaffDetail.role}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Matricule d&apos;Embauche :</span>
                      <strong className="text-slate-900 font-mono">{selectedStaffDetail.matricule || `EMP-${selectedStaffDetail.authCode}`}</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Date de prise de fonction :</span>
                      <strong className="text-slate-900 font-mono">{selectedStaffDetail.joinDate || '01/09/2026'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Contacts & Coordonnées */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Coordonnées & Informations Personnelles</span>
                </h4>
                <div className="space-y-1.5 text-slate-600 pt-1">
                  {selectedStaffDetail.phone && selectedStaffDetail.phone.trim() ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Numéro Téléphone / WhatsApp :</span>
                      <strong className="text-slate-900 font-mono">{selectedStaffDetail.phone}</strong>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Email Professionnel :</span>
                    <strong className="text-slate-900 font-mono">{selectedStaffDetail.email || 'direction@etablissement.ci'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Adresse de Résidence :</span>
                    <strong className="text-slate-900">{selectedStaffDetail.address || 'Abidjan, Côte d’Ivoire'}</strong>
                  </div>
                </div>
              </div>

              {/* Code d'Authentification Sécurisé & Statut (Uniquement pour le personnel collaborateur : Secrétaire, Comptable, Enseignant, etc.) */}
              {!(selectedStaffDetail.roleId === 'directeur' || selectedStaffDetail.roleId === 'fondateur' || selectedStaffDetail.id === 'staff-founder' || selectedStaffDetail.id === 'staff-001') && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-900 block flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Code d&apos;Authentification Officiel :</span>
                    </span>
                    <span className="font-mono font-black text-sm text-emerald-950 tracking-widest">
                      {selectedStaffDetail.authCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(selectedStaffDetail.authCode, selectedStaffDetail.id)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(selectedStaffDetail)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Fermer la Fiche
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODALE 2 : AJOUTER UN UTILISATEUR & ATTRIBUER UN CODE ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    Ajouter un Utilisateur & Définir son Code
                  </h3>
                  <p className="text-xs text-slate-500">
                    Attribuez le poste, les matières et le code d&apos;authentification officiel
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Nom & Prénoms du Membre *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Ex : M. N'Goran Kouamé"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Matricule d&apos;Embauche</label>
                  <input
                    type="text"
                    value={newMatricule}
                    onChange={(e) => setNewMatricule(e.target.value)}
                    placeholder="Ex : EMP-ENS-007"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 uppercase focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Poste / Fonction (Code Requis) *</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as any;
                      setNewRole(r);
                      setNewAuthCode(generateRandomCode(r));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="enseignant">👨‍🏫 Enseignant / Professeur (Toutes matières)</option>
                    <option value="secretaire">📝 Secrétaire de Direction</option>
                    <option value="comptable">💼 Comptable / Gestionnaire</option>
                    <option value="assistant_direction">📋 Assistant(e) de Direction</option>
                    <option value="educateur">🛡️ Éducateur / Vie Scolaire</option>
                    <option value="informaticien">💻 Informaticien / Responsable IT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Ligne Professionnelle / Numéro Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+225 07 12 34 56 78"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Informations Pédagogiques STRICTEMENT réservées au profil Enseignant */}
              {newRole === 'enseignant' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">Attributions Pédagogiques (Enseignant Polyvalent / Titulaire)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Matières Enseignées *</label>
                      <input
                        type="text"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder="Ex : Toutes les matières, Mathématiques, SVT..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Classes Assignées *</label>
                      <input
                        type="text"
                        value={newClasses}
                        onChange={(e) => setNewClasses(e.target.value)}
                        placeholder="Ex : Toutes les classes, 6ème A, 5ème B..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Diplôme & Expérience Pédagogique</label>
                    <input
                      type="text"
                      value={newDiploma}
                      onChange={(e) => setNewDiploma(e.target.value)}
                      placeholder="Ex : CAPES / Master Pédagogique (8 ans exp.)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Code d'authentification généré */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950 block text-[11px] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Code d&apos;Authentification Officiel *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewAuthCode(generateRandomCode(newRole))}
                    className="text-[10.5px] font-bold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
                  >
                    Régénérer aléatoire
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={newAuthCode}
                  onChange={(e) => setNewAuthCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-emerald-300 font-mono font-extrabold text-xs text-emerald-950 uppercase tracking-widest"
                />
                <p className="text-[10px] text-emerald-800">
                  Ce code sera obligatoirement requis pour que ce membre puisse ouvrir sa session.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  Enregistrer & Valider le Code
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODALE 3 : MODIFIER LES INFORMATIONS DU MEMBRE ================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-7 space-y-4 my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-heading">
                    Modifier les Informations & Code
                  </h3>
                  <p className="text-xs text-slate-500">
                    Membre : <strong>{editingStaff.fullName}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFullEdit} className="space-y-3.5 text-xs">
              
              {/* Nom & Prénoms + Rôle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Nom et Prénoms *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Ex : M. Jean-Marc Kouassi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Poste / Rôle d&apos;Accès *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-800 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="enseignant">👨‍🏫 Enseignant / Professeur (Toutes matières)</option>
                    <option value="secretaire">📝 Secrétaire de Direction</option>
                    <option value="comptable">💼 Comptable / Gestionnaire</option>
                    <option value="assistant_direction">📋 Assistant(e) de Direction</option>
                    <option value="educateur">🛡️ Éducateur / Vie Scolaire</option>
                    <option value="informaticien">💻 Informaticien / Responsable IT</option>
                  </select>
                </div>
              </div>

              {/* Matricule & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">
                    Matricule d&apos;Embauche
                  </label>
                  <input
                    type="text"
                    value={editMatricule}
                    onChange={(e) => setEditMatricule(e.target.value)}
                    placeholder="Ex : EMP-ENS-004"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 uppercase focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Email Professionnel *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@etablissement.ci"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Ligne Professionnelle / Téléphone & Adresse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Ligne Professionnelle / Contact *</label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Adresse de Résidence</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Ex : Abidjan, Côte d'Ivoire"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Attributions Pédagogiques STRICTEMENT réservées au profil Enseignant */}
              {editRole === 'enseignant' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">Attributions Pédagogiques (Enseignant)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Matières Enseignées *</label>
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        placeholder="Ex : Toutes les matières, Mathématiques, SVT..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Classes Assignées *</label>
                      <input
                        type="text"
                        value={editClasses}
                        onChange={(e) => setEditClasses(e.target.value)}
                        placeholder="Ex : Toutes les classes, 6ème A, 5ème B..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Diplôme & Expérience</label>
                    <input
                      type="text"
                      value={editDiploma}
                      onChange={(e) => setEditDiploma(e.target.value)}
                      placeholder="Ex : Master / CAPES (10 ans exp.)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Statut & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Statut d&apos;Accès</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="Actif">Actif (Autorisé)</option>
                    <option value="En attente">En attente</option>
                    <option value="Verrouillé">Verrouillé (Accès Bloqué)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block text-[11px]">
                      Code d&apos;Authentification *
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditAuthCodeValue(generateRandomCode(editRole))}
                      className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Régénérer
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    value={editAuthCodeValue}
                    onChange={(e) => setEditAuthCodeValue(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-400 font-mono font-extrabold text-xs text-emerald-950 uppercase tracking-widest bg-emerald-50/50"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  Enregistrer les Modifications
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* TOAST DE NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
