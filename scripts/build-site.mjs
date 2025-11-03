import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(rootDir, 'site/out');
const publicDir = join(rootDir, 'public');
const distDir = join(rootDir, 'dist');
const monacoEsmDir = join(rootDir, 'node_modules/monaco-editor/esm');
const docsDir = join(rootDir, 'docs');

async function ensureDirectoryExists(path, label) {
  try {
    const stats = await stat(path);
    if (!stats.isDirectory()) {
      throw new Error(`${label} is not a directory: ${path}`);
    }
  } catch (error) {
    throw new Error(`${label} directory is missing: ${path}. ${(error instanceof Error && error.message) || String(error)}`);
  }
}

async function safeCopy(source, destination, label) {
  await ensureDirectoryExists(source, label);
  await cp(source, destination, { recursive: true });
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function buildSite() {
  const hasDist = await pathExists(distDir);
  if (!hasDist) {
    throw new Error('Missing dist output. Run "npm run build" before building the static site.');
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await safeCopy(publicDir, outDir, 'public assets');
  await safeCopy(distDir, join(outDir, 'dist'), 'compiled TypeScript output');
  await safeCopy(monacoEsmDir, join(outDir, 'monaco-editor/esm'), 'Monaco ESM bundle');

  if (await pathExists(docsDir)) {
    await safeCopy(docsDir, join(outDir, 'docs'), 'docs');
  }

  console.log(`Static site ready at ${outDir}`);
}

buildSite().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
