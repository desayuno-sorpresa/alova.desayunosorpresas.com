---
name: auditoria-produccion
description: Auditoría previa a publicar este sitio Astro en GitHub Pages - ejecuta y revisa pruebas, accesibilidad (WCAG 2.2 AA), seguridad, build reproducible, workflow de GitHub Actions y rutas base, y emite un veredicto listo/no listo con evidencias. Usar antes de fusionar a main o desplegar, al cambiar el workflow de CI, o cuando se pida verificar que el sitio está listo para producción.
---

# Auditoría de producción

Puerta de calidad antes de publicar. No despliega: produce un veredicto con evidencias. Para rendimiento y SEO delega en `rendimiento-web` y `seo-geo` e incorpora sus resultados.

## Cuándo usarla

- Antes de fusionar a `main`, crear un release o activar el despliegue.
- Tras cambios en `.github/workflows/`, `astro.config.*`, dependencias o lockfile.
- Cuando se pida confirmar que el sitio está "listo".

## Procedimiento

1. **Estado del repositorio.** `git status` limpio; rama y commit auditados anotados. Lockfile presente y coherente con `package.json`; versión de Node fijada (`.nvmrc`/`engines`) y coincidente con el workflow.
2. **Build reproducible.** Instalación limpia con lockfile (`npm ci` o equivalente del gestor fijado) en un directorio sin `node_modules`, luego en orden: `lint`, `format:check`, `typecheck`/`astro check`, `test`, `build`. Detente y reporta en el primer fallo con su salida.
3. **Pruebas.** Revisa que la lógica de `src/lib` tiene pruebas unitarias y que las rutas críticas tienen e2e. Ejecuta `test:e2e` contra `preview` con la `base` real si existe. Reporta cobertura si está configurada; no la inventes.
4. **Rutas base y Pages.** En `preview` con la `base` real: inicio, cada ruta de primer nivel, una ruta profunda, 404 y assets (CSS, JS, imágenes, favicon). Confirma `dist/.nojekyll` y `dist/404.html`.
5. **Accesibilidad.** axe (vía Playwright si existe) en todas las plantillas de página. Revisión manual mínima: navegación completa por teclado, foco visible, skip link, `lang`, contraste, `alt`, formularios con `label`, `prefers-reduced-motion`, zoom al 200 % sin pérdida.
6. **Seguridad.**
   - `npm audit --omit=dev` (o equivalente) — reportar altas/críticas.
   - Búsqueda de secretos y de variables `PUBLIC_*` con datos sensibles.
   - Uso de `set:html`/`dangerouslySetInnerHTML` justificado y con entrada confiable.
   - `target="_blank"` con `rel="noopener noreferrer"`.
   - CSP `<meta>` presente si el proyecto la define y sin `unsafe-inline` innecesario.
   - Sin scripts ni recursos de terceros no aprobados en `dist/`.
7. **Workflow de GitHub Actions.** Revisa: disparadores, `permissions` mínimos (`contents: read`, `pages: write`, `id-token: write` solo en deploy), `concurrency` para Pages, acciones fijadas por versión/SHA, misma versión de Node, instalación con lockfile, todos los pasos de calidad antes de `upload-pages-artifact`, entorno `github-pages`.
8. **Rendimiento y SEO.** Ejecuta o recoge los resultados de `rendimiento-web` y `seo-geo` para las páginas principales.
9. **Veredicto.** LISTO solo si todos los criterios bloqueantes pasan con evidencia ejecutada en esta sesión.

## Restricciones técnicas

- No desplegar, no hacer push, no cambiar la configuración de Pages del repositorio, no instalar dependencias nuevas: solo auditar y proponer.
- No marcar como aprobado un paso que no se ejecutó; usar "NO EJECUTADO" con el motivo.
- No relajar reglas de lint, tipos o tests para que pase la auditoría.
- Hallazgos de dependencias de desarrollo se reportan, pero no bloquean salvo que afecten al build.

## Criterios de aceptación

Bloqueantes:
- [ ] Instalación limpia + `lint`, `typecheck`, `test`, `build` en verde.
- [ ] e2e en verde si existen.
- [ ] Cero violaciones axe de impacto `serious`/`critical`.
- [ ] Todas las rutas y assets comprobados responden 200 bajo la `base` real; 404 personalizada funciona.
- [ ] Sin secretos en el repo ni en `dist/`; sin vulnerabilidades altas/críticas en dependencias de producción.
- [ ] Workflow con permisos mínimos, versiones fijadas y pasos de calidad previos al deploy.
- [ ] `site`/`base` definidos (si no, el veredicto es NO LISTO).

No bloqueantes (reportar): violaciones axe `moderate`/`minor`, objetivos de rendimiento no alcanzados, hallazgos SEO/GEO, vulnerabilidades en dev.

## Pruebas y evidencias

```sh
git status --porcelain; git rev-parse --short HEAD
node --version; cat .nvmrc 2>/dev/null
# Secretos y patrones sensibles
grep -rnIE "(api[_-]?key|secret|token|password)\s*[:=]" --exclude-dir={node_modules,dist,.git} .
grep -rnE "PUBLIC_[A-Z_]+" src .env* 2>/dev/null
# HTML inseguro
grep -rnE "set:html|dangerouslySetInnerHTML" src
grep -rnoE "target=\"_blank\"[^>]*" src | grep -v noopener
# Artefactos de Pages
ls dist/.nojekyll dist/404.html
# Recursos externos en la salida
grep -rhoE "(src|href)=\"https?://[^\"]+" dist --include=*.html | sort -u
# Workflow
grep -nE "permissions|uses:|node-version|concurrency" .github/workflows/*.yml
```

Más: salida de cada comando del paso 2, informe axe, lista de URLs comprobadas con su código HTTP, resúmenes de `rendimiento-web` y `seo-geo`.

## Formato de entrega

```
## Auditoría de producción — <commit> — VEREDICTO: LISTO | NO LISTO
### Bloqueantes
| Área | Comprobación | Resultado | Evidencia |
(OK / FALLO / NO EJECUTADO + motivo)
### No bloqueantes
<hallazgo, severidad, recomendación>
### Rendimiento y SEO (resumen)
<enlaces a las secciones de las otras skills>
### Acciones necesarias antes de publicar
1. ...
```
