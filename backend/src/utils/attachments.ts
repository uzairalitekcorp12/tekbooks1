import { z } from 'zod';

const attachmentMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export const attachmentInputSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  url: z.string().trim().min(1).max(4096).optional(),
  key: z.string().trim().min(1).max(1024).optional(),
  mimeType: z.enum(attachmentMimeTypes).optional(),
  size: z.coerce.number().int().nonnegative().optional()
}).refine(value => Boolean(value.key || value.url), {
  message: 'The uploaded attachment is missing its storage reference.'
});
