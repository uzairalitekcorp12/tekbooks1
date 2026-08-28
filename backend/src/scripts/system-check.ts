import mongoose from 'mongoose';
import { connectDb, databaseConnectionMessage } from '../config/db.js';
import { env } from '../config/env.js';
import { renderInvoicePdf } from '../routes/invoices.js';
import { sendSystemTestEmail } from '../services/email.js';
import { ensureStorageReady, readStoredFile, removeStoredFile, storeFile } from '../services/storage.js';

function emailArgument() {
  const inline = process.argv.find(value => value.startsWith('--email='));
  if (inline) return inline.slice('--email='.length).trim();
  const index = process.argv.indexOf('--email');
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
}

let storedKey = '';
try {
  const invoice = {
    invoiceNumber: 'SETUP-CHECK',
    customerSnapshot: { name: 'Setup Test Customer' },
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2026-01-31T00:00:00Z'),
    status: 'UNPAID',
    lines: [{ description: 'System check', qty: 1, unitPrice: 100, vatPercent: 5, amount: 100 }],
    subtotal: 100,
    discount: 0,
    discountPercent: 0,
    vatAmount: 5,
    total: 105,
    paidAmount: 0,
    balance: 105,
    payments: []
  };
  const pdf = await renderInvoicePdf(invoice, { name: 'TekBooks Setup Test' }, 'AED', null);
  if (pdf.length < 1000 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invoice PDF output is invalid.');
  console.log(`PASS Invoice PDF generation (${pdf.length} bytes)`);

  await connectDb();
  await mongoose.connection.db?.admin().ping();
  console.log(`PASS MongoDB (${env.MONGODB_DB_NAME})`);

  const storage = await ensureStorageReady(false);
  console.log(`PASS Storage connection (${storage.driver})`);

  // A real private storage Put/Get/Delete round trip using a valid tiny PNG.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const saved = await storeFile({
    buffer: png,
    originalname: 'tekbooks-system-check.png'
  } as Express.Multer.File, 'system-check');
  storedKey = saved.key;
  const loaded = await readStoredFile(saved.key);
  if (!loaded?.buffer.equals(png)) throw new Error('Storage round-trip content did not match.');
  await removeStoredFile(saved.key);
  storedKey = '';
  console.log('PASS Storage upload/read/delete round trip');

  const email = emailArgument();
  if (email) {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('The --email value is invalid.');
    const result = await sendSystemTestEmail(email);
    console.log(`PASS Resend accepted test email for ${email} (${result?.id || 'accepted'})`);
  } else {
    console.warn('SKIP Resend delivery test (add --email=you@example.com to send one test message)');
  }

  console.log('System check passed.');
} catch (error: any) {
  if (storedKey) await removeStoredFile(storedKey).catch(() => false);
  const message = /mongo|mongoose/i.test(String(error?.name || ''))
    ? databaseConnectionMessage(error)
    : String(error?.message || error);
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
