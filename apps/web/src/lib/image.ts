export type UploadType = 'image/png' | 'image/jpeg' | 'application/pdf';

export class FileProblem extends Error {
  constructor(
    message: string,
    public hint?: string
  ) {
    super(message);
  }
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 2200;

/** Validates a chosen file and shrinks large photos so uploads are quick and always under the 8 MB limit. */
export async function prepareUpload(file: File): Promise<{ blob: Blob; contentType: UploadType }> {
  const t = file.type;
  if (t === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new FileProblem('That PDF is larger than 8 MB.', 'Use a one-page PDF or a photo instead.');
    return { blob: file, contentType: 'application/pdf' };
  }
  if (t !== 'image/png' && t !== 'image/jpeg') {
    throw new FileProblem(
      t === 'image/heic' || t === 'image/heif' ? 'HEIC photos are not supported yet.' : 'Use a JPG or PNG photo, or a one-page PDF.',
      t.startsWith('image/hei') ? 'On iPhone, choose Most Compatible in Camera settings, or share the photo as JPG.' : undefined
    );
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // If the browser cannot decode it, let the server decide for small files.
    if (file.size <= MAX_BYTES) return { blob: file, contentType: t };
    throw new FileProblem('We could not open that photo.', 'Try a different photo.');
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_EDGE && file.size <= 3 * 1024 * 1024) {
    bitmap.close();
    return { blob: file, contentType: t };
  }
  const scale = Math.min(1, MAX_EDGE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    if (file.size <= MAX_BYTES) return { blob: file, contentType: t };
    throw new FileProblem('That photo is too large.', 'Try a smaller photo.');
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
  if (!blob || blob.size > MAX_BYTES) throw new FileProblem('That photo is too large.', 'Try a smaller photo.');
  return { blob, contentType: 'image/jpeg' };
}
