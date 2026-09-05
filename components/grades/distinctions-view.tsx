'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Student, School } from '@/lib/data/types';
import { defaultSchool } from '@/lib/data/mock-data';
import {
  getLiveSchool,
  getLiveStudents,
  getValidatedClassRankings,
  saveValidatedClassRankings,
  clearValidatedClassRankings,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import { GenderBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/formatters';
import {
  Award,
  Sparkles,
  Printer,
  Building2,
  Layers,
  X,
  Medal,
  CheckCircle2,
  Trophy,
  Download,
  Baby,
  BookOpen,
  GraduationCap,
  FileText,
  Clock,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface DistinctionsViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

export function DistinctionsView({
  initialStudents,
  school,
  schoolSlug,
}: DistinctionsViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(() =>
    getLiveSchool(schoolSlug, school || defaultSchool)
  );
  const [students, setStudents] = useState<Student[]>(() => {
    const live = getLiveStudents(initialStudents, schoolSlug);
    return live || [];
  });

  // Cycles Scolaires : Maternelle (P.S. à G.S.), Primaire (CP1 à CM2), Collège (6ème à 3ème), Lycée (2nde à Terminale)
  const [selectedCycle, setSelectedCycle] = useState<'all' | 'maternelle' | 'primaire' | 'college' | 'lycee'>('college');
  const [selectedClass, setSelectedClass] = useState('6ème');
  const [selectedPeriod, setSelectedPeriod] = useState('1er Trimestre');
  const [selectedStudentForDiploma, setSelectedStudentForDiploma] = useState<any | null>(null);
  const [isDiplomaModalOpen, setIsDiplomaModalOpen] = useState(false);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // État de validation des bulletins pour la classe et le trimestre sélectionnés
  const [validatedRankings, setValidatedRankings] = useState<any[] | null>(() =>
    getValidatedClassRankings(selectedClass, selectedPeriod)
  );

  const syncLiveState = () => {
    setCurrentSchool(getLiveSchool(schoolSlug, school || defaultSchool));
    const live = getLiveStudents(initialStudents, schoolSlug);
    setStudents(live || []);
    setValidatedRankings(getValidatedClassRankings(selectedClass, selectedPeriod));
  };

  useEffect(() => {
    syncLiveState();
    window.addEventListener(DATA_UPDATED_EVENT, syncLiveState);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, syncLiveState);
  }, [schoolSlug, school, initialStudents, selectedClass, selectedPeriod]);

  const availableClassesForCycle = useMemo(() => {
    switch (selectedCycle) {
      case 'maternelle':
        return ['Maternelle (P.S.)', 'Maternelle (M.S.)', 'Maternelle (G.S.)'];
      case 'primaire':
        return ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
      case 'college':
        return ['6ème', '5ème', '4ème', '3ème'];
      case 'all':
      default:
        return [
          'Maternelle (P.S.)',
          'Maternelle (M.S.)',
          'Maternelle (G.S.)',
          'CP1',
          'CP2',
          'CE1',
          'CE2',
          'CM1',
          'CM2',
          '6ème',
          '5ème',
          '4ème',
          '3ème',
        ];
    }
  }, [selectedCycle]);

  const handleCycleChange = (cycle: 'all' | 'maternelle' | 'primaire' | 'college') => {
    setSelectedCycle(cycle);
    if (cycle === 'maternelle') setSelectedClass('Maternelle (G.S.)');
    else if (cycle === 'primaire') setSelectedClass('CM2');
    else if (cycle === 'college') setSelectedClass('6ème');
    else setSelectedClass('6ème');
  };

  // Tableau d'Honneur officiel : Lauréats validés (Top 3 et Ex æquo)
  // Si le bulletin n'est pas validé, la liste est COMPLÈTEMENT VIDE ([]).
  const laureates = useMemo(() => {
    if (!validatedRankings || validatedRankings.length === 0) {
      return [];
    }
    return validatedRankings;
  }, [validatedRankings]);

  const handleClearClassBulletins = () => {
    clearValidatedClassRankings(selectedClass, selectedPeriod);
    setValidatedRankings(null);
    setToastMessage(`Les diplômes de la classe de ${selectedClass} ont été remis en attente des bulletins.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenDiploma = (laureate: any) => {
    setSelectedStudentForDiploma(laureate);
    setIsDiplomaModalOpen(true);
  };

  // Helper : Génère EXACTEMENT le diplôme avec de très grands textes, logos agrandis à 98px et remplissant 100% de la page A4 Paysage (~198mm)
  const generateOfficialDiplomaHTML = (laureate: any) => {
    const directorName = currentSchool.directorName || 'LAWANI MOUHAMED';
    const schoolName = currentSchool.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL';
    const schoolShortName = currentSchool.shortName || 'EPC MANOI';
    const schoolMotto = currentSchool.motto || 'Discipline • Rigueur • Réussite';
    const schoolDistrict = currentSchool.district || 'Abobo Biabou 2';
    const ministryCode = currentSchool.ministryCode || '321119';
    const academicYear = currentSchool.academicYear || '2026-2027';
    const currentDateFormatted = formatDate(new Date());

    const isBlank = Boolean(laureate.isBlank);

    return `
      <div style="width: 100%; max-width: 100%; box-sizing: border-box; min-height: 198mm; height: 198mm; border: 4px solid #f59e0b; outline: 2px solid #d97706; outline-offset: 4px; border-radius: 24px; padding: 22px 34px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; text-align: center; position: relative; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; page-break-inside: avoid; page-break-after: avoid;">
        <!-- 1. En-tête officiel avec grands logos (98px) -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 4px;">
          <!-- Logo École Agrandie -->
          <div style="width: 98px; height: 98px; border-radius: 16px; background: white; padding: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <img src="${currentSchool.logoUrl || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80'}" alt="Logo École" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>

          <!-- Centre : Grand titre République, Nom complet de l'établissement, Sigle, Devise, Code MENA -->
          <div style="flex: 1; min-width: 0; text-align: center;">
            <p style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #1e293b; margin: 0 0 4px 0;">
              RÉPUBLIQUE DE CÔTE D'IVOIRE - MINISTÈRE DE L'ÉDUCATION NATIONALE
            </p>
            <h2 style="font-size: 21px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; font-family: 'Outfit', 'Inter', sans-serif; letter-spacing: 0.3px; line-height: 1.2;">
              ${schoolName}
            </h2>
            <p style="font-size: 15px; font-weight: 900; color: #059669; margin: 3px 0 0 0; text-transform: uppercase;">
              (${schoolShortName})
            </p>
            <p style="font-size: 12.5px; font-style: italic; color: #047857; margin: 3px 0 0 0; font-weight: 600;">
              « ${schoolMotto} »
            </p>
            <p style="font-size: 11px; color: #475569; margin: 3px 0 0 0; font-weight: 600;">
              ${schoolDistrict} • Code MENA : ${ministryCode}
            </p>
          </div>

          <!-- Emblème National Agrandie -->
          <div style="width: 98px; height: 98px; border-radius: 16px; background: white; padding: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <img src="${currentSchool.countryEmblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'}" alt="Emblème National" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
        </div>

        <!-- 2. Grand Badge d'Excellence & Titre Majeur du Diplôme -->
        <div style="padding: 6px 0 4px 0;">
          <div style="display: inline-block; padding: 5px 26px; border-radius: 9999px; font-size: 12.5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; background-color: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b; margin-bottom: 6px;">
            ★ DIPLÔME OFFICIEL D'EXCELLENCE ACADÉMIQUE ★
          </div>
          <h1 style="font-size: 34px; font-weight: 900; text-transform: uppercase; color: #451a03; margin: 0; font-family: 'Outfit', 'Inter', sans-serif; letter-spacing: 0.5px; line-height: 1.2;">
            ${laureate.title}
          </h1>
        </div>

        <!-- 3. Corps du Diplôme (Phrase solennelle, Nom, Description, Boîte de score) -->
        <div style="max-width: 880px; margin: 0 auto; color: #1e293b; font-size: 14.5px; line-height: 1.65;">
          <p style="font-style: italic; color: #334155; margin: 0 0 10px 0; font-size: 15px; font-weight: 500;">
            Le Conseil des Enseignants et la Direction de l'Établissement décernent solennellement le présent diplôme à l'élève :
          </p>

          <!-- Nom de l'élève (Rempli ou Ligne pointillée si Vierge) -->
          <div style="padding: 0 0 6px 0; border-bottom: 2.5px solid #0f172a; max-width: 580px; margin: 0 auto 12px auto; min-height: 38px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: ${isBlank ? '18px' : '26px'}; font-weight: 900; color: #0f172a; text-transform: uppercase; font-family: 'Outfit', 'Inter', sans-serif; letter-spacing: 0.5px;">
              ${laureate.fullName}
            </span>
          </div>

          <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 1.65;">
            Inscrit(e) en classe de <strong style="color: #0f172a; font-weight: 800;">${laureate.grade}</strong> (Matricule MENA : <strong style="color: #0f172a;">${laureate.matricule}</strong>), en reconnaissance de ses brillants résultats scolaires, son assiduité<br/>
            exemplaire et sa discipline constatée au cours du <strong style="color: #0f172a; font-weight: 800;">${selectedPeriod}</strong> (Année Scolaire <strong style="color: #047857; font-weight: 800;">${academicYear}</strong>).
          </p>

          <!-- Boîte de score et de rang agrandie (Pill jaune avec bordure dorée) -->
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 26px; padding: 10px 40px; border-radius: 9999px; background-color: #fef3c7; border: 1.5px solid #f59e0b; color: #78350f; font-size: 15px; font-weight: 700; white-space: nowrap; margin-top: 4px;">
            <span>Moyenne Générale : <strong style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: 'Outfit', sans-serif;">${laureate.average} ${isBlank ? '' : '/ 20'}</strong></span>
            <span style="color: #d97706; font-size: 16px;">•</span>
            <span>Rang de Classe : <strong style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: 'Outfit', sans-serif;">${laureate.rank}${laureate.rankSuffix}</strong></span>
          </div>
        </div>

        <!-- 4. Ligne fine dorée de séparation -->
        <div style="height: 1.5px; background-color: #fcd34d; width: 95%; margin: 16px auto 14px auto;"></div>

        <!-- 5. Signatures en 3 colonnes exactes -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; font-size: 12px; align-items: end; padding-bottom: 6px;">
          <!-- Colonne gauche : Professeur Principal -->
          <div style="text-align: left; padding-left: 14px;">
            <p style="font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 0 0 4px 0; font-size: 11.5px; letter-spacing: 0.5px;">
              LE PROFESSEUR PRINCIPAL
            </p>
            <div style="height: 46px; display: flex; align-items: center; justify-content: flex-start; font-style: italic; color: #334155; font-size: 15px;">
              Signé M. Kouamé
            </div>
          </div>

          <!-- Colonne centrale : Sceau MANOI officiel -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="width: 68px; height: 68px; border-radius: 9999px; border: 2.5px dashed #d97706; display: flex; align-items: center; justify-content: center; padding: 2px; background: #fffdfa;">
              <span style="font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #92400e; text-align: center; line-height: 1.2;">
                ★ SCEAU<br/>OFFICIEL<br/>MANOI ★
              </span>
            </div>
          </div>

          <!-- Colonne droite : Chef d'Établissement / Directeur avec Signature et Nom -->
          <div style="text-align: right; padding-right: 14px;">
            <p style="font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 0; font-size: 11.5px; letter-spacing: 0.5px;">
              LE CHEF D&apos;ÉTABLISSEMENT / LE DIRECTEUR
            </p>
            <p style="font-size: 9.5px; color: #64748b; margin: 2px 0 4px 0; font-family: monospace;">
              Fait à ${currentSchool.city || 'Abidjan'}, le ${currentDateFormatted}
            </p>
            <div style="height: 44px; display: flex; align-items: center; justify-content: flex-end;">
              ${
                currentSchool.stampUrl
                  ? `<img src="${currentSchool.stampUrl}" alt="Cachet" style="max-height: 44px; max-width: 115px; object-fit: contain; transform: rotate(-2deg);" />`
                  : `<div style="display: flex; align-items: center; justify-content: center; height: 38px; padding: 0 10px; border-radius: 6px; border: 1.5px dashed #059669; background: #ecfdf5; color: #065f46; font-size: 9.5px; font-weight: 800;">[ Cachet Officiel Direction ]</div>`
              }
            </div>
            <p style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 4px 0 0 0; letter-spacing: 0.5px;">
              ${directorName}
            </p>
          </div>
        </div>
      </div>
    `;
  };

  // Impression directe au Format A4 Paysage
  const handlePrintDiplomaLandscape = (laureate: any) => {
    const printWindow = window.open('', '_blank', 'width=1150,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const diplomaHTML = generateOfficialDiplomaHTML(laureate);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Diplome_${(laureate.title || 'Diplome').replace(/\s+/g, '_')}_${selectedPeriod.replace(/\s+/g, '_')}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 landscape;
            margin: 3mm 5mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            background: white !important;
            color: #0f172a !important;
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            height: 100%;
          }
          .font-heading {
            font-family: 'Outfit', sans-serif !important;
          }
        </style>
      </head>
      <body>
        <div style="padding: 2px 4px; height: 100%;">
          ${diplomaHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export Microsoft Word (.doc) en Format Paysage A4
  const exportDiplomaToWord = (laureate: any) => {
    const directorName = currentSchool.directorName || 'LAWANI MOUHAMED';
    const schoolName = currentSchool.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL';
    const schoolShortName = currentSchool.shortName || 'EPC MANOI';
    const schoolMotto = currentSchool.motto || 'Discipline • Rigueur • Réussite';
    const schoolDistrict = currentSchool.district || 'Abobo Biabou 2';
    const ministryCode = currentSchool.ministryCode || '321119';
    const academicYear = currentSchool.academicYear || '2026-2027';
    const currentDateFormatted = formatDate(new Date());

    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Diplome_${laureate.title.replace(/\s+/g, '_')}</title>
        <style>
          @page WordSection1 {
            size: 841.9pt 595.3pt;
            mso-page-orientation: landscape;
            margin: 0.3in 0.4in 0.3in 0.4in;
          }
          div.WordSection1 {
            page: WordSection1;
            font-family: 'Calibri', 'Arial', sans-serif;
            text-align: center;
            border: 3pt double #d97706;
            padding: 16pt;
            background-color: #ffffff;
          }
          h1 { font-size: 22pt; color: #451a03; margin: 6pt 0; text-transform: uppercase; font-weight: bold; }
          h2 { font-size: 15pt; color: #0f172a; margin: 3pt 0; text-transform: uppercase; font-weight: bold; }
          p { font-size: 11pt; color: #1e293b; line-height: 1.4; margin: 3pt 0; }
          .student-name { font-size: 20pt; font-weight: bold; color: #0f172a; text-decoration: underline; margin: 8pt 0; text-transform: uppercase; }
          .score-box { background: #fef3c7; border: 1.5pt solid #f59e0b; padding: 6pt 20pt; display: inline-block; margin: 8pt auto; font-size: 12pt; font-weight: bold; color: #78350f; }
          table.signatures { width: 100%; margin-top: 20pt; border-collapse: collapse; }
          table.signatures td { width: 33.33%; text-align: center; vertical-align: top; font-size: 10pt; }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          <p style="font-size: 9pt; font-weight: bold; letter-spacing: 2pt; text-transform: uppercase; color: #475569;">
            RÉPUBLIQUE DE CÔTE D'IVOIRE • MINISTÈRE DE L'ÉDUCATION NATIONALE
          </p>
          <h2>${schoolName} (${schoolShortName})</h2>
          <p style="font-style: italic; color: #047857; font-size: 9.5pt;">« ${schoolMotto} »</p>
          <p style="font-size: 9pt; color: #64748b;">${schoolDistrict} • Code MENA : ${ministryCode}</p>
          
          <hr style="border: 0.5pt solid #d97706; width: 60%; margin: 6pt auto;" />
          
          <p style="font-size: 9.5pt; font-weight: bold; color: #92400e; letter-spacing: 1.5pt; text-transform: uppercase;">
            ★ DIPLÔME OFFICIEL D'EXCELLENCE ACADÉMIQUE ★
          </p>
          <h1>${laureate.title}</h1>
          
          <p style="font-style: italic; color: #334155; margin-top: 8pt; font-size: 10.5pt;">
            Le Conseil des Enseignants et la Direction de l'Établissement décernent solennellement le présent diplôme à :
          </p>
          <div class="student-name">${laureate.fullName}</div>
          <p>
            Inscrit(e) en classe de <strong>${laureate.grade}</strong> (Matricule MENA : <strong>${laureate.matricule}</strong>)
          </p>
          <p>
            En reconnaissance de ses brillants résultats scolaires et de sa conduite exemplaire au cours du <strong>${selectedPeriod}</strong> (Année Scolaire <strong>${academicYear}</strong>).
          </p>
          
          <div class="score-box">
            Moyenne Générale : ${laureate.average} / 20 &nbsp;•&nbsp; Rang : ${laureate.rank}${laureate.rankSuffix} de la classe
          </div>
          
          <table class="signatures">
            <tr>
              <td style="text-align: left;">
                <strong>LE PROFESSEUR PRINCIPAL</strong><br/><br/>
                <em>Signé M. Kouamé</em>
              </td>
              <td>
                <div style="border: 1.5pt dashed #d97706; padding: 5pt; display: inline-block; color: #78350f; font-weight: bold; font-size: 8.5pt;">
                  ★ SCEAU OFFICIEL MANOI ★
                </div>
              </td>
              <td style="text-align: right;">
                <strong>LE CHEF D'ÉTABLISSEMENT / LE DIRECTEUR</strong><br/>
                <small>Fait à ${currentSchool.city || 'Abidjan'}, le ${currentDateFormatted}</small><br/><br/>
                <strong>${directorName}</strong>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Diplome_${laureate.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setToastMessage(`✓ Diplôme Word généré avec succès`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePrintAllDiplomas = () => {
    if (laureates.length === 0) {
      setToastMessage("Aucun élève distingué à imprimer : les bulletins de cette classe sont en attente.");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsBatchPrintModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Tableaux d&apos;Honneur & Diplômes d&apos;Excellence
            </h1>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs font-mono">
              {currentSchool.academicYear || '2026-2027'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Maternelle, Primaire, Collège & Lycée — Attribution automatique aux lauréats méritants (Top 3 et Ex æquo)
          </p>
        </div>

        {laureates.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handlePrintAllDiplomas}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Imprimer la Promotion ({laureates.length} Diplômes A4)</span>
            </button>
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= SECTION PRINCIPALE : TABLEAU D'HONNEUR & LAURÉATS ================= */}
      <div className="space-y-6 animate-in fade-in">
        {/* Sélecteur de Cycles */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:hidden">
          {[
            { id: 'all' as const, label: 'Tous les Cycles', icon: Layers },
            { id: 'maternelle' as const, label: 'Maternelle (P.S. à G.S.)', icon: Baby },
            { id: 'primaire' as const, label: 'Primaire (CP1 à CM2)', icon: BookOpen },
            { id: 'college' as const, label: 'Collège (6ème à 3ème)', icon: Building2 },
          ].map((c) => {
            const Icon = c.icon;
            const isActive = selectedCycle === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCycleChange(c.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="font-extrabold text-xs tracking-tight truncate">{c.label}</p>
                  <p className={`text-[10px] ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {laureates.length > 0 ? `${laureates.length} Lauréat(s)` : 'En attente'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Barre de sélection de classe et de période */}
        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-xs p-4 sm:p-5 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-extrabold text-slate-800 cursor-pointer"
              >
                {availableClassesForCycle.map((cls) => (
                  <option key={cls} value={cls}>
                    Classe : {cls}
                  </option>
                ))}
              </select>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-extrabold text-slate-800 cursor-pointer"
              >
                <option value="1er Trimestre">1er Trimestre</option>
                <option value="2ème Trimestre">2ème Trimestre</option>
                <option value="3ème Trimestre">3ème Trimestre</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {laureates.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handlePrintAllDiplomas}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>🖨️ Imprimer les {laureates.length} Diplômes de {selectedClass}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearClassBulletins}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                    title="Remettre en attente"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Remettre en attente</span>
                  </button>
                </>
              ) : (
                <Link
                  href={`/${schoolSlug}/admin/bulletins`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>📝 Saisir les Notes & Bulletins</span>
                </Link>
              )}
            </div>
          </div>

          {/* État 1 : BULLETINS NON ENCORE VALIDÉS -> ÉTAT D'ATTENTE AVEC EXPLICATION CLAIRE */}
          {laureates.length === 0 ? (
            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 text-xs">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="font-extrabold font-heading text-sm text-amber-950">
                      En attente des bulletins scolaires — Classe de {selectedClass} ({selectedPeriod})
                    </p>
                    <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                      Le Tableau d&apos;Honneur officiel (1ères, 2èmes, 3èmes places et tous les Ex æquo) est généré dès que les notes sont saisies et que les bulletins sont validés sur la page « Bulletins Scolaires ».
                    </p>
                  </div>
                </div>
                <Link
                  href={`/${schoolSlug}/admin/bulletins`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 shadow-xs shrink-0 cursor-pointer transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Accéder aux Bulletins de {selectedClass}</span>
                </Link>
              </div>

              {/* 3 Places VIDES de la Classe */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {/* Place 1 : Félicitations (Vide) */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-amber-300 p-5 flex flex-col justify-between space-y-4 bg-amber-50/15">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-black flex items-center justify-center text-xs">
                        🥇 1
                      </span>
                      <h4 className="text-xs font-black text-amber-900 uppercase">
                        1ère Place (et Ex æquo) : Félicitations
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                      En attente
                    </span>
                  </div>

                  <div className="space-y-2 py-3 border-y border-dashed border-slate-200 text-slate-400 text-xs font-mono">
                    <p className="font-semibold text-slate-500 italic">Lauréat(s) : <span className="font-normal">--- En attente des bulletins ---</span></p>
                    <p>Moyenne requise : Note la plus élevée</p>
                    <p>Distinction : Tableau d&apos;Honneur avec Félicitations</p>
                  </div>

                  <div className="text-center">
                    <span className="text-[11px] text-slate-400 italic">Attribution automatique dès clôture</span>
                  </div>
                </div>

                {/* Place 2 : Encouragements (Vide) */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-emerald-300 p-5 flex flex-col justify-between space-y-4 bg-emerald-50/15">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900 font-black flex items-center justify-center text-xs">
                        🥈 2
                      </span>
                      <h4 className="text-xs font-black text-emerald-900 uppercase">
                        2ème Place (et Ex æquo) : Encouragements
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                      En attente
                    </span>
                  </div>

                  <div className="space-y-2 py-3 border-y border-dashed border-slate-200 text-slate-400 text-xs font-mono">
                    <p className="font-semibold text-slate-500 italic">Lauréat(s) : <span className="font-normal">--- En attente des bulletins ---</span></p>
                    <p>Moyenne requise : 2ème rang de la classe</p>
                    <p>Distinction : Tableau d&apos;Honneur avec Encouragements</p>
                  </div>

                  <div className="text-center">
                    <span className="text-[11px] text-slate-400 italic">Attribution automatique dès clôture</span>
                  </div>
                </div>

                {/* Place 3 : Tableau d'Honneur (Vide) */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-blue-300 p-5 flex flex-col justify-between space-y-4 bg-blue-50/15">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 font-black flex items-center justify-center text-xs">
                        🥉 3
                      </span>
                      <h4 className="text-xs font-black text-blue-900 uppercase">
                        3ème Place (et Ex æquo) : Tableau d&apos;Honneur
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                      En attente
                    </span>
                  </div>

                  <div className="space-y-2 py-3 border-y border-dashed border-slate-200 text-slate-400 text-xs font-mono">
                    <p className="font-semibold text-slate-500 italic">Lauréat(s) : <span className="font-normal">--- En attente des bulletins ---</span></p>
                    <p>Moyenne requise : 3ème rang de la classe</p>
                    <p>Distinction : Tableau d&apos;Honneur</p>
                  </div>

                  <div className="text-center">
                    <span className="text-[11px] text-slate-400 italic">Attribution automatique dès clôture</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* État 2 : BULLETINS VALIDÉS -> AFFICHAGE DYNAMIQUE DES LAURÉATS OFFICIELS (TOP 3 ET EX ÆQUO) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {laureates.map((laureate) => (
                <div
                  key={laureate.id}
                  className="bg-white rounded-2xl border-2 border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group"
                >
                  <div className={`absolute top-0 right-0 left-0 h-2 bg-gradient-to-r ${laureate.colorClass}`} />
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-extrabold text-slate-800 text-base font-heading shadow-2xs">
                        {laureate.rank === 1 ? '🥇' : laureate.rank === 2 ? '🥈' : '🥉'}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 uppercase font-heading">
                          {laureate.fullName}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">
                          {laureate.studentNumber} • {laureate.matricule}
                        </p>
                      </div>
                    </div>
                    <GenderBadge gender={laureate.gender} />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Moyenne & Rang
                      </span>
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <strong className="text-lg font-black text-slate-900 font-heading">
                          {laureate.average} / 20
                        </strong>
                        <span className="text-xs font-bold text-emerald-700">
                          ({laureate.rank}{laureate.rankSuffix})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black shadow-2xs whitespace-nowrap ${
                          laureate.distinctionType === 'felicitations'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : laureate.distinctionType === 'encouragement'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-blue-100 text-blue-900 border border-blue-300'
                        }`}
                      >
                        {laureate.distinctionType === 'felicitations' && <Trophy className="w-3.5 h-3.5 shrink-0" />}
                        {laureate.distinctionType === 'encouragement' && <Award className="w-3.5 h-3.5 shrink-0" />}
                        {laureate.distinctionType === 'honneur' && <Medal className="w-3.5 h-3.5 shrink-0" />}
                        <span>
                          {laureate.distinctionType === 'felicitations'
                            ? 'Félicitations'
                            : laureate.distinctionType === 'encouragement'
                            ? 'Encouragements'
                            : "Tableau d'Honneur"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDiploma(laureate)}
                      className="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Aperçu Diplôme</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintDiplomaLandscape(laureate)}
                      title="Imprimer directement en format A4 Paysage"
                      className="py-2 px-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>A4</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDiplomaToWord(laureate)}
                      title="Télécharger en document Word (.doc)"
                      className="py-2 px-2.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Word</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODALE 1 : APERÇU DU DIPLÔME OFFICIEL ================= */}
      {isDiplomaModalOpen && selectedStudentForDiploma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full p-6 sm:p-8 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 font-heading text-sm sm:text-base">
                  Diplôme Officiel d&apos;Excellence Académique (Format Paysage A4)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportDiplomaToWord(selectedStudentForDiploma)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>📄 Télécharger Word (.doc)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintDiplomaLandscape(selectedStudentForDiploma)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Imprimer en Paysage A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDiplomaModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rendu exact de la capture */}
            <div
              className="w-full"
              dangerouslySetInnerHTML={{
                __html: generateOfficialDiplomaHTML(selectedStudentForDiploma),
              }}
            />
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : TIRAGE GROUPÉ DES 3 DIPLÔMES A4 PAYSAGE ================= */}
      {isBatchPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div>
                <h3 className="font-black text-lg text-slate-900 font-heading">
                  Impression Groupée des Diplômes — {selectedClass} ({laureates.length} Lauréats)
                </h3>
                <p className="text-xs text-slate-500">
                  Les 3 diplômes officiels du tableau d&apos;honneur format A4 Paysage prêts pour l&apos;impression
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'width=1150,height=800');
                    if (!printWindow) {
                      window.print();
                      return;
                    }
                    const batchContent = laureates
                      .map((l) => `<div style="page-break-after: always; padding: 2px 4px; height: 100%;">${generateOfficialDiplomaHTML(l)}</div>`)
                      .join('');

                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html lang="fr">
                      <head>
                        <meta charset="utf-8" />
                        <title>Diplomes_${selectedClass}_${selectedPeriod.replace(/\s+/g, '_')}</title>
                        <link rel="preconnect" href="https://fonts.googleapis.com">
                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
                        <style>
                          @page {
                            size: A4 landscape;
                            margin: 3mm 5mm !important;
                          }
                          * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            box-sizing: border-box;
                          }
                          html, body {
                            background: white !important;
                            color: #0f172a !important;
                            font-family: 'Inter', sans-serif;
                            margin: 0;
                            padding: 0;
                          }
                        </style>
                      </head>
                      <body>
                        ${batchContent}
                        <script>
                          window.onload = function() {
                            setTimeout(function() {
                              window.focus();
                              window.print();
                            }, 250);
                          };
                        </script>
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Lancer l&apos;Impression ({laureates.length} Diplômes A4 Paysage)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Liste des 3 diplômes */}
            <div className="space-y-8">
              {laureates.map((laureate) => (
                <div
                  key={laureate.id}
                  dangerouslySetInnerHTML={{ __html: generateOfficialDiplomaHTML(laureate) }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
