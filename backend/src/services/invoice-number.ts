import { Invoice } from '../models/index.js';

const INVOICE_NUMBER_PATTERN = /^INV-(\d+)$/;

export function invoiceSequence(value: unknown) {
  const match = INVOICE_NUMBER_PATTERN.exec(String(value ?? '').trim());
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

export function lowestAvailableInvoiceSequence(values: Iterable<unknown>) {
  const used = new Set<number>();
  for (const value of values) {
    const sequence = invoiceSequence(value);
    if (sequence !== null) used.add(sequence);
  }

  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  if (!Number.isSafeInteger(candidate)) throw new Error('Invoice number range is exhausted.');
  return candidate;
}

export function formatInvoiceNumber(sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invoice sequence must be a positive safe integer.');
  return `INV-${String(sequence).padStart(5, '0')}`;
}

/**
 * Return the lowest unused invoice number for this owner. The invoice model's
 * compound unique index is the final concurrency guard; callers retry when two
 * requests inspect the same gap at the same time.
 */
export async function nextAvailableInvoiceNumber(userId: unknown) {
  const invoices = await Invoice.find({ userId }).select({ invoiceNumber: 1, _id: 0 }).lean();
  return formatInvoiceNumber(lowestAvailableInvoiceSequence(invoices.map(invoice => invoice.invoiceNumber)));
}

export function isInvoiceNumberConflict(error: any) {
  if (Number(error?.code) !== 11000) return false;
  if (error?.keyPattern?.invoiceNumber || error?.keyValue?.invoiceNumber) return true;
  return /invoiceNumber|userId_1_invoiceNumber_1/i.test(String(error?.message || ''));
}
