const HAS_EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Construye una ruta interna bajo la base del sitio (GitHub Pages de proyecto o dominio propio).
 * Las rutas de página terminan en `/` (coherente con `trailingSlash: 'always'`);
 * los archivos con extensión y los fragmentos/consultas se respetan.
 */
export function withBase(path = '', base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const [pathname = '', suffix = ''] = splitSuffix(path.replace(/^\/+/, ''));
  if (pathname === '') return `${normalizedBase}${suffix}`;
  const needsSlash = !pathname.endsWith('/') && !HAS_EXTENSION.test(pathname);
  return `${normalizedBase}${pathname}${needsSlash ? '/' : ''}${suffix}`;
}

function splitSuffix(path: string): [string, string] {
  const index = path.search(/[?#]/);
  return index === -1 ? [path, ''] : [path.slice(0, index), path.slice(index)];
}
