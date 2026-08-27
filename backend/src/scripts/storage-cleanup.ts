import { connectDb } from '../config/db.js';
import { mongoose } from '../models/index.js';
import { isStoredFileReferenced } from '../services/storage-records.js';
import { ensureStorageReady, listStoredFiles, removeStoredFile, storageOwnerId } from '../services/storage.js';

const remove = process.argv.includes('--delete');
const hoursArgument = process.argv.find(value => value.startsWith('--older-than-hours='));
const olderThanHours = hoursArgument ? Number(hoursArgument.split('=')[1]) : 24;
if (!Number.isFinite(olderThanHours) || olderThanHours < 1) {
  console.error('--older-than-hours must be a number of at least 1.');
  process.exit(1);
}

try {
  await connectDb();
  await ensureStorageReady(false);
  const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
  const files = await listStoredFiles();
  let referenced = 0;
  let recent = 0;
  let orphaned = 0;
  let removed = 0;

  for (const file of files) {
    const ownerId = storageOwnerId(file.key);
    if (!ownerId) continue;
    if (!file.modifiedAt || file.modifiedAt.getTime() > cutoff) {
      recent += 1;
      continue;
    }
    if (await isStoredFileReferenced(file.key, ownerId)) {
      referenced += 1;
      continue;
    }
    orphaned += 1;
    console.log(`${remove ? 'Removing' : 'Would remove'} orphan: ${file.key}`);
    if (remove && await removeStoredFile(file.key)) removed += 1;
  }

  console.log({ mode: remove ? 'delete' : 'dry-run', scanned: files.length, referenced, recent, orphaned, removed });
  if (!remove) console.log('Dry run only. Add --delete to remove the listed objects.');
} catch (error: any) {
  console.error('Storage cleanup failed:', error?.message || error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
