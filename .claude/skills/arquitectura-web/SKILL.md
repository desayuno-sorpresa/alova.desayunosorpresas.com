---
name: arquitectura-web
description: Diseña o revisa la estructura de módulos de este sitio Astro + React + TypeScript (páginas, layouts, componentes, islas, lib, config, content collections), decide entre .astro e isla React, aplica SOLID pragmático y garantiza compatibilidad con GitHub Pages y rutas base. Usar al crear el andamiaje, añadir páginas, componentes o islas, refactorizar, o cuando una decisión afecte a la estructura o al despliegue estático.
---

# Arquitectura web

Procedimiento para decisiones estructurales. Las reglas globales (capas, TypeScript estricto, rutas base, definición de terminado) están en `CLAUDE.md`; esta skill dice cómo aplicarlas.

## Cuándo usarla

- Crear el andamiaje inicial o un módulo, página, layout, colección o isla nueva.
- Refactorizar código que cruza capas o mezcla responsabilidades.
- Revisar un cambio que toque `astro.config.*`, `tsconfig`, rutas, enlaces o assets.
- No usarla para ajustes puramente visuales o de texto dentro de un componente existente.

## Procedimiento

1. **Inventario.** Lee `astro.config.*`, `tsconfig.json`, `package.json` y el árbol de `src/`. Anota `site`, `base`, `trailingSlash`, integraciones y alias. Si `site`/`base` no están definidos y la tarea depende de ellos, detente y pregunta.
2. **Clasifica cada pieza nueva** con este árbol de decisión:
   - ¿Necesita estado o eventos en el navegador? No → componente `.astro`.
   - Sí, pero basta con un comportamiento pequeño (toggle, menú) → `<script>` en `.astro` o elemento nativo (`<details>`, `<dialog>`) antes que React.
   - Sí y es interacción compleja/estado compartido → isla React. Elige directiva: `client:visible` (bajo el pliegue) › `client:idle` › `client:media` › `client:load` (justificar) › `client:only` (justificar, rompe HTML inicial).
   - ¿Es lógica sin UI (formateo, cálculos, transformación de datos, rutas)? → función pura en `src/lib`.
   - ¿Son datos editoriales repetibles? → Content Collection con esquema Zod.
3. **Define contratos antes que implementación.** Escribe los tipos de props y de datos (`interface Props`, tipos exportados en `src/lib` o inferidos de Zod). Las islas reciben datos serializables por props; no importan módulos de Astro.
4. **Comprueba la dirección de dependencias:** `pages/layouts → components → lib/config`. `lib` no importa de `components`, `astro:*` ni `react`. Ninguna isla importa de `pages`.
5. **Aplica SOLID de forma pragmática:**
   - S: si un componente necesita "y" para describirse, divídelo.
   - O/L: extiende por composición (slots, `children`, props de render) en lugar de añadir flags booleanos.
   - I: props mínimas; no pases objetos enteros si se usan dos campos.
   - D: componentes dependen de tipos y datos inyectados por props, no de fetch/lecturas globales internas.
   - Crea una abstracción solo cuando exista un segundo caso de uso real.
6. **Rutas y assets.** Todo enlace interno pasa por el helper de `BASE_URL` de `src/lib`; todo asset local se importa (`astro:assets`) o se resuelve con ese helper. Busca rutas absolutas escritas a mano (ver Evidencias).
7. **Restricciones de Pages.** Confirma que nada requiere servidor: sin `output: 'server'`, sin adaptadores, sin endpoints dinámicos, sin redirecciones por cabeceras. Rutas dinámicas solo con `getStaticPaths`.
8. **Verifica** con los comandos de `CLAUDE.md` y la base real en `preview`.

## Restricciones técnicas

- Salida estática exclusivamente; cualquier dato se resuelve en build.
- Props de islas serializables (sin funciones, clases, `Date` sin convertir, `Map`/`Set`).
- No compartir estado global entre islas salvo con una store ligera justificada (p. ej. nanostores); nunca contexto React entre islas separadas.
- Nada de rutas absolutas literales a recursos propios, incluido CSS (`url(/...)`).
- Sin dependencias nuevas sin justificar tamaño y necesidad.

## Criterios de aceptación

- [ ] Cada componente nuevo está clasificado (.astro / script / isla / lib / colección) con la razón registrada en la entrega.
- [ ] Cada directiva `client:*` distinta de `visible`/`idle` tiene justificación.
- [ ] `src/lib` no importa `astro:*`, `react` ni `src/components` (verificado con grep).
- [ ] Cero rutas internas absolutas escritas a mano (verificado con grep).
- [ ] `astro check` y `tsc` sin errores; sin `any` ni `@ts-ignore` nuevos.
- [ ] `build` genera `dist/` y en `preview` con la `base` real todos los enlaces y assets tocados responden 200.
- [ ] La lógica nueva en `src/lib` tiene pruebas unitarias.

## Pruebas y evidencias

```sh
# Dependencias prohibidas en lib
grep -rnE "from ['\"](astro:|react|@/components|\.\./components)" src/lib
# Rutas absolutas escritas a mano (revisar cada coincidencia)
grep -rnE "(href|src)=['\"]/[^/]|url\(/[^/]" src
# Directivas de hidratación
grep -rnoE "client:(load|only|idle|visible|media)" src | sort | uniq -c
# Tipos prohibidos
grep -rnE ":\s*any\b|@ts-ignore" src
```

Además: salida de `astro check`, `build` y comprobación en `preview` (navegar o comprobar con `curl -I` las rutas modificadas bajo la `base`). Si existen, `test` y `test:e2e`.

## Formato de entrega

```
## Arquitectura: <tarea>
### Decisiones
| Pieza | Tipo | Ubicación | Motivo |
### Dependencias y contratos
<tipos/props nuevos y flujo de datos, breve>
### Compatibilidad GitHub Pages
<base usada, rutas verificadas>
### Verificación
<comando → resultado (OK/FALLO + extracto)>
### Pendiente / riesgos
<datos no definidos, deuda técnica>
```
