import assert from 'node:assert/strict';
import {
  formatInvoiceNumber,
  invoiceSequence,
  isInvoiceNumberConflict,
  lowestAvailableInvoiceSequence
} from '../services/invoice-number.js';

assert.equal(lowestAvailableInvoiceSequence([]), 1);
assert.equal(lowestAvailableInvoiceSequence(['INV-00001']), 2);
assert.equal(lowestAvailableInvoiceSequence(['INV-00001', 'INV-00003']), 2);
assert.equal(lowestAvailableInvoiceSequence(['INV-00003', 'INV-00001', 'INV-00002']), 4);
assert.equal(lowestAvailableInvoiceSequence(['legacy', 'INV-00000', 'INV-00001']), 2);
assert.equal(lowestAvailableInvoiceSequence(['INV-100000', 'INV-00001']), 2);

assert.equal(invoiceSequence('INV-00002'), 2);
assert.equal(invoiceSequence('INV-100000'), 100000);
assert.equal(invoiceSequence('invoice-2'), null);
assert.equal(formatInvoiceNumber(2), 'INV-00002');
assert.equal(formatInvoiceNumber(100000), 'INV-100000');
assert.throws(() => formatInvoiceNumber(0));

assert.equal(isInvoiceNumberConflict({ code: 11000, keyPattern: { userId: 1, invoiceNumber: 1 } }), true);
assert.equal(isInvoiceNumberConflict({ code: 11000, keyPattern: { anotherField: 1 } }), false);
assert.equal(isInvoiceNumberConflict(new Error('ordinary failure')), false);

console.log('PASS invoice numbering reuses the lowest available per-user sequence.');
