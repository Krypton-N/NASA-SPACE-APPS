# Guía para presentar el prototipo al equipo

**Objetivo de la sesión:** encontrar el problema que los científicos tienen realmente y dónde podemos
atacar visualizando y explorando los datos.

**Idea central:** no traigo una solución terminada. Traigo los datos ya bajados y cruzados, y una
herramienta para buscar juntos dónde está el problema. La app es el pretexto para discutir.

Duración sugerida: 25–30 min (15 de demo, 10–15 de discusión).

---

## 0. Antes de empezar (5 min antes)

```bash
cd NASA_SpaceApps_2026_Flame_in_Freefall/app
npm install      # solo si es la primera vez en esa computadora
npm run dev      # abre http://localhost:5173
```

- Deja la app abierta en la pestaña **Panorama** y con la ventana a pantalla completa (F11).
- Abre una vez la pestaña **Llama 3D** antes de la reunión para que three.js quede en caché.
- Si comparten pantalla por videollamada, el fondo animado puede verse entrecortado en el stream:
  no pasa nada, en local va fluido.
- Plan B si algo falla: `npm run build` y luego `npm run preview` (http://localhost:4173).

---

## 1. Apertura (1 min)

> "Hace 8 días quedamos en buscar el problema real de los científicos. Bajé todo lo público que hay
> del reto: 24 investigaciones de NASA PSI, 277 reportes técnicos y 138 proyectos. Armé esto para
> explorarlo juntos. Todo lo que van a ver sale de datos reales y cada número tiene su fuente."

---

## 2. Panorama (4 min) — el problema

**Muestra:** la ventanilla con la gota ardiendo y las cifras de arriba.

> "Esto es una gota de heptano ardiendo en la Estación Espacial. Sin gravedad la llama es una esfera,
> no una lágrima, porque el aire caliente no sube."

**Baja a "Dónde se atoran hoy los científicos"**. Es la parte más importante de toda la sesión.
Recorre las 4 tarjetas:

1. **Datos fragmentados**: 20 tablas, cada una con su formato; ~2 600 archivos rotos en el servidor.
2. **Conocimiento encerrado**: 99.97 % del volumen es video; las conclusiones están en PDFs.
3. **Huecos de cobertura**: la atmósfera propuesta para exploración (0.57 atm, 34 % O₂) no se ha
   medido. FLEX nunca bajó de 0.69 atm.
4. **Tierra contra órbita**: los materiales se certifican quemándolos hacia arriba en la Tierra, pero
   en órbita arden distinto (Saffire-II: el silicón ardió completo en 1 g y casi nada en órbita).

> "Estas cuatro son hipótesis de problema, no conclusiones. La pregunta para hoy es cuál de estas
> es el dolor real y cuál podemos atacar mejor en 48 horas."

**Hallazgos**: muestra uno o dos, no los cuatro. El más fuerte para contar:

> "Con CO₂ arriba de 30 %, el 97 % de las gotas de metanol se apagaron. El CO₂ es justo lo que usan
> los extintores de la ISS."

---

## 3. Explorador (3 min) — dónde hay datos y dónde no

**Muestra:** la dispersión. Pasa el cursor por dos o tres puntos para que vean que cada punto es un
ensayo real con sus condiciones.

- Activa el filtro **Con CO₂** y luego **Con He** para que vean cómo cambia el patrón.
- **Mapa de cobertura** ("¿Dónde hay datos y dónde no?"): el punto clave de la sesión.

> "Las celdas punteadas son combinaciones que nadie ha probado. Miren dónde cae la atmósfera de
> exploración: fuera de lo medido. Justo donde NASA quiere ir, no hay datos."

---

## 4. Simulador (3 min) — predicción con evidencia

- Da clic en el escenario **Cabina ISS**: el estado dice "Dentro de los datos".
- Luego en **Atmósfera de exploración**: el estado cambia a "Extrapolando" y dice por qué.

> "Esto es lo que queremos que haga el producto: predecir, pero ser honesto cuando no sabe.
> En seguridad contra incendios un modelo que se equivoca con confianza es peor que no tener modelo."

- Muestra la tabla **Ensayos en los que se basa** y la gráfica de **ley d²**: las líneas grises son
  mediciones reales cuadro por cuadro del video de cada ensayo.
- Cambia a **Gravedad terrestre** en la cámara para mostrar la diferencia de forma de la llama.

**Sé transparente:** es un modelo base (vecinos más cercanos). R² = 0.68. Sirve para demostrar el
concepto, no para decisiones reales.

---

## 5. Llama 3D (1–2 min) — el gancho visual

- Arrastra para rotar. Cambia a heptano con 30 % O₂ para ver la capa de hollín.
- Elige **Heptano** y baja el oxígeno a **0.16**: la llama visible se apaga pronto y queda un halo
  tenue, la llama fría que FLEX descubrió en órbita.

> "Esto es lo que ve un juez en 10 segundos. Pero ojo: es cualitativo. El valor está en el modelo y
> los datos de atrás, no en el render."

---

## 6. Evidencia y Pipeline IA (2 min)

- **Evidencia**: busca "cool flame" o "Saffire" para mostrar que el corpus ya está bajado y es buscable.
- **Pipeline IA**: explica dónde entra Jev (clasificar y verificar con confianza) y dónde no
  (no predice el fuego, no extrae números). Menciona que hay que pedir acceso anticipado ya.

---

## 7. Discusión (10–15 min) — para eso es la sesión

Preguntas para el equipo, en este orden:

1. **¿Cuál de los 4 problemas es el dolor real?** ¿Para quién? ¿Científico, ingeniero de diseño de
   hábitats, tripulación, oficial de seguridad?
2. **¿Qué decisión concreta debería poder tomar alguien con nuestra app?**
   Ejemplo: "¿puedo usar este material en un hábitat a 0.57 atm y 34 % O₂?"
3. **¿Hueco de cobertura o comparación Tierra contra órbita?** Son las dos apuestas más originales.
   ¿Con cuál nos quedamos como historia principal?
4. **¿Qué necesitamos validar antes del 28 de octubre** (cuando salen los datasets oficiales)?
5. **¿Quién toma qué?** Propuesta de reparto:
   - Datos y extracción de PDFs (pipeline con IA)
   - Modelo (proceso gaussiano + Cantera para cubrir huecos)
   - Frontend y visualización
   - Narrativa, video y presentación final

**Cierra con una frase acordada**, por ejemplo:

> "Nuestro problema es ___ y lo atacamos mostrando ___ para que ___ pueda decidir ___."

---

## Lo que NO hay que prometer

- Los hallazgos son correlaciones entre ensayos, no reglas de diseño.
- La visualización 3D es cualitativa (el tamaño relativo de la llama es aproximado).
- Jev está en acceso anticipado; sus cifras de rendimiento son del fabricante.
- Los datasets oficiales del reto salen el 28 de octubre: pueden cambiar el enfoque.
