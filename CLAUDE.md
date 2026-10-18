# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Este repositorio: Alova

Sitio de **Alova** (`https://alova.desayunosorpresas.com`), creado desde la plantilla `desayuno-sorpresa/template_negocios`. Aquí solo se cambian los datos y colores de Alova (`src/config/site.ts`, `src/styles/theme.css`); las mejoras generales se hacen en la plantilla y se traen a este repo.

Pendiente (no inventar): eslogan, descripción, ciudad/zona, WhatsApp de pedidos, Instagram, hoja de Google (`SPREADSHEET_ID`) y secreto `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Qué es la plantilla

**Plantilla** para la página web de cada negocio de desayunos sorpresa suscrito a desayunosorpresas.com (p. ej. `alova.desayunosorpresas.com`). En GitHub es un *template repository* de la cuenta `desayuno-sorpresa`: cada negocio tiene **su propio repositorio creado desde esta plantilla**, con su configuración y **su propia hoja de Google**.

- Cambios que sirven a todos los negocios (componentes, sync, pruebas, accesibilidad) se hacen **aquí** y se llevan a cada repo de negocio.
- Cambios propios de un negocio (nombre, WhatsApp, colores, dominio) se hacen **solo en su repo**, en `src/config/site.ts` y `src/styles/theme.css`.
- Los repos de negocio viven en la **misma cuenta** `desayuno-sorpresa`: el dominio `desayunosorpresas.com` está verificado allí y GitHub bloquea sus subdominios desde otras cuentas.

## Datos por negocio (no inventar)

Todo lo propio de un negocio está en `src/config/site.ts` (`siteConfig`). Valores `null` = pendientes: `pnpm check:release` falla y **bloquea el despliegue** hasta completarlos. Nunca inventar número de WhatsApp, ciudad, eslogan, precios, zonas ni reseñas: si faltan, preguntar.

## Contenido desde Google Sheets

El negocio edita su hoja; `pnpm sync:content` (workflow `sync-content.yml`, diario 6:00 Colombia y manual) la convierte en colecciones de `src/content/` y escribe la revisión en la propia hoja. **No editar `src/content/` a mano.**

| Pestaña | Colección | Página | Obligatoria |
|---|---|---|---|
| `Productos` | `productos` (con imagen) | `/catalogo/` + destacados en el inicio | Sí |
| `Zonas` | `zonas` | `/entregas/` | No (aviso si falta) |
| `Preguntas` | `preguntas` | `/preguntas/` (JSON-LD FAQPage) | No |
| `Nosotros` | `nosotros` (imagen opcional) | `/nosotros/` | No |
| `Pedidos` | `pedidos` | Aviso de pedidos (abajo a la izquierda, todas las páginas) | No (sin aviso si falta) |

- `Pedidos`: el negocio anota **pedidos reales** (columnas `Fecha`, `Producto`, `Ciudad` opcional, `Estado`; puede tener más columnas, p. ej. el cliente, que nunca se leen). Se publican solo fecha, producto y ciudad de las filas "Publicado" de los últimos 14 días (máx. 20). Sus problemas son **avisos** (se omite la fila) y nunca bloquean el catálogo. El aviso es anónimo ("Alguien de Chía pidió «…» · Hoy"), calcula hoy/ayer en el navegador con la hora de Colombia, sale una vez por visita, se pausa con puntero/foco y se cierra para la sesión. Columna opcional `Tipo` (`Pedido` por defecto, o `Consulta`). **Consultas automáticas** (opcional): si `siteConfig.orderTracking.endpoint` tiene la URL del Apps Script (`apps-script/pedidos.gs`, desplegado por el dueño como aplicación web), cada clic en "Pedir por WhatsApp" guarda una fila `Consulta` con solo el producto (`fetch` `no-cors` + `keepalive`, con un freno de 10 s por producto contra dobles clics y sin memoria entre visitas; la CSP abre `script.google.com`/`script.googleusercontent.com` solo en ese caso). Como el endpoint es público, el sync solo publica una consulta si su producto coincide con uno del catálogo (sin tildes ni mayúsculas) y como mucho una por producto y día; el aviso dice "Alguien consultó por «…»", **nunca "pidió"**: un clic no prueba una venta. El dueño retira una poniendo `Estado` = Borrador. **Aviso en vivo, sin esperar al sync**: la misma URL responde `doGet` con la lista reciente en JSON (solo fecha, producto, ciudad y tipo de las filas "Publicado" de los últimos 14 días, con las mismas reglas: consultas solo de productos publicados en `Productos`, una por producto y día, con el nombre del catálogo; caché de 1 min); el aviso (`RecentOrdersToast`) la pide al abrir cada página, valida cada campo y arma el texto con `textContent`, y si falla o tarda más de 6 s usa la lista del último sync como respaldo. Un cambio de `Estado` en la hoja se nota en ~1 minuto.

- Cada pestaña lleva además las columnas **"Errores a corregir"** y **"Detalle error"**, que el sync rellena (✅ / ⚠️ errores que bloquean / 🟡 avisos que no bloquean / notas de borrador). Nunca se leen como datos.
- Solo se publican filas en estado "Publicado" (los repos son públicos).
- Hoja sin errores + `build` válido → PR `sync/contenido` con merge automático y `deploy.yml` lanzado por `workflow_dispatch`. Con errores → no publica y abre un issue (`revision-contenido`) que se cierra solo al corregir.
- Revisión de contenido automática (`src/lib/content-sync/content-review.ts`): promesas de resultados, texto de relleno, descripciones de foto que repiten título/resumen, fotos repetidas, mayúsculas, marcas mal escritas. Cuenta como error.
- Configuración por repo de negocio: variable `SPREADSHEET_ID` (Settings → Variables) y secreto `GOOGLE_SERVICE_ACCOUNT_JSON`. La cuenta de servicio es **Editor de la hoja** y **Lector de la carpeta de fotos**. Sin `SPREADSHEET_ID`, el sync no hace nada.
- Para añadir una colección: lector puro en `src/lib/content-sync/<colección>.ts` que devuelva `CollectionParse`, un `CollectionSpec` en `scripts/sync-content.ts` y su esquema en `src/content.config.ts`.

## Comandos

- `pnpm dev`: servidor local.
- `pnpm build`: `astro check && astro build` → `dist/`.
- `pnpm preview`: sirve `dist/` (Astro 7 usa archivo de bloqueo; `pnpm exec astro preview stop` detiene uno previo).
- `pnpm lint`, `pnpm format:check` (`pnpm format` para corregir), `pnpm typecheck`.
- `pnpm test` (Vitest) y `pnpm test -- <ruta|patrón>` para una sola prueba.
- `pnpm test:e2e` (Playwright + axe; compila con `CONTENT_DIR=tests/fixtures/content`, datos fijos de ejemplo, y sirve en el puerto 4321). Primera vez: `pnpm exec playwright install chromium`.
- `pnpm check:release`: falla mientras haya datos del negocio pendientes.
- `pnpm sync:content`: descarga el contenido (requiere `GOOGLE_SERVICE_ACCOUNT_JSON` y `SPREADSHEET_ID`; normalmente solo en Actions).

Stack: Astro 7 (estático), TypeScript 6, pnpm 12.7.0 (`packageManager`), Node 22 (`.nvmrc`). Instalar solo con lockfile (`pnpm install --frozen-lockfile`). No añadir dependencias sin justificarlo.

## Arquitectura

- **Astro, salida estática** (`output: 'static'`). Sin SSR, endpoints dinámicos ni adaptadores.
- **Sin React**: los componentes son `.astro`; interacción mínima con `<script>` o elementos nativos (`<details>` en preguntas, carrusel con scroll-snap). Cualquier isla futura debe justificarse.
- **Capas**: `src/pages`/`src/layouts` componen; `src/components` UI; `src/lib` lógica pura sin Astro/React (probada con Vitest); `src/config` datos del negocio. `scripts/` hace red y disco del sync.
- **Rutas**: `site` y `base` llegan por entorno (`SITE_URL`, `BASE_PATH`) y en CI los rellena `actions/configure-pages` (dominio propio → base `/`). Todo enlace interno pasa por `withBase` de `src/lib/url.ts`; nada de rutas absolutas escritas a mano. `trailingSlash: 'always'`.
- **Tema**: colores y fuentes del negocio solo en `src/styles/theme.css` (tokens CSS; fuentes autoalojadas en `src/assets/fonts/` con `@font-face` y `--font-sans` / `--font-serif`, subconjunto latino, `font-display: swap`); verificar contraste AA al cambiarlos.
- **Acento**: además del primario, `theme.css` puede redefinir `--color-accent` (decorativo: borde del header, borde del aviso; contraste ≥ 3:1), `--color-accent-text` (texto pequeño: énfasis de títulos, etiqueta del hero; ≥ 4.5:1), `--color-accent-on-primary` (cifras grandes sobre el primario; ≥ 3:1) y `--color-tint` (fondo suave del hero). Sin redefinirlos siguen al primario. Un oro rosa claro (`#B76E79`) no sirve para texto pequeño: usar su versión oscura en `--color-accent-text`.
- **Superficies y alertas**: `--color-header-bg/-text`, `--color-header-cta-*` (botón del header), `--color-strip-bg/-text` (franja de confianza), `--color-alert-bg/-text` (barra superior) y `--color-toast-bg/-border/-icon/-icon-text` (aviso de actividad) siguen por defecto al primario o a los neutros; un negocio con paleta clara los redefine en `theme.css` (el foco del header usa `--color-header-text`, así que siempre se ve). Medir el contraste de cada par.
- **Header**: barra superior opcional (`siteConfig.announcement`, solo datos reales), enlaces a la izquierda, marca centrada, botón "Pedir por WhatsApp" y menú desplegable en móvil (sin JS queda visible).
- **Inicio**: hero con la imagen del primer destacado (o del primer producto) y franja de confianza calculada del catálogo y la configuración (número de desayunos, zona, pedidos por WhatsApp); nunca cifras inventadas.
- **Pedidos**: botón por producto que abre `wa.me` con el mensaje armado (`src/lib/order.ts`). El sitio no guarda datos personales.

