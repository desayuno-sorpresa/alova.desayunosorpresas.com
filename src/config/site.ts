export interface NavItem {
  label: string;
  /** Ruta interna relativa a la base (se resuelve con `withBase`). */
  path: string;
}

/**
 * Datos propios del negocio. Al crear el repo de un negocio desde la plantilla, se completan
 * aquí. Los `null` son datos pendientes: bloquean el despliegue (`pnpm check:release`).
 */
export interface SiteConfig {
  /** Nombre comercial, p. ej. "Alova". */
  businessName: string | null;
  /** Frase corta bajo el nombre en el inicio (sin promesas de resultados). */
  tagline: string | null;
  /** Descripción para buscadores y redes (≤ 160 caracteres). */
  description: string | null;
  /** Ciudad o zona principal, visible en la página. */
  city: string | null;
  /** WhatsApp que recibe los pedidos, formato internacional (+57 …). */
  whatsApp: string | null;
  /** Perfil de Instagram (enlace https), opcional. */
  instagramUrl: string | null;
  lang: string;
  ogLocale: string;
  /** Directorio que agrupa a los negocios suscritos. */
  directory: { name: string; url: string };
  nav: readonly NavItem[];
}

export const siteConfig: SiteConfig = {
  businessName: null,
  tagline: null,
  description: null,
  city: null,
  whatsApp: null,
  instagramUrl: null,
  lang: 'es-CO',
  ogLocale: 'es_CO',
  directory: { name: 'Desayunos Sorpresa', url: 'https://desayunosorpresas.com/negocios/' },
  nav: [
    { label: 'Inicio', path: '' },
    { label: 'Catálogo', path: 'catalogo/' },
    { label: 'Entregas', path: 'entregas/' },
    { label: 'Nosotros', path: 'nosotros/' },
    { label: 'Preguntas', path: 'preguntas/' },
  ],
};

/** Nombre a mostrar mientras el negocio no esté configurado. */
export const displayName = siteConfig.businessName ?? 'Desayunos sorpresa';
