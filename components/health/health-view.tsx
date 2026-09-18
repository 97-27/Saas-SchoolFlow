'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { availableClasses } from '@/lib/data/mock-data';
import {
  getLiveStudents,
  getLiveSchool,
  getAllStudentHealthRecords,
  saveStudentHealthRecord,
  getHealthIncidents,
  addHealthIncident,
  deleteHealthIncident,
  DATA_UPDATED_EVENT,
  StudentHealthRecord,
  HealthIncident,
  VaccinationEntry,
} from '@/lib/data/live-store';
import { formatDate } from '@/lib/utils/formatters';
import { GenderBadge } from '@/components/ui/badge';
import {
  HeartPulse,
  Search,
  X,
  Plus,
  Trash2,
  Syringe,
  AlertTriangle,
  Droplet,
  ClipboardList,
  MessageCircle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface HealthViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

export function HealthView({ initialStudents, school, schoolSlug }: HealthViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [records, setRecords] = useState<Record<string, StudentHealthRecord>>(() =>
    getAllStudentHealthRecords(schoolSlug)
  );
  const [incidents, setIncidents] = useState<HealthIncident[]>(() => getHealthIncidents(schoolSlug));

  useEffect(() => {
    const refresh = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      setRecords(getAllStudentHealthRecords(schoolSlug));
      setIncidents(getHealthIncidents(schoolSlug));
    };
    refresh();
    window.addEventListener(DATA_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, refresh);
  }, [initialStudents, schoolSlug, school]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [activeTab, setActiveTab] = useState<'fiches' | 'incidents'>('fiches');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Élève dont la fiche médicale est ouverte pour consultation/édition
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formBloodType, setFormBloodType] = useState('');
  const [formAllergies, setFormAllergies] = useState('');
  const [formConditions, setFormConditions] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formVaccinations, setFormVaccinations] = useState<VaccinationEntry[]>([]);
  const [newVaccineName, setNewVaccineName] = useState('');
  const [newVaccineDate, setNewVaccineDate] = useState('');

  const openRecordModal = (stu: Student) => {
    const rec = records[stu.id];
    setEditingStudent(stu);
    setFormBloodType(rec?.bloodType || '');
    setFormAllergies(rec?.allergies || '');
    setFormConditions(rec?.chronicConditions || '');
    setFormContactName(rec?.emergencyContactName || '');
    setFormContactPhone(rec?.emergencyContactPhone || stu.guardianPhone || '');
    setFormVaccinations(rec?.vaccinations || []);
    setNewVaccineName('');
    setNewVaccineDate('');
  };

  const closeRecordModal = () => setEditingStudent(null);

  const handleAddVaccine = () => {
    if (!newVaccineName.trim() || !newVaccineDate.trim()) return;
    setFormVaccinations((prev) => [
      ...prev,
      { id: `vac-${Date.now()}`, name: newVaccineName.trim(), date: newVaccineDate },
    ]);
    setNewVaccineName('');
    setNewVaccineDate('');
  };

  const handleRemoveVaccine = (id: string) => {
    setFormVaccinations((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSaveRecord = () => {
    if (!editingStudent) return;
    const record: StudentHealthRecord = {
      studentId: editingStudent.id,
      bloodType: formBloodType.trim(),
      allergies: formAllergies.trim(),
      chronicConditions: formConditions.trim(),
      emergencyContactName: formContactName.trim(),
      emergencyContactPhone: formContactPhone.trim(),
      vaccinations: formVaccinations,
      lastUpdated: new Date().toISOString(),
    };
    saveStudentHealthRecord(editingStudent.id, record, schoolSlug);
    setRecords((prev) => ({ ...prev, [editingStudent.id]: record }));
    showToast(`✓ Fiche médicale de ${editingStudent.fullName} enregistrée.`);
    closeRecordModal();
  };

  // Filtrage des élèves affichés
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const matchesClass = selectedClass === 'Toutes les classes' || s.grade === selectedClass;
      const matchesSearch =
        q === '' ||
        s.fullName.toLowerCase().includes(q) ||
        (s.matricule || '').toLowerCase().includes(q) ||
        (s.studentNumber || '').toLowerCase().includes(q);
      return matchesClass && matchesSearch;
    });
  }, [students, selectedClass, searchQuery]);

  // Statistiques réelles — jamais estimées : uniquement ce qui a été réellement saisi
  const stats = useMemo(() => {
    const withAllergies = students.filter((s) => (records[s.id]?.allergies || '').trim().length > 0).length;
    const withRecord = students.filter((s) => Boolean(records[s.id]?.lastUpdated)).length;
    const withoutContact = students.filter((s) => !(records[s.id]?.emergencyContactPhone || '').trim()).length;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const incidentsThisMonth = incidents.filter((i) => (i.date || '').slice(0, 7) === thisMonth).length;
    return { withAllergies, withRecord, withoutContact, incidentsThisMonth };
  }, [students, records, incidents]);

  // ── Journal des incidents d'infirmerie ──
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentStudentId, setIncidentStudentId] = useState('');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentAction, setIncidentAction] = useState('');
  const [incidentNotifiedParent, setIncidentNotifiedParent] = useState(false);
  const [incidentRecordedBy, setIncidentRecordedBy] = useState('');

  const openIncidentModal = () => {
    setIncidentStudentId('');
    setIncidentDate(new Date().toISOString().split('T')[0]);
    setIncidentDescription('');
    setIncidentAction('');
    setIncidentNotifiedParent(false);
    setIncidentRecordedBy('');
    setIsIncidentModalOpen(true);
  };

  const handleSaveIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.id === incidentStudentId);
    if (!stu || !incidentDescription.trim()) return;
    const incident: HealthIncident = {
      id: `inc-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.fullName,
      studentGrade: stu.grade,
      date: incidentDate,
      description: incidentDescription.trim(),
      actionTaken: incidentAction.trim(),
      notifiedParent: incidentNotifiedParent,
      recordedBy: incidentRecordedBy.trim() || 'Infirmerie',
      createdAt: new Date().toISOString(),
    };
    addHealthIncident(incident, schoolSlug);
    setIncidents((prev) => [incident, ...prev]);
    setIsIncidentModalOpen(false);
    showToast(`✓ Incident enregistré pour ${stu.fullName}.`);
  };

  const handleDeleteIncident = (id: string) => {
    if (!confirm('Supprimer définitivement cet incident du journal ?')) return;
    deleteHealthIncident(id, schoolSlug);
    setIncidents((prev) => prev.filter((i) => i.id !== id));
  };

  const handleNotifyParent = (incident: HealthIncident) => {
    const stu = students.find((s) => s.id === incident.studentId);
    const rec = records[incident.studentId];
    const rawPhone = rec?.emergencyContactPhone || stu?.whatsappPhone || stu?.guardianPhone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const text = `⚕️ *${currentSchool.name}* — Information Infirmerie\n\nBonjour, nous vous informons que ${incident.studentName} (${incident.studentGrade}) a été vu(e) à l'infirmerie le ${formatDate(incident.date)}.\n\n*Motif :* ${incident.description}\n*Prise en charge :* ${incident.actionTaken || 'Non renseigné'}\n\n_Merci de contacter l'école pour tout complément d'information._`;
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Santé & Suivi Médical
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Fiches médicales, allergies, vaccinations et journal d’infirmerie — {currentSchool.name}
          </p>
        </div>
        <button
          type="button"
          onClick={openIncidentModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 shadow-sm shadow-rose-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Enregistrer un incident</span>
        </button>
      </div>

      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2 text-xs font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Fiches renseignées
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-slate-900 font-heading">
            {stats.withRecord} / {students.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Allergies signalées
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-slate-900 font-heading">{stats.withAllergies}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Incidents ce mois
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-slate-900 font-heading">{stats.incidentsThisMonth}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Sans contact d’urgence
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-slate-900 font-heading">{stats.withoutContact}</span>
        </div>
      </div>

      {/* 3. Onglets */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('fiches')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'fiches' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fiches Médicales
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'incidents' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Journal d’Infirmerie ({incidents.length})
        </button>
      </div>

      {activeTab === 'fiches' ? (
        <>
          {/* Filtres */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un élève, matricule..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700"
            >
              <option>Toutes les classes</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Table des élèves */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="py-3 px-4">Élève</th>
                    <th className="py-3 px-3">Classe</th>
                    <th className="py-3 px-3">Groupe Sanguin</th>
                    <th className="py-3 px-3">Allergies</th>
                    <th className="py-3 px-3">Contact d’Urgence</th>
                    <th className="py-3 px-3 text-center">Vaccins</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Aucun élève trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((stu) => {
                      const rec = records[stu.id];
                      return (
                        <tr key={stu.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{stu.fullName}</span>
                              <GenderBadge gender={stu.gender} />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{stu.grade}</td>
                          <td className="py-3 px-3">
                            {rec?.bloodType ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Droplet className="w-3 h-3" />
                                {rec.bloodType}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Non renseigné</span>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[220px]">
                            {rec?.allergies ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{rec.allergies}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Aucune connue</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {rec?.emergencyContactPhone ? (
                              <div className="text-slate-700">
                                <div className="font-semibold">{rec.emergencyContactName || 'Contact'}</div>
                                <div className="text-[10.5px] text-slate-500">{rec.emergencyContactPhone}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Non renseigné</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{rec?.vaccinations?.length || 0}</td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => openRecordModal(stu)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                            >
                              Voir la fiche
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
          {incidents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Aucun incident d’infirmerie enregistré.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{inc.studentName}</span>
                      <span className="text-[10.5px] text-slate-500">({inc.studentGrade})</span>
                      <span className="text-[10.5px] font-semibold text-slate-500">{formatDate(inc.date)}</span>
                      {inc.notifiedParent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Parent notifié
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-1.5">{inc.description}</p>
                    {inc.actionTaken && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        <span className="font-semibold">Prise en charge :</span> {inc.actionTaken}
                      </p>
                    )}
                    <p className="text-[10.5px] text-slate-400 mt-1">Enregistré par {inc.recordedBy}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleNotifyParent(inc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Notifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteIncident(inc.id)}
                      className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal fiche médicale */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-slate-900">{editingStudent.fullName}</h2>
                <p className="text-[11px] text-slate-500">{editingStudent.grade}</p>
              </div>
              <button type="button" onClick={closeRecordModal} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Groupe Sanguin</label>
                  <select
                    value={formBloodType}
                    onChange={(e) => setFormBloodType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="">Non renseigné</option>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Téléphone Contact d’Urgence</label>
                  <input
                    type="text"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    placeholder="Ex: 07 00 00 00 00"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Nom du Contact d’Urgence</label>
                <input
                  type="text"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  placeholder="Ex: Mère, Père, Tuteur..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Allergies connues</label>
                <textarea
                  value={formAllergies}
                  onChange={(e) => setFormAllergies(e.target.value)}
                  placeholder="Ex: Arachide, pénicilline... (laisser vide si aucune connue)"
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Conditions médicales chroniques</label>
                <textarea
                  value={formConditions}
                  onChange={(e) => setFormConditions(e.target.value)}
                  placeholder="Ex: Asthme, diabète, épilepsie..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 flex items-center gap-1.5">
                  <Syringe className="w-3.5 h-3.5" />
                  Carnet de Vaccination
                </label>
                <div className="space-y-1.5 mb-2">
                  {formVaccinations.map((v) => (
                    <div key={v.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-semibold text-slate-700">{v.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{formatDate(v.date)}</span>
                        <button type="button" onClick={() => handleRemoveVaccine(v.id)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {formVaccinations.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Aucun vaccin enregistré.</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVaccineName}
                    onChange={(e) => setNewVaccineName(e.target.value)}
                    placeholder="Nom du vaccin"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200"
                  />
                  <input
                    type="date"
                    value={newVaccineDate}
                    onChange={(e) => setNewVaccineDate(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddVaccine}
                    className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRecordModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveRecord}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              >
                Enregistrer la fiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nouvel incident */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveIncident}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Nouvel Incident d’Infirmerie</h2>
              <button
                type="button"
                onClick={() => setIsIncidentModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Élève concerné *</label>
                <select
                  required
                  value={incidentStudentId}
                  onChange={(e) => setIncidentStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                >
                  <option value="">Sélectionner un élève...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.grade})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Date *</label>
                <input
                  required
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Motif / Description *</label>
                <textarea
                  required
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  rows={2}
                  placeholder="Ex: Chute dans la cour, maux de tête, fièvre..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Prise en charge</label>
                <textarea
                  value={incidentAction}
                  onChange={(e) => setIncidentAction(e.target.value)}
                  rows={2}
                  placeholder="Ex: Repos à l'infirmerie, application de glace..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Enregistré par</label>
                <input
                  type="text"
                  value={incidentRecordedBy}
                  onChange={(e) => setIncidentRecordedBy(e.target.value)}
                  placeholder="Nom de la personne présente"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incidentNotifiedParent}
                  onChange={(e) => setIncidentNotifiedParent(e.target.checked)}
                  className="rounded"
                />
                Le parent a déjà été informé
              </label>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsIncidentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                Enregistrer l’incident
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
