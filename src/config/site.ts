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
  /** Texto corto de la barra superior del header (datos reales); `null` = sin barra. */
  announcement: string | null;
  orderTracking: {
    /**
     * URL del Apps Script (`apps-script/pedidos.gs`) que guarda en la pestaña "Pedidos" una
     * consulta por cada clic en "Pedir por WhatsApp". `null` = no se registra nada.
     */
    endpoint: string | null;
  };
}

export const siteConfig: SiteConfig = {
  businessName: 'Alova',
  tagline: 'Desayunos y regalos sorpresa para cada ocasión',
  description:
    'Desayunos sorpresa para hombre, mujer, niño y adulto mayor en Bogotá (Sabana norte). Pide por WhatsApp.',
  city: 'Bogotá (Sabana norte)',
  whatsApp: '+57 312 506 5058',
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
  announcement: 'Entregas en Bogotá (Sabana norte) · Pedidos por WhatsApp',
  orderTracking: {
    endpoint:
      'https://script.google.com/macros/s/AKfycbx9tnyEmy2Wz6xanPm1kZ-EdpTSnTw7VIHfwoudHn_v-TjgyIr20Z24Je63KX710XX9/exec',
  },
};

/** Nombre a mostrar mientras el negocio no esté configurado. */
export const displayName = siteConfig.businessName ?? 'Desayunos sorpresa';
