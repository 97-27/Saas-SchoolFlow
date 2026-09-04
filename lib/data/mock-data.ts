import { Invoice, InvoiceStatus, Student, DashboardKPIs, School, CanteenSubscription, TransportSubscription, BoardingStudent, SpecialDiscount, StudentInstallments } from './types';

export const mockSchools: Record<string, School> = {
  'college-excellence': {
    id: 'sch-001',
    slug: 'college-excellence',
    name: 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL',
    shortName: 'EPC MANOI',
    motto: 'Discipline • Rigueur • Réussite',
    slogan: 'Former les élites et leaders de demain pour un avenir radieux',
    logoUrl: '',
    countryEmblemUrl: '',
    logoColor: '#10b981',
    ministryCode: '321119',
    approvalNumber: 'Arrêté N° 0452/MENA/DES',

    // Localisation & Contacts
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    district: 'Abobo Biabou 2',
    postalBox: '25 BP 1420 Abidjan 25',
    phone: '+225 27 22 44 11 00',
    whatsappPhone: '+225 07 48 92 11 00',
    email: 'direction@epc-manoi.ci',
    website: 'https://epc-manoi.ci',

    // Academic Calendar
    academicYear: '2026-2027',
    currentTerm: 'Trimestre 1',
    termType: 'trimestriel',
    openingDate: '2026-09-07',
    closingDate: '2027-06-30',

    // Cycles & Services
    hasMaternelle: true,
    hasPrimaire: true,
    hasCollege: true,
    hasLycee: true,
    hasBoarding: true,
    boardingCapacity: 100,
    hasCanteen: true,
    hasTransport: true,
    hasAfterSchoolCare: true,

    // Direction, Fondateur & Official Stamps
    founderName: 'LAWANI MOUHAMED',
    directorName: 'M. Jean-Marc Kouassi',
    studiesDirectorName: 'M. Kouamé',
    stampUrl: '',
    receiptFooterNote: 'Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement.',
  },
  'saint-joseph': {
    id: 'sch-002',
    slug: 'saint-joseph',
    name: 'Groupe Scolaire Saint-Joseph',
    shortName: 'Saint-Joseph',
    motto: 'Foi • Savoir • Excellence',
    logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80',
    countryEmblemUrl: '',
    logoColor: '#059669',
    ministryCode: 'MEN-09213-SN',
    approvalNumber: 'Décision N° 102/MEN/DA du 05/04/2015',

    city: 'Dakar',
    country: 'Sénégal',
    district: 'Plateau, Rue Carnot',
    postalBox: 'BP 3400 Dakar',
    phone: '+221 33 821 45 67',
    whatsappPhone: '+221 77 654 32 10',
    email: 'contact@saint-joseph-dakar.sn',
    website: 'https://saint-joseph-dakar.sn',

    academicYear: '2026-2027',
    currentTerm: 'Semestre 1',
    termType: 'semestriel',
    openingDate: '2026-10-05',
    closingDate: '2027-07-15',

    hasMaternelle: true,
    hasPrimaire: true,
    hasCollege: true,
    hasLycee: true,
    hasBoarding: false,
    boardingCapacity: 0,
    hasCanteen: true,
    hasTransport: true,
    hasAfterSchoolCare: false,

    founderName: 'Mr Lawani El Hadj',
    directorName: 'Frère Jean-Marie Diouf',
    studiesDirectorName: 'M. Amadou Fall',
    stampUrl: '',
    receiptFooterNote: 'Quittance officielle de paiement de scolarité — Groupe Scolaire Saint-Joseph Dakar.',
  },
  'epc-manoi': {
    id: 'sch-003',
    slug: 'epc-manoi',
    name: 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL',
    shortName: 'EPC MANOI',
    motto: 'Discipline • Rigueur • Réussite',
    slogan: 'Former les élites et leaders de demain pour un avenir radieux',
    logoUrl: '',
    countryEmblemUrl: '',
    logoColor: '#10b981',
    ministryCode: '321119',
    approvalNumber: 'Arrêté N° 0452/MENA/DES',

    city: 'Abidjan',
    country: "Côte d'Ivoire",
    district: 'Abobo Biabou 2',
    postalBox: '25 BP 1420 Abidjan 25',
    phone: '+225 27 22 44 11 00',
    whatsappPhone: '+225 07 48 92 11 00',
    email: 'direction@epc-manoi.ci',
    website: 'https://epc-manoi.ci',

    academicYear: '2026-2027',
    currentTerm: 'Trimestre 1',
    termType: 'trimestriel',
    openingDate: '2026-09-07',
    closingDate: '2027-06-30',

    hasMaternelle: true,
    hasPrimaire: true,
    hasCollege: true,
    hasLycee: true,
    hasBoarding: true,
    boardingCapacity: 100,
    hasCanteen: true,
    hasTransport: true,
    hasAfterSchoolCare: true,

    founderName: 'LAWANI MOUHAMED',
    directorName: 'M. Jean-Marc Kouassi',
    studiesDirectorName: 'M. Kouamé',
    stampUrl: '',
    receiptFooterNote: 'Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement.',
  },
  'epc-markaz': {
    id: 'sch-004',
    slug: 'epc-markaz',
    name: 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL',
    shortName: 'EPC MANOI',
    motto: 'Discipline • Rigueur • Réussite',
    slogan: 'Former les élites et leaders de demain pour un avenir radieux',
    logoUrl: '',
    countryEmblemUrl: '',
    logoColor: '#10b981',
    ministryCode: '321119',
    approvalNumber: 'Arrêté N° 0452/MENA/DES',

    city: 'Abidjan',
    country: "Côte d'Ivoire",
    district: 'Abobo Biabou 2',
    postalBox: '25 BP 1420 Abidjan 25',
    phone: '+225 27 22 44 11 00',
    whatsappPhone: '+225 07 48 92 11 00',
    email: 'direction@epc-markaz.ci',
    website: 'https://epc-markaz.ci',

    academicYear: '2026-2027',
    currentTerm: 'Trimestre 1',
    termType: 'trimestriel',
    openingDate: '2026-09-07',
    closingDate: '2027-06-30',

    hasMaternelle: true,
    hasPrimaire: true,
    hasCollege: true,
    hasLycee: true,
    hasBoarding: true,
    boardingCapacity: 100,
    hasCanteen: true,
    hasTransport: true,
    hasAfterSchoolCare: true,

    founderName: 'LAWANI MOUHAMED',
    directorName: 'M. Jean-Marc Kouassi',
    studiesDirectorName: 'M. Kouamé',
    stampUrl: '',
    receiptFooterNote: 'Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement.',
  },
};

