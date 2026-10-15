import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// White horizontal logo as a data URL, for ImageResponse cards on the navy background.
// Source is 823x194, so width = height * 4.24.
export const LOGO_WHITE_RATIO = 823 / 194;

export async function logoWhiteDataUrl(): Promise<string> {
  const file = await readFile(join(process.cwd(), 'public/brand/logo-horizontal-white.png'));
  return `data:image/png;base64,${file.toString('base64')}`;
}
