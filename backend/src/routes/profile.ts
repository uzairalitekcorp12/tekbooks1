import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  normalizeOwnedAssetUrl,
  refreshedOwnedStorageUrl,
  sameStoredFile
} from '../services/storage.js';
import { removeOwnedStoredFileIfUnreferenced } from '../services/storage-records.js';

const r = Router();
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

r.use(requireAuth);

function responseAssetUrl(value: unknown, ownerId: unknown) {
  const refreshed = refreshedOwnedStorageUrl(value, ownerId);
  if (refreshed) return refreshed;
  // Preserve a pre-storage external URL already present in a legacy database.
  const legacy = String(value || '');
  return /^https:\/\//i.test(legacy) ? legacy : '';
}

function profileResponse(user: any) {
  const business = user.business?.toObject?.() || user.business || {};
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    profilePictureUrl: responseAssetUrl(user.profilePictureUrl, user._id),
    business: { ...business, logoUrl: responseAssetUrl(business.logoUrl, user._id) },
    deviceLabel: user.deviceLabel
  };
}

r.get('/', (req, res) => res.json(profileResponse(req.user)));

r.put('/', async (req, res) => {
  const p = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    profilePictureUrl: z.string().max(3000).optional(),
    expoPushToken: z.string().max(500).optional(),
    business: z.object({
      name: z.string().max(120).optional(),
      legalName: z.string().max(160).optional(),
      logoUrl: z.string().max(3000).optional(),
      trn: z.string().max(50).optional(),
      vatPercent: z.coerce.number().min(0).max(100).optional(),
      email: z.string().email().or(z.literal('')).optional(),
      phone: z.string().max(40).optional(),
      address: z.string().max(500).optional(),
      currency: z.string().max(5).optional()
    }).optional()
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Profile details are invalid.', issues: p.error.flatten() });

  const previousProfile = String(req.user.profilePictureUrl || '');
  const previousLogo = String(req.user.business?.logoUrl || '');
  let nextProfile = previousProfile;
  let nextLogo = previousLogo;

  if (p.data.profilePictureUrl !== undefined) {
    const requested = p.data.profilePictureUrl;
    if (!requested) nextProfile = '';
    else if (requested === previousProfile && /^https:\/\//i.test(requested) && !refreshedOwnedStorageUrl(requested, req.user._id)) nextProfile = previousProfile;
    else nextProfile = await normalizeOwnedAssetUrl(requested, req.user._id, imageTypes);
  }
  if (p.data.business?.logoUrl !== undefined) {
    const requested = p.data.business.logoUrl;
    if (!requested) nextLogo = '';
    else if (requested === previousLogo && /^https:\/\//i.test(requested) && !refreshedOwnedStorageUrl(requested, req.user._id)) nextLogo = previousLogo;
    else nextLogo = await normalizeOwnedAssetUrl(requested, req.user._id, imageTypes);
  }

  if (p.data.name !== undefined) req.user.name = p.data.name;
  if (p.data.profilePictureUrl !== undefined) req.user.profilePictureUrl = nextProfile;
  if (p.data.expoPushToken !== undefined) req.user.expoPushToken = p.data.expoPushToken;
  if (p.data.business) {
    const business = { ...req.user.business?.toObject?.(), ...p.data.business, logoUrl: nextLogo };
    req.user.business = business;
  }
  await req.user.save();

  const cleanup: Promise<any>[] = [];
  if (previousProfile && !sameStoredFile(previousProfile, nextProfile)) {
    cleanup.push(removeOwnedStoredFileIfUnreferenced(previousProfile, req.user._id));
  }
  if (previousLogo && !sameStoredFile(previousLogo, nextLogo)) {
    cleanup.push(removeOwnedStoredFileIfUnreferenced(previousLogo, req.user._id));
  }
  const cleanupResults = await Promise.allSettled(cleanup);
  for (const result of cleanupResults) {
    if (result.status === 'rejected') console.warn('Replaced profile asset cleanup failed:', result.reason?.message || result.reason);
  }

  res.json(profileResponse(req.user));
});

export default r;
