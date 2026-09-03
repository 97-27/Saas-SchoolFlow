'use client';

import React, { useState, useEffect } from 'react';
import {
  StaffUser,
  getLiveStaffUsers,
  saveLiveStaffUsers,
  updateStaffAuthCode,
  updateFullStaffUser,
  addLiveStaffUser,
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
  Sparkles,
  Smartphone,
  Mail,
  RefreshCw,
  Edit2,
  Lock,
  Unlock,
  AlertCircle,
  X,
  BookOpen,
  Wallet,
  FileSpreadsheet,
  CheckCircle2,
  UserCheck,
  Shield,
  Send,
  Eye,
  GraduationCap,
  Calendar,
  MapPin,
  Award,
} from 'lucide-react';

interface AdministrationViewProps {
  schoolSlug: string;
}

export function AdministrationView({ schoolSlug }: AdministrationViewProps) {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'enseignants' | 'administration'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modale d'ajout
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'directeur' | 'assistant_direction' | 'fondateur' | 'comptable' | 'secretaire' | 'enseignant' | 'parent'>('enseignant');
  const [newMatricule, setNewMatricule] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newClasses, setNewClasses] = useState('');
  const [newDiploma, setNewDiploma] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAuthCode, setNewAuthCode] = useState('');

  // Modale de Fiche Détaillée & Informations Professionnelles
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffUser | null>(null);

  // Modale d'édition Complète du Membre
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'directeur' | 'assistant_direction' | 'fondateur' | 'comptable' | 'secretaire' | 'enseignant' | 'parent'>('enseignant');
  const [editMatricule, setEditMatricule] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editClasses, setEditClasses] = useState('');
  const [editDiploma, setEditDiploma] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAuthCodeValue, setEditAuthCodeValue] = useState('');
  const [editStatus, setEditStatus] = useState<'Actif' | 'En attente' | 'Verrouillé'>('Actif');

  // Refs pour le défilement horizontal synchronisé en haut
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const tableScrollRef = React.useRef<HTMLDivElement>(null);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  const handleScrollStep = (direction: 'left' | 'right') => {
    if (tableScrollRef.current) {
      const step = direction === 'left' ? -300 : 300;
      tableScrollRef.current.scrollBy({ left: step, behavior: 'smooth' });
    }
  };

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadStaff = () => {
    setStaffList(getLiveStaffUsers());
  };

  useEffect(() => {
    loadStaff();
    window.addEventListener(DATA_UPDATED_EVENT, loadStaff);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, loadStaff);
  }, []);

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
        : role === 'comptable'
        ? 'CPT'
        : role === 'secretaire'
        ? 'SEC'
        : role === 'fondateur'
        ? 'FND'
        : role === 'parent'
        ? 'PAR'
        : 'DIR';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  // Ouvrir la modale d'édition complète
  const openEditModal = (staff: StaffUser) => {
    setEditingStaff(staff);
    setEditFullName(staff.fullName);
    setEditRole(staff.roleId);
    setEditMatricule(staff.matricule || `EMP-${staff.authCode}`);
    setEditSubject(staff.subjectOrGrade || '');
    setEditClasses(staff.assignedClasses || '');
    setEditDiploma(staff.diplomaOrExperience || '');
    setEditAddress(staff.address || '');
    setEditEmail(staff.email);
    setEditPhone(staff.phone);
    setEditAuthCodeValue(staff.authCode);
    setEditStatus(staff.status);
  };

  // Basculer statut Actif / Verrouillé
  const toggleStatus = (staff: StaffUser) => {
    const nextStatus = staff.status === 'Actif' ? 'Verrouillé' : 'Actif';
    const updated = staffList.map((s) => (s.id === staff.id ? { ...s, status: nextStatus as any } : s));
    saveLiveStaffUsers(updated);
    showToast(`Statut de ${staff.fullName} : ${nextStatus}`);
  };

  // Sauvegarder l'édition complète d'un membre
  const handleSaveFullEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editFullName.trim() || !editEmail.trim()) return;

    const roleTitleMap = {
      directeur: 'Directeur des Études (Admin)',
      assistant_direction: 'Assistant(e) de Direction',
      fondateur: 'Fondateur / Fondatrice (Supervision)',
      comptable: 'Comptable / Gestionnaire',
      secretaire: 'Secrétaire de Direction',
      enseignant: 'Enseignant / Professeur',
      parent: 'Parent d’Élève (Espace Famille)',
    };

    const updatedUser: StaffUser = {
      ...editingStaff,
      fullName: editFullName.trim(),
      role: roleTitleMap[editRole],
      roleId: editRole,
      matricule: editMatricule.trim() || `EMP-${editAuthCodeValue.trim()}`,
      subjectOrGrade: editSubject.trim() || undefined,
      assignedClasses: editClasses.trim() || undefined,
      diplomaOrExperience: editDiploma.trim() || undefined,
      address: editAddress.trim() || undefined,
      email: editEmail.trim(),
      phone: editPhone.trim(),
      authCode: editAuthCodeValue.trim().toUpperCase(),
      status: editStatus,
    };

    updateFullStaffUser(updatedUser);
    showToast(`✅ Informations et code de ${updatedUser.fullName} mis à jour avec succès !`);
    setEditingStaff(null);
  };

  // Ajouter un nouveau membre
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim()) return;

    const generatedCode = newAuthCode.trim() || generateRandomCode(newRole);
    const roleTitleMap = {
      directeur: 'Directeur / Directrice (Admin)',
      assistant_direction: 'Assistant(e) de Direction',
      fondateur: 'Fondateur / Fondatrice (Supervision)',
      comptable: 'Comptable / Gestionnaire',
      secretaire: 'Secrétaire de Direction',
      enseignant: 'Enseignant / Professeur',
      parent: 'Parent d’Élève (Espace Famille)',
    };

    const newStaffMember: StaffUser = {
      id: `staff-${Date.now().toString().slice(-4)}`,
      fullName: newFullName.trim(),
      role: roleTitleMap[newRole],
      roleId: newRole,
      matricule: newMatricule.trim() || `EMP-${generatedCode.toUpperCase()}`,
      subjectOrGrade: newSubject.trim() || (newRole === 'enseignant' ? 'Professeur Titulaire' : 'Administration'),
      assignedClasses: newClasses.trim() || (newRole === 'enseignant' ? '6ème, 5ème' : 'Toutes'),
      diplomaOrExperience: newDiploma.trim() || 'Diplôme d’État & Expérience reconnue',
      address: newAddress.trim() || 'Abidjan, Côte d’Ivoire',
      joinDate: '31/08/2026',
      email: newEmail.trim(),
      phone: newPhone.trim() || '+225 07 00 00 00 00',
      authCode: generatedCode.toUpperCase(),
      status: 'Actif',
      lastLogin: 'Jamais connecté',
    };

    addLiveStaffUser(newStaffMember);
    showToast(`Compte configuré pour ${newStaffMember.fullName} (Code: ${newStaffMember.authCode})`);
    
    // Reset
    setNewFullName('');
    setNewMatricule('');
    setNewSubject('');
    setNewClasses('');
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
                Espace Direction • Attribution, réinitialisation des codes d&apos;authentification et gestion des informations du personnel
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewAuthCode(generateRandomCode(newRole));
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
                Total Comptes
              </h3>
              <span className="text-2xl font-extrabold text-slate-900 font-heading">
                {totalUsers}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Personnel et profils répertoriés</p>
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
                Pôle Direction & Gestion
              </h3>
              <span className="text-2xl font-extrabold text-slate-900 font-heading">
                {adminCount}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Directeur, Adjointe, Secrétaire, Comptable</p>
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
          <p className="text-[11px] text-teal-700 font-semibold">Accès 100% sécurisé et protégé</p>
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
          <span>Direction & Administration ({adminCount})</span>
        </button>
      </div>

      {/* ================= TABLEAU DE GESTION DU PERSONNEL & CODES ================= */}
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
              <option value="all">Tous les postes</option>
              <option value="directeur">Directeur / Admin</option>
              <option value="assistant_direction">Assistant(e) Direction</option>
              <option value="fondateur">Fondateur</option>
              <option value="enseignant">Enseignants</option>
              <option value="comptable">Comptables</option>
              <option value="secretaire">Secrétaires</option>
              <option value="parent">Parents d&apos;Élèves</option>
            </select>
          </div>
        </div>

        {/* BARRE DE NAVIGATION & DÉFILEMENT HORIZONTAL POSITIONNÉE EN HAUT */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11.5px]">
              <span>↔️</span>
              <span>Défilement Horizontal du Tableau :</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleScrollStep('left')}
                className="px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-[11px] active:scale-95"
                title="Défiler vers la gauche"
              >
                <span>◀</span>
                <span>Gauche</span>
              </button>
              <button
                type="button"
                onClick={() => handleScrollStep('right')}
                className="px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-[11px] active:scale-95"
                title="Défiler vers la droite"
              >
                <span>Droite</span>
                <span>▶</span>
              </button>
            </div>
          </div>

          {/* Rail de défilement horizontal interactif en haut */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
              Glisser ici :
            </span>
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="flex-1 sm:w-[280px] md:w-[340px] overflow-x-auto h-5 bg-white border border-slate-300 rounded-lg p-0.5 shadow-inner cursor-ew-resize"
              title="Faites glisser cette barre pour naviguer horizontalement dans le tableau"
            >
              <div className="w-[1150px] h-1" />
            </div>
          </div>
        </div>

        {/* TABLE DES MEMBRES ET CODES (Barre inférieure masquée au profit de celle du haut) */}
        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-slate-200"
        >
          <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 min-w-[200px]">Utilisateur / Personnel</th>
                <th className="py-3.5 px-3 min-w-[120px] text-center">Matricule</th>
                <th className="py-3.5 px-4 min-w-[160px]">Poste & Attributions</th>
                <th className="py-3.5 px-4 min-w-[150px]">Classes / Matières</th>
                <th className="py-3.5 px-4 min-w-[150px] text-center">Code d&apos;Authentification</th>
                <th className="py-3.5 px-3 min-w-[100px] text-center">Statut</th>
                <th className="py-3.5 px-4 min-w-[160px] text-center">Dernière Connexion</th>
                <th className="py-3.5 px-4 min-w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-emerald-50/40 transition-colors">
                  
                  {/* Nom et Contact */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 font-extrabold flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                        {member.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-slate-900 font-bold font-heading text-xs truncate">
                          {member.fullName}
                        </strong>
                        <span className="text-[11px] text-slate-500 font-mono block truncate">
                          {member.email}
                        </span>
                        <span className="text-[10.5px] text-emerald-800 font-mono font-medium block">
                          {member.phone}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Matricule d'Embauche */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-block font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs whitespace-nowrap shadow-2xs">
                      {member.matricule || `EMP-${member.authCode}`}
                    </span>
                  </td>

                  {/* Poste & Rôle */}
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                      member.roleId === 'directeur'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : member.roleId === 'assistant_direction'
                        ? 'bg-teal-50 text-teal-800 border-teal-200'
                        : member.roleId === 'fondateur'
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : member.roleId === 'comptable'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : member.roleId === 'secretaire'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : member.roleId === 'parent'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-emerald-50/60 text-emerald-900 border-emerald-200/70'
                    }`}>
                      {member.roleId === 'directeur'
                        ? '👑 Admin (Dir. Études)'
                        : member.roleId === 'assistant_direction'
                        ? '📋 Assistant(e) Dir.'
                        : member.roleId === 'fondateur'
                        ? '🏛️ Fondateur'
                        : member.roleId === 'comptable'
                        ? '📊 Comptable'
                        : member.roleId === 'secretaire'
                        ? '📝 Secrétaire'
                        : member.roleId === 'parent'
                        ? '👨‍👩‍👧 Parent'
                        : '📚 Enseignant'}
                    </span>
                    <span className="block text-[11px] text-slate-600 font-medium mt-1">
                      {member.subjectOrGrade || 'Direction / Scolarité'}
                    </span>
                  </td>

                  {/* Classes / Matières */}
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-800 block text-xs">
                      {member.assignedClasses || 'Toutes les classes'}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate max-w-[160px] block mt-0.5">
                      {member.diplomaOrExperience || 'Diplôme d’État'}
                    </span>
                  </td>

                  {/* Code d'authentification */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs whitespace-nowrap">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-mono font-black text-slate-900 tracking-wider text-xs">
                        {member.authCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(member.authCode, member.id)}
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                        title="Copier le code d'authentification"
                      >
                        {copiedId === member.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Statut */}
                  <td className="py-3.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleStatus(member)}
                      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-transform hover:scale-105 cursor-pointer whitespace-nowrap ${
                        member.status === 'Actif'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Actif' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>{member.status}</span>
                    </button>
                  </td>

                  {/* Dernière Connexion */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                      <span>{member.lastLogin || '01/09/2026 à 11:05'}</span>
                    </div>
                  </td>

                  {/* Actions Direction */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {/* Consulter fiche complète */}
                      <button
                        type="button"
                        onClick={() => setSelectedStaffDetail(member)}
                        className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Consulter la fiche détaillée"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Modifier toutes les informations */}
                      <button
                        type="button"
                        onClick={() => openEditModal(member)}
                        className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Modifier les coordonnées, le matricule et le code"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Générer nouveau code rapide */}
                      <button
                        type="button"
                        onClick={() => {
                          const randCode = generateRandomCode(member.roleId);
                          updateStaffAuthCode(member.id, randCode);
                          showToast(`Nouveau code généré pour ${member.fullName} : ${randCode}`);
                        }}
                        className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Régénérer un code aléatoire"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* ================= MODALE 1 : FICHE COMPLÈTE & INFORMATIONS PERSONNELLES / PROFESSIONNELLES ================= */}
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
              
              {/* Informations Professionnelles */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <span>Informations Pédagogiques & Professionnelles</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Matière / Discipline :</span>
                    <strong className="text-slate-900">{selectedStaffDetail.subjectOrGrade || 'Toutes disciplines'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Classes Assignées :</span>
                    <strong className="text-slate-900">{selectedStaffDetail.assignedClasses || 'Maternelle à 3ème'}</strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400 text-[11px] block">Diplôme & Expérience :</span>
                    <strong className="text-slate-900">{selectedStaffDetail.diplomaOrExperience || 'Diplôme d’État & Certification Pédagogique'}</strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Date d&apos;embauche :</span>
                    <strong className="text-slate-900 font-mono">{selectedStaffDetail.joinDate || '01/09/2021'}</strong>
                  </div>
                </div>
              </div>

              {/* Contacts & Coordonnées */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Coordonnées & Informations Personnelles</span>
                </h4>
                <div className="space-y-1.5 text-slate-600 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Numéro Téléphone / WhatsApp :</span>
                    <strong className="text-slate-900 font-mono">{selectedStaffDetail.phone}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Email Professionnel :</span>
                    <strong className="text-slate-900 font-mono">{selectedStaffDetail.email}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Adresse de Résidence :</span>
                    <strong className="text-slate-900">{selectedStaffDetail.address || 'Abidjan, Côte d’Ivoire'}</strong>
                  </div>
                </div>
              </div>

              {/* Code d'Authentification Sécurisé */}
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
                <button
                  type="button"
                  onClick={() => handleCopyCode(selectedStaffDetail.authCode, selectedStaffDetail.id)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier</span>
                </button>
              </div>

            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODALE 2 : AJOUTER UN MEMBRE & ATTRIBUER UN CODE ================= */}
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
                    Attribuez le poste, les classes et le code d&apos;authentification officiel
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Poste / Fonction *</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as any;
                      setNewRole(r);
                      setNewAuthCode(generateRandomCode(r));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="enseignant">Enseignant / Professeur</option>
                    <option value="assistant_direction">Assistant(e) de Direction</option>
                    <option value="comptable">Comptable / Gestionnaire</option>
                    <option value="secretaire">Secrétaire de Direction</option>
                    <option value="fondateur">Fondateur (Supervision)</option>
                    <option value="directeur">Directeur (Admin)</option>
                    <option value="parent">Parent d&apos;Élève (Espace Famille)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Matière / Discipline</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Ex : Mathématiques / SVT"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Classes Assignées</label>
                  <input
                    type="text"
                    value={newClasses}
                    onChange={(e) => setNewClasses(e.target.value)}
                    placeholder="Ex : 6ème A, 5ème B, CM2"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Diplôme & Expérience</label>
                  <input
                    type="text"
                    value={newDiploma}
                    onChange={(e) => setNewDiploma(e.target.value)}
                    placeholder="Ex : CAPES Mathématiques (8 ans)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Email Professionnel *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="prof.ngoran@ecole.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Numéro Téléphone</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+225 07 12 34 56 78"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

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
                  Ce code sera requis pour que ce membre puisse ouvrir sa session.
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

      {/* ================= MODALE 3 : MODIFIER TOUTES LES INFORMATIONS DU MEMBRE DU PERSONNEL ================= */}
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
                    <option value="directeur">Directeur des Études (Admin)</option>
                    <option value="assistant_direction">Assistant(e) de Direction</option>
                    <option value="fondateur">Fondateur (Supervision)</option>
                    <option value="comptable">Comptable / Gestionnaire</option>
                    <option value="secretaire">Secrétaire de Direction</option>
                    <option value="enseignant">Enseignant / Professeur</option>
                    <option value="parent">Parent d&apos;Élève (Espace Famille)</option>
                  </select>
                </div>
              </div>

              {/* Matricule & Matière */}
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
                  <label className="font-bold text-slate-700 block">Matière / Attribution</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Ex : Mathématiques & SVT"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Classes & Diplôme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Classes Assignées</label>
                  <input
                    type="text"
                    value={editClasses}
                    onChange={(e) => setEditClasses(e.target.value)}
                    placeholder="Ex : 6ème A, 5ème B, CM2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Diplôme & Expérience</label>
                  <input
                    type="text"
                    value={editDiploma}
                    onChange={(e) => setEditDiploma(e.target.value)}
                    placeholder="Ex : Master / CAPES (10 ans exp.)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Email & Téléphone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Contact Direct / WhatsApp</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-emerald-600"
                  />
                </div>
              </div>

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
