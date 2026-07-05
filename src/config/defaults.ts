export const DEFAULTS = {
  docsDir: './docs',
  threshold: 55,
  dryRun: true,
  verbose: false,
  json: false,
};

export function resolveDocsDir(dir: string | undefined): string {
  return dir ?? DEFAULTS.docsDir;
}

export function resolveThreshold(threshold: number | undefined): number {
  const t = threshold ?? DEFAULTS.threshold;
  if (t < 0 || t > 100) return DEFAULTS.threshold;
  return t;
}
