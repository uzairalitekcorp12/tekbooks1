import { Invoice, Transaction, User } from '../models/index.js';
import {
  isOwnedStorageKey,
  removeStoredFile,
  storedKey
} from './storage.js';

/** Check every persisted place that can own an uploaded object. */
export async function isStoredFileReferenced(value: unknown, ownerId: unknown) {
  const key = storedKey(value);
  if (!key || !isOwnedStorageKey(key, ownerId)) return false;
  const [user, transaction, invoice] = await Promise.all([
    User.findById(ownerId).select('profilePictureUrl business.logoUrl').lean(),
    Transaction.exists({ userId: ownerId, 'attachment.key': key }),
    Invoice.exists({ userId: ownerId, 'attachment.key': key })
  ]);
  if (transaction || invoice) return true;
  if (storedKey((user as any)?.profilePictureUrl) === key || storedKey((user as any)?.business?.logoUrl) === key) return true;

  // Legacy records may have only a URL. This slower path runs only during deletion/cleanup.
  const [legacyTransactions, legacyInvoices] = await Promise.all([
    Transaction.find({ userId: ownerId, 'attachment.url': { $exists: true } }).select('attachment.url').lean(),
    Invoice.find({ userId: ownerId, 'attachment.url': { $exists: true } }).select('attachment.url').lean()
  ]);
  return [...legacyTransactions, ...legacyInvoices].some((record: any) => storedKey(record.attachment?.url) === key);
}

/** Delete only a workspace-owned object that is no longer referenced by any record. */
export async function removeOwnedStoredFileIfUnreferenced(value: unknown, ownerId: unknown) {
  if (!isOwnedStorageKey(value, ownerId)) return { removed: false, referenced: false, owned: false };
  if (await isStoredFileReferenced(value, ownerId)) return { removed: false, referenced: true, owned: true };
  return { removed: await removeStoredFile(value), referenced: false, owned: true };
}
