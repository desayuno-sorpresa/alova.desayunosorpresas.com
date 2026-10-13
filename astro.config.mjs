// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

/*
 * Cada negocio publica en su propio dominio o subdominio. `site` y `base` llegan por entorno;
 * en GitHub Actions los rellena `actions/configure-pages` (origin y base_path).
 * - SITE_URL: p. ej. https://alova.desayunosorpresas.com (vacío = sin canonical ni sitemap)
 * - BASE_PATH: '/' con dominio propio; '/<repo>' si se publica en <cuenta>.github.io/<repo>.
 */
// configure-pages puede devolver http:// si HTTPS aún no estaba activado: el sitio publicado
// siempre se sirve por HTTPS, así que canonical, Open Graph y sitemap usan https://.
const site = process.env.SITE_URL?.replace(/^http:\/\//, 'https://') || undefined;
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  output: 'static',
  ...(site ? { site, integrations: [sitemap()] } : {}),
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
    },
  },
});
