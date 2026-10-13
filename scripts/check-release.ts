// Bloquea el despliegue mientras haya datos pendientes o textos provisionales.
import { siteConfig } from '../src/config/site.ts';
import { findReleaseBlockers } from '../src/lib/release-check.ts';

const blockers = findReleaseBlockers(siteConfig);

if (blockers.length > 0) {
  console.error('No se puede publicar todavía:');
  for (const blocker of blockers) console.error(`  - ${blocker}`);
  process.exit(1);
}

console.log('Configuración lista para publicar.');
