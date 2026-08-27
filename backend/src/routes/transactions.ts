import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { Party, Transaction } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/security.js';
import {
  normalizeOwnedAttachment,
  refreshedOwnedAttachment,
  sameStoredFile
} from '../services/storage.js';
import { removeOwnedStoredFileIfUnreferenced } from '../services/storage-records.js';
import { roundMoney } from '../utils/accounting.js';
import { attachmentInputSchema } from '../utils/attachments.js';

const r = Router();
r.use(requireAuth);
r.use(idempotency);

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().positive().max(1_000_000_000),
  category: z.string().trim().min(1).max(100),
  paymentMethod: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(2000).optional(),
  date: z.coerce.date(),
  partyId: z.string().trim().optional().or(z.literal('')),
  vatTreatment: z.enum(['TAXABLE', 'ZERO_RATED', 'EXEMPT']).default('TAXABLE'),
  vatPercent: z.coerce.number().min(0).max(100).default(5),
  attachment: attachmentInputSchema.nullable().optional()
});

function vat(amount: number, treatment: string, percent: number) {
  return roundMoney(treatment === 'TAXABLE' && percent > 0 ? (amount * percent) / (100 + percent) : 0);
}

function responseRecord(value: any, ownerId: unknown) {
  const record = value?.toObject?.() || value;
  const attachment = refreshedOwnedAttachment(record?.attachment, ownerId);
  return { ...record, ...(attachment ? { attachment } : { attachment: undefined }) };
}

async function linkedParty(partyId: string | undefined, ownerId: unknown) {
  if (!partyId) return null;
  if (!isValidObjectId(partyId)) return null;
  return Party.findOne({ _id: partyId, userId: ownerId });
}

r.get('/', async (req, res) => {
  const q: any = { userId: req.user._id };
  if (req.query.type) q.type = req.query.type;
  if (req.query.category) q.category = req.query.category;
  if (req.query.paymentMethod) q.paymentMethod = req.query.paymentMethod;
  if (req.query.month) {
    const [year, month] = String(req.query.month).split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) return res.status(400).json({ message: 'Month filter must use YYYY-MM format.' });
    q.date = { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) };
  }
  const items = await Transaction.find(q).sort({ date: -1, createdAt: -1 }).limit(500).lean();
  res.json(items.map(item => responseRecord(item, req.user._id)));
});

r.post('/', async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Transaction details are invalid.', issues: p.error.flatten() });

  const party = await linkedParty(p.data.partyId, req.user._id);
  if (p.data.partyId && !party) return res.status(400).json({ message: 'The selected customer/supplier no longer exists.' });
  const attachment = p.data.attachment ? await normalizeOwnedAttachment(p.data.attachment, req.user._id) : undefined;
  const amount = roundMoney(p.data.amount);
  const created = await Transaction.create({
    ...p.data,
    amount,
    partyId: party?._id,
    partyName: party?.name || '',
    vatAmount: vat(amount, p.data.vatTreatment, p.data.vatPercent),
    attachment,
    userId: req.user._id
  });
  res.status(201).json(responseRecord(created, req.user._id));
});

r.put('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Transaction not found' });
  const p = schema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Transaction details are invalid.', issues: p.error.flatten() });
  const transaction: any = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
  if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

  const oldAttachment = transaction.attachment?.toObject?.() || transaction.attachment;
  let partyName = transaction.partyName || '';
  let partyId: any = transaction.partyId;
  if (p.data.partyId !== undefined) {
    const party = await linkedParty(p.data.partyId, req.user._id);
    if (p.data.partyId && !party) return res.status(400).json({ message: 'The selected customer/supplier no longer exists.' });
    partyId = party?._id;
    partyName = party?.name || '';
  }

  let nextAttachment: any = oldAttachment;
  if (p.data.attachment !== undefined) {
    nextAttachment = p.data.attachment ? await normalizeOwnedAttachment(p.data.attachment, req.user._id) : undefined;
  }
  const updates: any = { ...p.data };
  delete updates.partyId;
  delete updates.attachment;
  Object.assign(transaction, updates);
  if (p.data.amount !== undefined) transaction.amount = roundMoney(p.data.amount);
  transaction.partyId = partyId;
  transaction.partyName = partyName;
  transaction.attachment = nextAttachment;
  transaction.vatAmount = vat(Number(transaction.amount), String(transaction.vatTreatment), Number(transaction.vatPercent));
  await transaction.save();

  if (oldAttachment && !sameStoredFile(oldAttachment, nextAttachment)) {
    try { await removeOwnedStoredFileIfUnreferenced(oldAttachment, req.user._id); }
    catch (error: any) { console.warn('Replaced transaction attachment cleanup failed:', error?.message || error); }
  }
  res.json(responseRecord(transaction, req.user._id));
});

r.delete('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Transaction not found' });
  const transaction: any = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
  if (transaction.attachment) {
    try { await removeOwnedStoredFileIfUnreferenced(transaction.attachment, req.user._id); }
    catch (error: any) { console.warn('Deleted transaction attachment cleanup failed:', error?.message || error); }
  }
  res.status(204).end();
});

export default r;
