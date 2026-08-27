import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Counter, Invoice, Party, mongoose } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/security.js';
import { REPORT_BRAND as B } from '../config/brand.js';
import { pdfImageBuffer } from '../utils/assets.js';
import { normalizeOwnedAttachment, refreshedOwnedAttachment } from '../services/storage.js';
import { removeOwnedStoredFileIfUnreferenced } from '../services/storage-records.js';
import { attachmentInputSchema } from '../utils/attachments.js';
import { invoicePaymentState, roundMoney, sumMoney } from '../utils/accounting.js';
import { sendDownload } from '../utils/download.js';

const router = Router();
router.use(requireAuth);
router.use(idempotency);

const MAX_BOOK_VALUE = 1_000_000_000_000;
const objectIdSchema = z.string().refine(value => mongoose.isObjectIdOrHexString(value), 'Invalid record identifier');
const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  qty: z.coerce.number().positive().max(1_000_000_000),
  unitPrice: z.coerce.number().min(0).max(MAX_BOOK_VALUE),
  vatPercent: z.coerce.number().min(0).max(100).default(5)
});
const createInvoiceSchema = z.object({
  customerId: objectIdSchema,
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  lines: z.array(lineSchema).min(1).max(500),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().trim().max(5000).optional(),
  attachment: attachmentInputSchema.optional(),
  openingStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).default('UNPAID'),
  openingPaidAmount: z.coerce.number().min(0).max(MAX_BOOK_VALUE).default(0),
  openingPaymentMethod: z.string().trim().min(1).max(80).default('Bank Transfer'),
  openingPaymentNotes: z.string().trim().max(500).optional()
});
const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(MAX_BOOK_VALUE),
  date: z.coerce.date(),
  method: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(500).optional()
});

export function calculateInvoice(lines: z.infer<typeof lineSchema>[], discountPercent: number) {
  const mapped = lines.map(line => ({
    ...line,
    qty: Number(line.qty),
    unitPrice: roundMoney(line.unitPrice),
    vatPercent: Number(line.vatPercent),
    amount: roundMoney(Number(line.qty) * Number(line.unitPrice))
  }));
  const subtotal = sumMoney(mapped.map(line => line.amount));
  const normalizedDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountAmount = roundMoney(subtotal * normalizedDiscountPercent / 100);
  const taxableAfterDiscount = roundMoney(Math.max(0, subtotal - discountAmount));
  const discountRatio = subtotal > 0 ? taxableAfterDiscount / subtotal : 0;
  const vatAmount = sumMoney(mapped.map(line => line.amount * discountRatio * line.vatPercent / 100));
  const total = roundMoney(taxableAfterDiscount + vatAmount);
  return { mapped, subtotal, discountPercent: normalizedDiscountPercent, discountAmount, vatAmount, total };
}

