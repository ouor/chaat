import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Exports live in the app cache only until the next export (each export wipes the folder), so a
// shared chat log doesn't linger on the device after it has been handed to another app.
const EXPORT_DIR = 'exports';

/** Characters Android/Windows file names can't hold. */
const UNSAFE_NAME = /[\\/:*?"<>|\u0000-\u001f]+/g;

function safeFileName(name: string): string {
  return name.replace(UNSAFE_NAME, '_').trim().slice(0, 80) || 'chaat';
}

/**
 * Writes `chunks` to a fresh cache file `<baseName>.<ext>` in order (appending, so the whole text
 * is never one string) and returns its file URI.
 */
export async function writeExportFile(baseName: string, ext: string, chunks: AsyncIterable<string>): Promise<string> {
  // Not create({ overwrite: true }): on Android it deletes with java.io.File.delete(), which
  // can't remove a non-empty folder, so every export after the first failed ("directory already
  // exists"). Directory.delete() removes the folder with the previous export in it.
  clearExports();
  const dir = new Directory(Paths.cache, EXPORT_DIR);
  dir.create({ intermediates: true });
  const file = new File(dir, `${safeFileName(baseName)}.${ext}`);
  file.create();
  for await (const chunk of chunks) file.write(chunk, { append: true });
  return file.uri;
}

/** Deletes the last export (it holds strangers' nicknames and chat; kept only until replaced). */
export function clearExports(): void {
  const dir = new Directory(Paths.cache, EXPORT_DIR);
  if (dir.exists) dir.delete();
}

/** Opens the system share sheet (save to Files/Drive, send to a messenger, ...). */
export async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}
