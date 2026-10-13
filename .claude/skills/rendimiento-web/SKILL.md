---
name: rendimiento-web
description: Mide, diagnostica y optimiza el rendimiento de este sitio Astro estático en GitHub Pages con foco en Core Web Vitals (LCP, INP, CLS), peso de JavaScript, imágenes y fuentes. Usar cuando se pida mejorar velocidad, revisar Lighthouse, añadir islas React o recursos pesados (imágenes, fuentes, terceros), o antes de publicar una página nueva.
---

# Rendimiento web

Medir primero, cambiar después, medir de nuevo. Las reglas de presupuesto general (cero JS por defecto, `astro:assets`, fuentes autoalojadas) están en `CLAUDE.md`.

## Cuándo usarla

- Petición explícita de optimizar, o informe de lentitud o métricas malas.
- Al añadir o cambiar islas React, imágenes destacadas (hero/LCP), fuentes, vídeo o scripts de terceros.
- Como parte de `auditoria-produccion` antes de publicar.

## Procedimiento

1. **Línea base.** Ejecuta `build` y anota el tamaño de `dist/` y de cada chunk JS (`dist/_astro/*.js`). Sirve con `preview` usando la `base` real.
2. **Mide en laboratorio** las páginas afectadas (mínimo: inicio y la página cambiada), en móvil emulado:
   - Lighthouse CLI si está disponible (`npx lighthouse <url> --preset=perf --form-factor=mobile --output=json`) o Lighthouse CI si está configurado. No añadas la dependencia sin aprobación; si no hay herramienta, indícalo y usa las comprobaciones estáticas del paso 3.
   - Registra LCP, CLS, TBT (proxy de INP en laboratorio), peso total y número de peticiones.
   - Si hay datos de campo (CrUX/Search Console) aportados por el usuario, priorízalos sobre laboratorio. No los inventes.
3. **Diagnostica por métrica:**
   - **LCP:** identifica el elemento LCP. ¿Es imagen? → `<Image>`/`<Picture>` con `loading="eager"`, `fetchpriority="high"`, tamaños `widths`/`sizes` correctos, AVIF/WebP. ¿Es texto? → fuente crítica precargada y `font-display: swap`. Comprueba que no lo bloquea CSS o JS.
   - **CLS:** imágenes/iframes sin dimensiones, fuentes sin `size-adjust`/fallback métrico, contenido insertado por islas sin espacio reservado, banners.
   - **INP/TBT:** islas hidratadas pronto (`client:load`), dependencias grandes, manejadores costosos, listas sin virtualizar. Revisa qué importa cada isla.
   - **Peso:** JS por página, CSS no usado, imágenes sin optimizar en `public/` (no pasan por el pipeline de Astro).
4. **Prioriza** cambios por impacto/esfuerzo; aplica uno o pocos a la vez para poder atribuir la mejora.
5. **Optimizaciones preferidas (en orden):** eliminar JS o la isla → retrasar hidratación (`client:visible`/`idle`) → dividir isla o importar dinámicamente → sustituir dependencia pesada → optimizar imagen/fuente → `prefetch` de Astro para navegación.
6. **Re-mide** con las mismas condiciones y compara con la línea base.
7. **Verifica no-regresión** funcional con los comandos de `CLAUDE.md`.

## Restricciones técnicas

- GitHub Pages no permite cabeceras de caché ni compresión configurables: no proponer soluciones basadas en cabeceras; optimizar los artefactos en sí (hash en nombres ya lo aporta Astro).
- Sin service workers ni CDNs de terceros sin aprobación explícita.
- No sacrificar accesibilidad ni contenido indexable por rendimiento (p. ej. no convertir contenido a `client:only`).
- Imágenes de contenido en `src/assets`, no en `public/`, salvo favicons y archivos que deban conservar su nombre.
- Comparar siempre en las mismas condiciones (build de producción, `preview`, mismo dispositivo emulado).

## Criterios de aceptación

Objetivos por página (laboratorio, móvil) salvo que el proyecto defina otros:

- [ ] LCP ≤ 2,5 s; CLS ≤ 0,1; TBT ≤ 200 ms (INP de campo ≤ 200 ms si hay datos).
- [ ] Lighthouse Performance ≥ 90 en las páginas medidas.
- [ ] JS de cliente en páginas sin islas = 0 KB; cada isla con su peso (gzip) reportado y justificado.
- [ ] Imagen LCP con `fetchpriority="high"` y sin `loading="lazy"`; resto de imágenes con dimensiones y lazy.
- [ ] Ninguna métrica empeora respecto a la línea base.
- [ ] `build` y pruebas existentes pasan.

## Pruebas y evidencias

```sh
# Peso de JS generado
ls -l dist/_astro/*.js 2>/dev/null; du -sh dist
gzip -c dist/_astro/<chunk>.js | wc -c
# Páginas que cargan JS
grep -rlE "<script[^>]+type=\"module\"" dist --include=*.html
# Imágenes sin dimensiones en el HTML final
grep -rnoE "<img[^>]*>" dist --include=*.html | grep -vE "width=.*height=" 
# Imágenes pesadas en public/
find public -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -size +200k
```

Más: informe Lighthouse (JSON o resumen) antes/después, elemento LCP identificado y salida de `build`.

## Formato de entrega

```
## Rendimiento: <páginas>
Condiciones: <herramienta, móvil/escritorio, base, commit>
| Página | Métrica | Antes | Después | Objetivo |
### Diagnóstico
<causa raíz por métrica>
### Cambios aplicados
<cambio → efecto medido>
### No aplicado / propuestas
<cambio, impacto estimado, por qué no se aplicó>
### Verificación
<comando → resultado>
```

Si no se pudo medir con herramienta de laboratorio, dilo explícitamente y no presentes estimaciones como mediciones.
