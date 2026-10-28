# Flame in Freefall · app web

Dashboard del reto #08 de NASA Space Apps 2026: combustión en microgravedad con datos reales de
NASA PSI, NTRS y Task Book.

## Levantarla

Requiere Node 20.19+ (probado con Node 22).

```bash
cd app
npm install        # solo la primera vez
npm run dev        # abre http://localhost:5173
```

Otros comandos:

```bash
npm run build      # genera dist/ para publicar
npm run preview    # sirve dist/ en http://localhost:4173
```

Los datos salen de `public/data/dashboard.json`. Para regenerarlos después de descargar datos nuevos
(desde la raíz del proyecto):

```bash
.venv/Scripts/python scripts/build_dashboard_data.py
```

## Estructura

```
app/
├── index.html                 cascarón: fondo, barra superior, contenedores de cada vista
├── public/
│   ├── data/dashboard.json    ensayos FLEX, curvas d(t), inventario PSI, catálogo NTRS y Task Book
│   └── favicon.svg
└── src/
    ├── main.js                arranque: carga datos, monta vistas y router
    ├── state.js               estado compartido: condiciones, gravedad, escenario simulado
    ├── styles/                tokens · base · layout · components · views
    ├── core/                  utilidades DOM, SVG, tooltip, router con ciclo de vida, store
    ├── model/
    │   ├── knn.js             vecinos más cercanos + cobertura / extrapolación
    │   ├── flame.js           escenario, ley d², fases de la llama, escenarios predefinidos
    │   ├── lab.js             textos del laboratorio 3D: entornos, instrumentos, puntos de interés
    │   └── findings.js        hallazgos calculados en vivo desde FLEX
    ├── charts/                dispersión, extinción, mapa de cobertura, ley d²
    ├── render/
    │   ├── flame2d.js         llama en canvas (simulador y ventanilla de la portada)
    │   ├── flame3d.js         laboratorio three.js: llama, secuencia del ensayo, cámara, instrumentos
    │   └── lab/               chamber.js (cámara CIR + MDCA) · environments.js (un entorno por
    │                          escenario) · textures.js (texturas en canvas) · kit.js (piezas básicas)
    ├── background/space.js    fondo espacial interactivo
    ├── ui/                    panel de controles, chips, selector de gravedad
    └── views/                 una vista por pestaña
```

## Laboratorio 3D

La pestaña "Llama 3D" recrea el hardware de FLEX descrito en `data/psi/PSI-69_FLEX/Presentations`:
cámara de combustión con ocho ventanas, inserto MDCA, agujas de despliegue, ignitores de hilo
caliente y paquetes HiBMS / LLUV / iluminación. Todo es geometría y texturas procedurales (sin
modelos ni imágenes externas); es una recreación ilustrativa, no CAD.

- **Entorno por escenario** (`PRESETS[].id` en `flame.js` → `LOOK` y `buildEnv` en `environments.js`):
  `iss` módulo Destiny con el CIR · `explore` hábitat en órbita lunar · `co2` alarma de incendio con
  extintor · `lowo2` vehículo en la torre de caída de NASA Glenn. Con condiciones personalizadas se
  conserva el último entorno.
- **Tres escalas** con la misma cámara orbital: gota, cámara y laboratorio (rueda o botones).
- **Vistas de cámara**: además de la vista libre, el punto de vista fijo de cada instrumento
  (`rig.cams` en `chamber.js`): cámara a color del MDCA (4:3), HiBMS a contraluz y LLUV (OH*), con
  marco, barra de escala y zoom digital. Las tres se repiten en miniatura sobre el mismo lienzo.
- **Pantalla completa**: el botón «Condiciones» mete el panel de controles y la barra de herramientas
  dentro del escenario; si el navegador no concede pantalla completa se usa un modo maximizado.
- **Secuencia**: despliegue → ignición → llama caliente → llama fría → final, con pausa y barra de avance.
- **Lectura** "Explicado" / "Científico": cambia narración, telemetría y tarjetas de los puntos de interés.

Para añadir un entorno: un preset con `id` en `flame.js`, su ficha en `ENVS` (`model/lab.js`), su
entrada en `LOOK` y su constructor en `environments.js`.

## Decisiones de rendimiento

- Cada vista tiene `enter()` / `leave()`: las animaciones solo corren en la pestaña visible.
- three.js vive en su propio archivo (~740 KB) y se descarga la primera vez que se abre "Llama 3D";
  al salir se libera el contexto WebGL.
- El fondo se dibuja a 30 fps y se pausa con la pestaña del navegador oculta. Si el equipo no lo
  sostiene, la app cambia sola a un modo ligero sin desenfoque de vidrio.
- Con "reducir movimiento" activado en el sistema, todo queda estático.

## Modelo

Vecinos más cercanos (k = 7) sobre 257 ensayos de FLEX con condiciones completas.
Validación dejando uno fuera: R² = 0.68 y error medio de 0.051 mm²/s en la tasa de quemado;
83 % de acierto en extinción (69 % prediciendo siempre la clase mayoritaria).
Cuando alguna condición sale del rango medido, la app lo marca como extrapolación.
