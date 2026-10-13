---
name: seo-geo
description: Revisa e implementa SEO técnico (metadatos, canonical, sitemap, robots, hreflang, datos estructurados JSON-LD, enlazado interno) y la calidad y citabilidad del contenido para buscadores y motores generativos (GEO) en este sitio Astro estático. Usar al crear o editar páginas o contenido, al tocar el componente de head, sitemap o robots, o cuando se pida mejorar visibilidad en búsqueda o en respuestas de IA.
---

# SEO técnico y GEO

Objetivo: que cada página sea rastreable, entendible y citable. Nunca prometer resultados de posicionamiento ni de aparición en respuestas de IA (regla global en `CLAUDE.md`).

## Cuándo usarla

- Crear o modificar páginas, colecciones de contenido o el componente de `<head>`.
- Configurar `site`, sitemap, `robots.txt`, idiomas o datos estructurados.
- Petición de mejorar SEO, visibilidad en buscadores o en asistentes/motores generativos.

## Procedimiento

1. **Prerrequisitos.** Comprueba `site` y `base` en `astro.config.*`. Si `site` no está definido, no generes canonical absolutos, sitemap ni `Sitemap:` en robots: reporta el bloqueo y pide la URL.
2. **Inventario de páginas** desde `dist/` tras `build` (cada `index.html`). Para cada una extrae: `<title>`, meta description, canonical, `lang`, `h1`, robots, OG, JSON-LD.
3. **SEO técnico, por página:**
   - `title` único (≈ 30–60 caracteres) y `description` única (≈ 70–160), ambos descriptivos del contenido real.
   - Canonical absoluto = `site` + `base` + ruta, coherente con `trailingSlash`.
   - Un `h1`; jerarquía de encabezados sin saltos.
   - `lang` correcto; `hreflang` recíprocos + `x-default` si hay varios idiomas.
   - OG/Twitter: `og:title`, `og:description`, `og:url`, `og:image` absoluta con dimensiones.
   - Páginas no indexables (404, borradores, utilidades) con `noindex` y fuera del sitemap.
4. **Rastreo:** sitemap generado por `@astrojs/sitemap` con URLs bajo la `base`; `robots.txt` que no bloquee CSS/JS ni contenido público y que referencie el sitemap. Enlaces internos rastreables (`<a href>`, no solo JS) y sin enlaces rotos.
5. **Datos estructurados:** elige el tipo schema.org que describa la página (`WebSite`, `Organization`/`Person`, `Article`, `BreadcrumbList`, `FAQPage` solo si hay FAQ visible, etc.). Genera JSON-LD desde los mismos datos que renderizan la página (colección o `src/config`) para que no diverjan. Solo propiedades verdaderas y visibles.
6. **Calidad de contenido y GEO:**
   - Responde la intención principal en el primer párrafo, en lenguaje directo.
   - Encabezados descriptivos (preguntas o temas concretos), secciones autocontenidas que se puedan citar aisladas.
   - Datos concretos con fuente, fecha de publicación/actualización visibles, autoría real.
   - Terminología consistente; definir siglas la primera vez.
   - Listas y tablas para comparaciones o pasos.
   - No inventar cifras, testimonios, reseñas, credenciales ni fuentes. Si faltan, marcar `[PENDIENTE: dato]` y reportarlo.
7. **Corrige** en el origen (componente de head, esquema de colección, `src/config`) y no página por página cuando el problema sea sistémico.
8. **Verifica** con las comprobaciones de abajo y los comandos de `CLAUDE.md`.

## Restricciones técnicas

- Metadatos generados por un único componente de head con props tipadas; las páginas no escriben `<meta>` sueltos.
- Sin contenido oculto para buscadores, keyword stuffing, cloaking ni páginas puerta.
- JSON-LD serializado con `JSON.stringify` (nunca concatenando strings) e insertado con `set:html` solo con ese resultado.
- `llms.txt` u otros ficheros para agentes solo si el usuario lo pide; no presentarlos como factor garantizado.
- No modificar textos editoriales de fondo sin indicarlo; proponer y marcar cambios de contenido.

## Criterios de aceptación

- [ ] Todas las páginas indexables tienen `title`, description y canonical únicos y no vacíos.
- [ ] Exactamente un `h1` por página.
- [ ] Canonical, sitemap y `og:url` usan `site` + `base` y coinciden entre sí.
- [ ] 404 y páginas no indexables con `noindex` y fuera del sitemap.
- [ ] JSON-LD parseable y con tipos/propiedades válidos para schema.org; coincide con el contenido visible.
- [ ] Sin enlaces internos rotos en `dist/`.
- [ ] Ningún dato inventado; los pendientes están listados.
- [ ] Ninguna afirmación de garantía de posicionamiento en el entregable.

## Pruebas y evidencias

```sh
# Títulos y descripciones duplicados o ausentes
grep -rhoE "<title>[^<]*</title>" dist --include=*.html | sort | uniq -d
grep -rLE "<meta name=\"description\"" dist --include=*.html
# h1 por página
for f in $(find dist -name '*.html'); do echo "$(grep -o '<h1' "$f" | wc -l) $f"; done | grep -v '^1 '
# Canonical
grep -rhoE "<link rel=\"canonical\"[^>]*>" dist --include=*.html
# Sitemap y robots
ls dist/sitemap*.xml dist/robots.txt
# JSON-LD parseable (extraer y validar con node/jq)
```

Más: validación del JSON-LD con el validador de schema.org o Rich Results Test (lo hace el usuario si no hay acceso de red; indicarlo), y comprobación de enlaces internos en `preview`.

## Formato de entrega

```
## SEO/GEO: <alcance>
### Bloqueos
<p. ej. site sin definir>
### Técnico
| Página | Title | Description | Canonical | h1 | JSON-LD | Estado |
### Contenido / GEO
<hallazgo → recomendación, por página>
### Cambios aplicados
<archivo → cambio>
### Datos pendientes del cliente
<lista de [PENDIENTE]>
### Verificación
<comando → resultado>
```
