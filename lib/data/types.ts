export type InvoiceStatus = 'paid' | 'sent' | 'draft' | 'overdue' | 'partial';

export interface InstallmentRecord {
  amount: number; // Montant versé en FCFA
  paymentMethod?: string; // 'Espèces' | 'Virement bancaire' | 'Paiement en ligne (Wave)' | 'Orange Money' | 'MTN Money' | 'Moov Money'
  method?: string; // Alias de paymentMethod
  date?: string; // Date du versement JJ/MM/AAAA ou YYYY-MM-DD
  receiptNumber?: string;
}

export interface StudentInstallments {
  versement1?: InstallmentRecord;
  versement2?: InstallmentRecord;
  versement3?: InstallmentRecord;
  versement4?: InstallmentRecord;
  versement5?: InstallmentRecord;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  studentGrade: string;
  studentGender: 'male' | 'female';
  guardianName: string;
  guardianPhone: string;
  feeType: string;
  amount: number; // in FCFA (Frais d'inscription / initial)
  paidAmount: number;
  discountAmount?: number;
  netAmount?: number;
  balanceRemaining?: number;
  paymentMethod?: string;
  enrollmentType?: 'ancien' | 'nouveau';
  installments?: StudentInstallments;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
}

export interface Student {
  id: string;
  studentNumber: string; // e.g. ID-001
  matricule: string; // Matricule officiel à 8 chiffres + 1 lettre majuscule (ex: 26014829K)
  lastName: string; // Nom de famille
  firstName: string; // Prénom
  fullName: string;
  avatar: string;
  grade: string;
  gender: 'male' | 'female';
  address: string; // Adresse de résidence de l'enfant
  guardianName: string;
  guardianPhone: string;
  whatsappPhone: string; // Contact WhatsApp du parent
  registrationFee?: number; // Droit d'inscription en FCFA
  tuitionAmount: number; // Somme initiale de la scolarité en FCFA
  discountAmount?: number; // Réduction accordée (ex: 5 000 FCFA, 10 000 FCFA)
  netAmount?: number; // Somme nette après réduction
  paidAmount: number;
  balanceRemaining?: number;
  paymentDate: string; // Date du versement / enregistrement
  enrollmentDate?: string;
  attendanceRate: number;
  dateOfBirth?: string;
  status: 'active' | 'on_leave' | 'transferred';
  tuitionStatus: 'paid' | 'partial' | 'unpaid';
  enrollmentType?: 'ancien' | 'nouveau';
  paymentMethod?: string;
  installments?: StudentInstallments;
  notes?: string;
  isBoarding?: boolean;
  isCanteen?: boolean;
  isTransport?: boolean;
}

export interface DashboardKPIs {
  totalStudents: number;
  totalStudentsTrend: number; // e.g. +8%
  totalStudentsGirls: number;
  totalStudentsBoys: number;

  returningStudents: number; // Anciens inscrits
  returningStudentsGirls: number;
  returningStudentsBoys: number;

  newStudents: number; // Nouveaux inscrits
  newStudentsGirls: number;
  newStudentsBoys: number;

  boardingStudents: number; // Internat
  boardingStudentsGirls: number;
  boardingStudentsBoys: number;

  collectionRate: number; // e.g. 87.4%
  collectionRateTrend: number;
  totalCollectedFCFA: number;
  totalOverdueFCFA: number;
  overdueInvoicesCount: number;
  avgAttendance: number; // e.g. 94.8%
  avgAttendanceTrend: number;
  activeStaffCount: number;
  monthlyRevenue: Array<{
    month: string;
    collected: number;
    target: number;
    percentage: number;
    color: string;
  }>;
  feeBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    color: string;
  }>;
}

export interface School {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  motto?: string; // Devise officielle (ex: Discipline • Rigueur • Réussite)
  slogan?: string; // Slogan de l'établissement (ex: L'excellence au service de l'avenir)
  receiptHeaderMotto?: string;
  receiptHeaderSlogan?: string;
  receiptHeaderAddress?: string;
  receiptHeaderPhone?: string;
  menaCode?: string;
  logoUrl?: string;
  countryEmblemUrl?: string; // Emblème / Armoiries officielles du pays
  logoColor: string;
  ministryCode?: string;
  approvalNumber?: string;

  // Localisation & Contacts
  city: string;
  country: string;
  district?: string;
  postalBox?: string;
  phone?: string;
  whatsappPhone?: string;
  email?: string;
  website?: string;

  // Academic Calendar
  academicYear: string;
  currentTerm: string;
  termType?: 'trimestriel' | 'semestriel';
  openingDate?: string;
  closingDate?: string;

  // Cycles & Services
  hasMaternelle?: boolean;
  hasPrimaire?: boolean;
  hasCollege?: boolean;
  hasLycee?: boolean;
  hasBoarding?: boolean;
  boardingCapacity?: number;
  hasCanteen?: boolean;
  hasTransport?: boolean;
  hasAfterSchoolCare?: boolean;

  // Direction, Fondateur & Official Stamps
  founderName?: string; // Nom officiel du Fondateur (ex: Mr Lawani El Hadj)
  directorName?: string;
  studiesDirectorName?: string;
  stampUrl?: string;
  receiptFooterNote?: string;

  // Subscription & Account Status
  status?: 'active' | 'pending' | 'suspended';
  subscriptionPlan?: string;
  subscriptionPrice?: number;
  createdAt?: string;
}

export interface CanteenSubscription {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  grade: string;
  gender: 'male' | 'female';
  plan: 'Trimestriel (Midi)' | 'Annuel Complet' | 'Tickets Journaliers';
  dietaryRestrictions?: string;
  amountFCFA: number;
  paidFCFA: number;
  status: 'paid' | 'partial' | 'unpaid';
  parentWhatsapp: string;
}

export interface TransportSubscription {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  grade: string;
  gender: 'male' | 'female';
  lineName: string;
  pickupStop: string;
  busNumber: string;
  amountFCFA: number;
  paidFCFA: number;
  status: 'paid' | 'partial' | 'unpaid';
  parentWhatsapp: string;
}

export interface BoardingStudent {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  grade: string;
  gender: 'male' | 'female';
  pavilion: string;
  roomNumber: string;
  bedNumber: string;
  medicalNotes?: string;
  emergencyContact: string;
  emergencyPhone: string;
  amountFCFA: number;
  paidFCFA: number;
  status: 'paid' | 'partial' | 'unpaid';
}

export interface SpecialDiscount {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  grade: string;
  gender: 'male' | 'female';
  discountCategory:
    | 'Fratrie (-10%)'
    | 'Bourse au Mérite (Excellence)'
    | 'Cas Social & Solidarité'
    | 'Enfant de Personnel / Enseignant'
    | 'Situation de Handicap';
  originalAmountFCFA: number;
  discountAmountFCFA: number;
  netAmountFCFA: number;
  status: 'validated' | 'pending' | 'rejected';
  beneficiaryReason: string;
  grantedBy: string;
  grantedDate: string;
  certificateRef: string;
}
