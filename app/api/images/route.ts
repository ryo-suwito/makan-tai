import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Lists uploaded and generated images stored in the `/public` folder.
 * Uploads should be stored in `public/uploads` and generated images in `public/generated`.
 */
export async function GET() {
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const generatedDir = join(process.cwd(), 'public', 'generated');
  const listDir = async (dir: string) => {
    try {
      const files = await readdir(dir);
      return files.map((f) => `/` + dir.split('public/')[1] + '/' + f);
    } catch {
      return [] as string[];
    }
  };
  const uploads = await listDir(uploadsDir);
  const generated = await listDir(generatedDir);
  return NextResponse.json({ uploads, generated });
}