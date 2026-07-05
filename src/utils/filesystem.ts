import { mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function safeMove(
  source: string,
  targetDir: string,
  dryRun: boolean,
): string | null {
  const target = join(targetDir, basename(source));

  if (source === target) return null;

  if (!dryRun) {
    ensureDir(targetDir);

    if (existsSync(target)) {
      const extIndex = target.lastIndexOf('.');
      const base = extIndex > 0 ? target.slice(0, extIndex) : target;
      const ext = extIndex > 0 ? target.slice(extIndex) : '';
      const renamed = `${base}-${Date.now()}${ext}`;
      renameSync(source, renamed);
      return renamed;
    }

    renameSync(source, target);
    return target;
  }

  return target;
}