## Reglas heredadas (mismo estándar que desayunosorpresas.com)

- TypeScript `astro/tsconfigs/strictest`; sin `any` ni `@ts-ignore`.
- Rendimiento: cero JS por defecto, imágenes con `astro:assets` y dimensiones, `fetchpriority="high"` solo en la imagen LCP.
- Accesibilidad WCAG 2.2 AA: un `h1` por página, jerarquía de encabezados, foco visible, teclado, `alt` significativo, `prefers-reduced-motion`. Sin carruseles con rotación automática.
- Seguridad: sin secretos en el repo ni en `PUBLIC_*`; enlaces externos con `rel="noopener noreferrer"`; CSP de Astro con hashes; acciones de GitHub fijadas por SHA y permisos mínimos; ningún job con permisos de escritura en workflows disparados por `pull_request`.
- SEO/GEO: `<head>` único (`SeoHead`), canonical, Open Graph, JSON-LD solo con datos visibles y verdaderos. Nunca prometer posicionamiento ni resultados.

## Definición de terminado

No afirmar que una tarea está terminada sin ejecutar y reportar: `lint`, `format:check`, `typecheck`, `test`, `build` y, si cambia UI o rutas, `test:e2e` (con axe). Si un paso falla o no se pudo ejecutar, decirlo con la salida.