async function nextNumber(userId: unknown) {
  const counter: any = await Counter.findOneAndUpdate(
    { _id: `${String(userId)}:invoice` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `INV-${String(counter.seq).padStart(5, '0')}`;
}

function money(value: unknown, currency = 'AED') {
  return `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeText(value: unknown) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

function finite(value: unknown) {
  return Number.isFinite(Number(value));
}

function formatDate(value: unknown) {
  const date = new Date(value as any);
  if (!Number.isFinite(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC' });
}

function footer(doc: PDFKit.PDFDocument, business: any, invoiceNumber: string) {
  const y = doc.page.height - 55;
  doc.moveTo(40, y - 9).lineTo(doc.page.width - 40, y - 9).strokeColor(B.line).stroke();
  doc.font('Helvetica').fontSize(6.8).fillColor(B.muted).text(
    `${B.poweredBy}  •  ${safeText(business.name || business.legalName || 'Business')}  •  ${invoiceNumber}`,
    40,
    y,
    { width: doc.page.width - 80, align: 'center', lineBreak: false }
  );
  doc.fontSize(6.4).text(B.builtBy, 40, y + 9, { width: doc.page.width - 80, align: 'center', lineBreak: false });
}

function invoiceHeader(doc: PDFKit.PDFDocument, invoice: any, business: any, logo: Buffer | null, continued = false) {
  const right = 340;
  if (logo) {
    try { doc.image(logo, 40, 32, { fit: [132, 52], valign: 'center' }); } catch {}
  }
  const businessName = safeText(business.name || business.legalName || 'Business');
  if (!logo) doc.font('Helvetica-Bold').fontSize(18).fillColor(B.ink).text(businessName, 40, 42, { width: 260, height: 44, ellipsis: true });
  else doc.font('Helvetica-Bold').fontSize(10).fillColor(B.ink).text(businessName, 40, 88, { width: 260, height: 18, ellipsis: true });
  doc.font('Helvetica').fontSize(7.5).fillColor(B.muted).text(B.poweredBy, right, 35, { width: 215, align: 'right' });
  doc.fontSize(7).text(B.builtBy, right, 45, { width: 215, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(continued ? 18 : 25).fillColor(B.ink).text(continued ? 'INVOICE • CONTINUED' : 'INVOICE', right, 59, { width: 215, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(B.primary).text(safeText(invoice.invoiceNumber), right, 91, { width: 215, align: 'right' });
  doc.moveTo(40, 114).lineTo(555, 114).strokeColor(B.line).stroke();
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.roundedRect(40, y, 515, 27, 7).fill(B.primary);
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#FFFFFF')
    .text('DESCRIPTION', 51, y + 9, { width: 224 })
    .text('QTY', 282, y + 9, { width: 34, align: 'right' })
    .text('RATE', 322, y + 9, { width: 70, align: 'right' })
    .text('VAT', 398, y + 9, { width: 38, align: 'right' })
    .text('AMOUNT', 442, y + 9, { width: 103, align: 'right' });
  return y + 34;
}

function lineHeight(doc: PDFKit.PDFDocument, description: string) {
  doc.font('Helvetica').fontSize(7.8);
  const height = doc.heightOfString(description, { width: 224, lineGap: 1 });
  return Math.max(25, Math.min(44, height + 12));
}

function drawLine(doc: PDFKit.PDFDocument, line: any, y: number, index: number) {
  const description = safeText(line.description);
  const height = lineHeight(doc, description);
  if (index % 2 === 0) doc.roundedRect(40, y - 4, 515, height, 4).fill('#F7FCFB');
  doc.font('Helvetica').fontSize(7.8).fillColor(B.ink)
    .text(description, 51, y + 3, { width: 224, height: height - 8, lineGap: 1, ellipsis: true })
    .text(String(line.qty), 282, y + 3, { width: 34, align: 'right' })
    .text(Number(line.unitPrice).toFixed(2), 322, y + 3, { width: 70, align: 'right' })
    .text(`${Number(line.vatPercent || 0).toFixed(0)}%`, 398, y + 3, { width: 38, align: 'right' })
    .text(Number(line.amount).toFixed(2), 442, y + 3, { width: 103, align: 'right' });
  return y + height;
}

async function readiness(invoice: any, business: any, loadLogo = true) {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!safeText(invoice.invoiceNumber)) issues.push('Invoice number is missing.');
  if (!safeText(invoice.customerSnapshot?.name)) issues.push('Customer name is missing. Open the customer record and add a name.');
  if (!Array.isArray(invoice.lines) || !invoice.lines.length) issues.push('The invoice has no line items.');
  (invoice.lines || []).forEach((line: any, index: number) => {
    if (!safeText(line.description) || !finite(line.qty) || Number(line.qty) <= 0 || !finite(line.unitPrice) || Number(line.unitPrice) < 0 || !finite(line.amount)) {
      issues.push(`Line item ${index + 1} contains invalid quantity, price or amount data.`);
    }
  });
  if (![invoice.subtotal, invoice.discount, invoice.vatAmount, invoice.total, invoice.paidAmount, invoice.balance].every(finite) || Number(invoice.total) < 0) {
    issues.push('Invoice totals are invalid. Recreate the invoice or correct its line items.');
  }
  const issueTime = new Date(invoice.issueDate).getTime();
  const dueTime = new Date(invoice.dueDate).getTime();
  if (!Number.isFinite(issueTime) || !Number.isFinite(dueTime)) issues.push('The invoice issue date or due date is invalid.');
  else if (dueTime < issueTime) issues.push('Due date is earlier than the invoice issue date.');
  if (!safeText(business.name || business.legalName)) warnings.push('Company display name is not set; the account holder name will be used.');
  let logo: Buffer | null = null;
  if (business.logoUrl && loadLogo) {
    logo = await pdfImageBuffer(business.logoUrl);
    if (!logo) warnings.push('Company logo could not be loaded. Re-upload it as a PNG or JPEG from Company Profile. The invoice can still be generated without the logo.');
  } else if (!business.logoUrl) warnings.push('No company logo is set. Add a PNG/JPEG logo in Company Profile for branded invoices.');
  return { ok: issues.length === 0, issues, warnings, logo };
}

function responseInvoice(invoice: any, ownerId: unknown) {
  if (!invoice) return invoice;
  const value = invoice.toObject?.() || invoice;
  const attachment = refreshedOwnedAttachment(value.attachment, ownerId);
  return { ...value, attachment };
}

export async function renderInvoicePdf(invoice: any, business: any, currency: string, logo: Buffer | null) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true, autoFirstPage: true });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    doc.once('error', reject);
    try {
      invoiceHeader(doc, invoice, business, logo, false);
      const left = 40;
      const right = 310;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('FROM', left, 134);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(B.ink).text(safeText(business.legalName || business.name || 'Business'), left, 149, { width: 225, height: 28, ellipsis: true });
      let senderY = Math.max(doc.y + 3, 178);
      for (const text of [business.address, business.phone, business.email, business.trn ? `TRN: ${business.trn}` : ''].filter(Boolean)) {
        doc.font('Helvetica').fontSize(7.3).fillColor(B.muted).text(safeText(text), left, senderY, { width: 225, height: 24, ellipsis: true });
        senderY = Math.min(250, doc.y + 2);
      }
      doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('BILL TO', right, 134);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(B.ink).text(safeText(invoice.customerSnapshot?.name || 'Customer'), right, 149, { width: 245, height: 28, ellipsis: true });
      let customerY = Math.max(doc.y + 3, 178);
      for (const text of [invoice.customerSnapshot?.address, invoice.customerSnapshot?.email, invoice.customerSnapshot?.phone, invoice.customerSnapshot?.trn ? `TRN: ${invoice.customerSnapshot.trn}` : ''].filter(Boolean)) {
        doc.font('Helvetica').fontSize(7.3).fillColor(B.muted).text(safeText(text), right, customerY, { width: 245, height: 24, ellipsis: true });
        customerY = Math.min(250, doc.y + 2);
      }
      const metaY = Math.min(267, Math.max(209, senderY + 8, customerY + 8));
      doc.roundedRect(40, metaY, 515, 49, 12).fill(B.soft);
      const meta = [['ISSUE DATE', formatDate(invoice.issueDate)], ['DUE DATE', formatDate(invoice.dueDate)], ['STATUS', invoice.status]];
      meta.forEach(([label, value], index) => {
        const x = 58 + index * 166;
        doc.font('Helvetica-Bold').fontSize(6.7).fillColor(B.muted).text(label, x, metaY + 10, { width: 130 });
        const tone = index === 2 ? invoice.status === 'PAID' ? B.success : invoice.status === 'PARTIAL' ? B.warning : B.danger : B.ink;
        doc.font('Helvetica-Bold').fontSize(9.2).fillColor(tone).text(safeText(value), x, metaY + 25, { width: 130 });
      });
      let rowY = drawTableHeader(doc, metaY + 65);
      let pageLineIndex = 0;
      for (const line of invoice.lines || []) {
        const height = lineHeight(doc, safeText(line.description));
        if (rowY + height > 555) {
          doc.addPage();
          invoiceHeader(doc, invoice, business, logo, true);
          rowY = drawTableHeader(doc, 136);
          pageLineIndex = 0;
        }
        rowY = drawLine(doc, line, rowY, pageLineIndex++);
      }
      const noteHeight = invoice.notes ? Math.min(70, doc.heightOfString(safeText(invoice.notes), { width: 270 })) : 0;
      const blockHeight = 155 + noteHeight;
      if (rowY + blockHeight > 755) {
        doc.addPage();
        invoiceHeader(doc, invoice, business, logo, true);
        rowY = 140;
      }
      const totalsY = Math.max(rowY + 11, 510);
      if (invoice.notes) {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('NOTES / TERMS', 40, totalsY + 3);
        doc.font('Helvetica').fontSize(7.5).fillColor(B.ink).text(safeText(invoice.notes), 40, totalsY + 17, { width: 270, lineGap: 2, height: 72, ellipsis: true });
      }
      const labelX = 350;
      const valueX = 447;
      const discountPercent = Number(invoice.discountPercent ?? (Number(invoice.subtotal) > 0 ? Number(invoice.discount || 0) / Number(invoice.subtotal) * 100 : 0));
      const rows: [string, unknown, string][] = [
        ['Subtotal', invoice.subtotal, B.ink],
        [`Discount (${discountPercent.toFixed(2).replace(/\.00$/, '')}%)`, invoice.discount, B.ink],
        ['VAT', invoice.vatAmount, B.ink]
      ];
      rows.forEach(([label, value, color], index) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(B.muted).text(label, labelX, totalsY + index * 19, { width: 88, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(color).text(money(value, currency), valueX, totalsY + index * 19, { width: 108, align: 'right' });
      });
      doc.moveTo(labelX, totalsY + 59).lineTo(555, totalsY + 59).strokeColor(B.line).stroke();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(B.ink).text('TOTAL', labelX, totalsY + 70, { width: 88, align: 'right' })
        .fontSize(11).fillColor(B.primary).text(money(invoice.total, currency), valueX, totalsY + 69, { width: 108, align: 'right' });
      doc.font('Helvetica').fontSize(7.5).fillColor(B.muted).text('Paid', labelX, totalsY + 92, { width: 88, align: 'right' })
        .font('Helvetica-Bold').fillColor(B.success).text(money(invoice.paidAmount, currency), valueX, totalsY + 92, { width: 108, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(8.3).fillColor(B.ink).text('BALANCE DUE', labelX, totalsY + 113, { width: 88, align: 'right' })
        .fillColor(Number(invoice.balance) > 0 ? B.danger : B.success).text(money(invoice.balance, currency), valueX, totalsY + 113, { width: 108, align: 'right' });
      let paymentY = totalsY + 142;
      if (invoice.payments?.length) {
        if (paymentY + Math.min(invoice.payments.length, 6) * 16 > 755) {
          doc.addPage();
          invoiceHeader(doc, invoice, business, logo, true);
          paymentY = 140;
        }
        doc.font('Helvetica-Bold').fontSize(7).fillColor(B.muted).text('PAYMENT HISTORY', 40, paymentY);
        paymentY += 14;
        for (const payment of invoice.payments) {
          if (paymentY > 755) {
            doc.addPage();
            invoiceHeader(doc, invoice, business, logo, true);
            paymentY = 140;
          }
          doc.font('Helvetica').fontSize(7.3).fillColor(B.ink).text(
            `${formatDate(payment.date)} • ${safeText(payment.method)}${payment.notes ? ` • ${safeText(payment.notes)}` : ''}`,
            40,
            paymentY,
            { width: 360, height: 13, ellipsis: true }
          );
          doc.font('Helvetica-Bold').fillColor(B.success).text(money(payment.amount, currency), 430, paymentY, { width: 125, align: 'right' });
          paymentY += 15;
        }
      }
      const range = doc.bufferedPageRange();
      for (let index = 0; index < range.count; index++) {
        doc.switchToPage(index);
        footer(doc, business, invoice.invoiceNumber);
      }
      doc.end();
    } catch (error) {
      try { doc.end(); } catch {}
      reject(error);
    }
  });
}

router.param('id', (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid invoice identifier.' });
  next();
});

router.get('/', async (req, res) => {
  const query: any = { userId: req.user._id };
  const status = String(req.query.status || '');
  if (status) {
    if (!['UNPAID', 'PARTIAL', 'PAID'].includes(status)) return res.status(400).json({ message: 'Invalid invoice status filter.' });
    query.status = status;
  }
  const invoices = await Invoice.find(query).sort({ issueDate: -1, createdAt: -1 }).lean();
  res.json(invoices.map(invoice => responseInvoice(invoice, req.user._id)));
});

router.get('/:id', async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.json(responseInvoice(invoice, req.user._id));
});

router.get('/:id/pdf-check', async (req, res) => {
  const invoice: any = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const rawBusiness = req.user.business?.toObject?.() || req.user.business || {};
  const check = await readiness(invoice, rawBusiness, false);
  return res.json({ ok: check.ok, issues: check.issues, warnings: check.warnings });
});

router.post('/', async (req, res) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invoice details are invalid', issues: parsed.error.flatten() });
  let attachment;
  if (parsed.data.attachment) {
    try {
      attachment = await normalizeOwnedAttachment(parsed.data.attachment, req.user._id, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    } catch (error: any) {
      return res.status(error?.status || 400).json({ message: error?.message || 'The invoice attachment is unavailable. Upload it again.', code: error?.code });
    }
  }
  const customer = await Party.findOne({ _id: parsed.data.customerId, userId: req.user._id, type: 'CUSTOMER' });
  if (!customer) return res.status(400).json({ message: 'The selected customer no longer exists. Choose or add a customer again.' });
  if (parsed.data.dueDate.getTime() < parsed.data.issueDate.getTime()) return res.status(400).json({ message: 'Due date cannot be earlier than the invoice issue date.' });
  const calculated = calculateInvoice(parsed.data.lines, parsed.data.discountPercent);
  if (calculated.subtotal <= 0 || calculated.total <= 0 || calculated.total > MAX_BOOK_VALUE) {
    return res.status(400).json({ message: 'Invoice value must be greater than zero and within the supported accounting range.' });
  }
  let openingPaidAmount = 0;
  if (parsed.data.openingStatus === 'PAID') openingPaidAmount = calculated.total;
  if (parsed.data.openingStatus === 'PARTIAL') {
    openingPaidAmount = roundMoney(parsed.data.openingPaidAmount);
    if (openingPaidAmount <= 0 || openingPaidAmount >= calculated.total) {
      return res.status(400).json({ message: 'Partial payment must be greater than zero and less than the invoice total.' });
    }
  }
  const paymentState = invoicePaymentState(calculated.total, openingPaidAmount);
  const payments = paymentState.paidAmount > 0 ? [{
    amount: paymentState.paidAmount,
    date: parsed.data.issueDate,
    method: parsed.data.openingPaymentMethod,
    notes: parsed.data.openingPaymentNotes || 'Opening payment'
  }] : [];
  const invoice = await Invoice.create({
    userId: req.user._id,
    invoiceNumber: await nextNumber(req.user._id),
    customerId: customer._id,
    customerSnapshot: { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address, trn: customer.trn },
    issueDate: parsed.data.issueDate,
    dueDate: parsed.data.dueDate,
    lines: calculated.mapped,
    subtotal: calculated.subtotal,
    discount: calculated.discountAmount,
    discountPercent: calculated.discountPercent,
    vatAmount: calculated.vatAmount,
    total: calculated.total,
    ...paymentState,
    payments,
    notes: parsed.data.notes,
    attachment
  });
  res.status(201).json(responseInvoice(invoice, req.user._id));
});

router.post('/:id/payments', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid positive payment amount and payment method.', issues: parsed.error.flatten() });
  const amount = roundMoney(parsed.data.amount);
  if (amount <= 0) return res.status(400).json({ message: 'Payment must be at least 0.01.' });
  const now = new Date();
  const payment = {
    _id: new mongoose.Types.ObjectId(),
    amount,
    date: parsed.data.date,
    method: parsed.data.method,
    notes: parsed.data.notes,
    createdAt: now,
    updatedAt: now
  };
  const paidExpression: any = { $round: [{ $add: [{ $ifNull: ['$paidAmount', 0] }, amount] }, 2] };
  const balanceExpression: any = { $max: [0, { $round: [{ $subtract: ['$total', paidExpression] }, 2] }] };
  const invoice: any = await Invoice.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, balance: { $gte: amount - 0.001 } },
    [
      { $set: {
        payments: { $concatArrays: [{ $ifNull: ['$payments', []] }, [payment]] },
        paidAmount: paidExpression,
        balance: balanceExpression,
        updatedAt: now
      } },
      { $set: { status: { $cond: [{ $lte: ['$balance', 0.001] }, 'PAID', 'PARTIAL'] } } }
    ],
    { new: true }
  );
  if (!invoice) {
    const current: any = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!current) return res.status(404).json({ message: 'Invoice not found' });
    const remaining = roundMoney(current.balance);
    if (remaining <= 0) return res.status(400).json({ message: 'This invoice is already fully paid.' });
    return res.status(400).json({ message: `Payment exceeds the outstanding balance of ${remaining.toFixed(2)}.` });
  }
  res.json(responseInvoice(invoice, req.user._id));
});

router.delete('/:id', async (req, res) => {
  const invoice: any = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const attachment = invoice.attachment?.toObject?.() || invoice.attachment;
  if (attachment) removeOwnedStoredFileIfUnreferenced(attachment, req.user._id).catch(error => console.warn('Invoice attachment cleanup failed:', error?.message || error));
  res.json({ ok: true, id: String(invoice._id), invoiceNumber: invoice.invoiceNumber });
});

router.get('/:id/pdf', async (req, res) => {
  const invoice: any = await Invoice.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const rawBusiness = req.user.business?.toObject?.() || req.user.business || {};
  const check = await readiness(invoice, rawBusiness);
  const business = { ...rawBusiness, name: rawBusiness.name || rawBusiness.legalName || req.user.name };
  if (!check.ok) return res.status(422).json({ message: 'Invoice PDF cannot be generated yet.', code: 'INVOICE_PDF_NOT_READY', issues: check.issues, warnings: check.warnings });
  try {
    const buffer = await renderInvoicePdf(invoice, business, business.currency || 'AED', check.logo);
    return sendDownload(res, buffer, 'application/pdf', `${safeText(invoice.invoiceNumber) || 'Invoice'}.pdf`);
  } catch (error: any) {
    console.error('Invoice PDF generation failed', error);
    return res.status(500).json({
      message: 'Invoice PDF generation failed.',
      code: 'INVOICE_PDF_GENERATION_FAILED',
      reason: error?.message || 'The PDF renderer could not complete this document.',
      suggestion: 'Check the company logo is PNG/JPEG and try again. If the problem continues, open the invoice and verify its customer and line-item data.'
    });
  }
});

export default router;