export const defaultSchool = mockSchools['epc-manoi'] || mockSchools['college-excellence'];

export const mockKPIs: DashboardKPIs = {
  totalStudents: 0,
  totalStudentsTrend: 0,
  totalStudentsGirls: 0,
  totalStudentsBoys: 0,

  returningStudents: 0,
  returningStudentsGirls: 0,
  returningStudentsBoys: 0,

  newStudents: 0,
  newStudentsGirls: 0,
  newStudentsBoys: 0,

  boardingStudents: 0,
  boardingStudentsGirls: 0,
  boardingStudentsBoys: 0,

  collectionRate: 0,
  collectionRateTrend: 0,
  totalCollectedFCFA: 0,
  totalOverdueFCFA: 0,
  overdueInvoicesCount: 0,
  avgAttendance: 0,
  avgAttendanceTrend: 0,
  activeStaffCount: 1,
  monthlyRevenue: [
    { month: 'Septembre', collected: 0, target: 0, percentage: 0, color: '#10b981' },
    { month: 'Octobre', collected: 0, target: 0, percentage: 0, color: '#10b981' },
    { month: 'Novembre', collected: 0, target: 0, percentage: 0, color: '#10b981' },
    { month: 'Décembre', collected: 0, target: 0, percentage: 0, color: '#fbbf24' },
    { month: 'Janvier', collected: 0, target: 0, percentage: 0, color: '#f97316' },
  ],
  feeBreakdown: [
    { category: 'Scolarités trimestrielles', amount: 0, percentage: 0, color: '#10b981' },
    { category: "Droits d'inscription", amount: 0, percentage: 0, color: '#fbbf24' },
    { category: 'Cantine & Restauration', amount: 0, percentage: 0, color: '#3b82f6' },
    { category: 'Transport scolaire', amount: 0, percentage: 0, color: '#8b5cf6' },
  ],
};

export const availableClasses = [
  'Toutes les classes',
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
  '2nde A',
  '2nde C',
  '2nde D',
  '1ère A',
  '1ère C',
  '1ère D',
  'Terminale A',
  'Terminale C',
  'Terminale D',
];

export const mockStudents: Student[] = [];

export const mockInvoices: Invoice[] = [];

export const mockCanteenSubscriptions: CanteenSubscription[] = [];

export const mockTransportSubscriptions: TransportSubscription[] = [];

export const mockBoardingStudents: BoardingStudent[] = [];

export const mockSpecialDiscounts: SpecialDiscount[] = [];
