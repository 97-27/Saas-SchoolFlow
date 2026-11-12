import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { kvSchoolId } from '@/lib/supabase/kv';
import { sendPushToRoles } from '@/lib/server/push';

/** Reçoivent l'alerte « versement reçu » sur leur téléphone (même application fermée). */
const PAYMENT_PUSH_ROLES = ['fondateur', 'fondateur_adjoint', 'comptable'];

const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;

/** Montant déjà payé sur ce reçu AVANT l'enregistrement (0 si nouveau reçu). */
export async function paidAmountBefore(slug: string, invoice: any): Promise<number> {
  try {
    const schoolId = await kvSchoolId(slug);
    if (!schoolId) return 0;
    let q = supabase.from('invoices').select('paid_amount').eq('school_id', schoolId).limit(1);
    if (invoice?.id && /^[0-9a-f-]{36}$/i.test(String(invoice.id))) q = q.eq('id', invoice.id);
    else if (invoice?.invoiceNumber) q = q.eq('invoice_number', String(invoice.invoiceNumber));
    else return 0;
    const { data } = await q.maybeSingle();
    return Number((data as any)?.paid_amount) || 0;
  } catch {
    return 0;
  }
}

/**
 * Après l'enregistrement d'un reçu : si le montant payé a augmenté, la Direction et le
 * Comptable sont prévenus (sonnerie « argent » sur l'appareil). Jamais pour l'auteur lui-même.
 */
export async function notifyPaymentIfIncreased(
  slug: string,
  invoice: any,
  before: number,
  session: { staffId?: string; code: string }
): Promise<void> {
  try {
    const after = Number(invoice?.paidAmount) || 0;
    const delta = after - before;
    if (delta <= 0) return;
    const schoolId = await kvSchoolId(slug);
    if (!schoolId) return;
    const name = String(invoice?.studentName || 'Élève').toUpperCase();
    const grade = invoice?.studentGrade ? ` (${invoice.studentGrade})` : '';
    await sendPushToRoles(
      schoolId,
      PAYMENT_PUSH_ROLES,
      {
        title: '💰 Versement reçu',
        body: `${name}${grade} — ${fcfa(delta)} • ${invoice?.feeType || 'Scolarité'}${invoice?.invoiceNumber ? ` • Reçu ${invoice.invoiceNumber}` : ''}`,
        url: `/${slug}/admin/versements`,
        tag: `paiement-${invoice?.id || invoice?.invoiceNumber || Date.now()}`,
        sound: 'cash',
      },
      { exceptStaffId: session.staffId || session.code }
    );
  } catch {}
}
