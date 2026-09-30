export type BrandImageKind = 'profile' | 'logo';

export const profileImageRequirements = 'Square: 600×600 to 1000×1000 px, or 1024×1024 px';
export const logoImageRequirements = 'Square: 600×600 to 1000×1000 px or 1024×1024 px. Landscape: 600–2048 px wide, 300–1000 px high, up to 4:1';

export function imageDimensionError(kind: BrandImageKind, width: number, height: number) {
  const requirements = kind === 'profile' ? profileImageRequirements : logoImageRequirements;
  const label = kind === 'profile' ? 'Profile photo' : 'Company logo';
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    return `${label} dimensions could not be read. Choose a valid image. ${requirements}.`;
  const actual = `${width}×${height} px`;
  const square = width === height;
  const allowedSquare = square && ((width >= 600 && width <= 1000) || width === 1024);
  const allowedLandscape = kind === 'logo' && width > height && width >= 600 && width <= 2048 && height >= 300 && height <= 1000 && width / height <= 4;
  if (allowedSquare || allowedLandscape) return null;
  const reason = width < 600 || height < (kind === 'logo' && width > height ? 300 : 600) ? 'too small' :
    width > (kind === 'logo' ? 2048 : 1024) || height > 1024 ? 'too large' :
    kind === 'profile' && !square ? 'not square' :
    kind === 'logo' && width < height ? 'portrait shaped' :
    kind === 'logo' && width / height > 4 ? 'too wide' :
    'outside the allowed dimensions';
  return `${label} is ${reason} (${actual}). ${requirements}.`;
}

export function imageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString('ascii', 12, 16) === 'IHDR')
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };

  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a)
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L' && buffer[20] === 0x2f)
      return { width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8), height: 1 + (buffer[22] >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10) };
  }

  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}
