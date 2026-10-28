import { PRESETS } from "./flame.js";

/**
 * Contenido del laboratorio 3D: entornos por escenario, instrumentos y puntos de interés.
 * Los datos de hardware salen de las presentaciones de FLEX en PSI-69 (CIR, MDCA, HiBMS, LLUV, ZGF).
 * Cada texto tiene dos versiones: `plain` para público general y `tech` para quien investiga.
 */

export const ENVS = {
  iss: {
    id: "iss",
    name: "Cabina ISS",
    place: "CIR · módulo Destiny · órbita a 400 km",
    plain: "El aire normal de la estación: 21 % de oxígeno a 1 atm. Aquí se quemaron las gotas de FLEX, dentro del Combustion Integrated Rack.",
    tech: "Línea base de FLEX: aire a 1 atm en la cámara del CIR con el inserto MDCA. Heptano de 3–4 mm muestra extinción radiativa seguida de llama fría.",
  },
  explore: {
    id: "explore",
    name: "Atmósfera de exploración",
    place: "Hábitat de exploración · órbita lunar",
    plain: "Menos presión y más oxígeno para salir en traje espacial sin horas de preparación. El costo: con 34 % de oxígeno todo arde con más ganas.",
    tech: "Atmósfera de exploración propuesta por NASA: ≈ 8.2 psia (56.5 kPa) y 34 % O₂. Mayor XO₂ sube la temperatura de llama, K y la producción de hollín.",
  },
  co2: {
    id: "co2",
    name: "Descarga de extintor CO₂",
    place: "CIR · alarma de incendio en la ISS",
    plain: "Los extintores del lado estadounidense de la estación son de CO₂. FLEX midió cuánto hace falta para que una llama sin gravedad se apague.",
    tech: "40 % CO₂ con 17 % O₂: el diluyente radiante aumenta la pérdida de calor y baja la temperatura de llama; el metanol se extingue a diámetros grandes.",
  },
  lowo2: {
    id: "lowo2",
    name: "Oxígeno bajo",
    place: "Torre de caída · NASA Glenn (ZGF)",
    plain: "Cerca del límite: con 14 % de oxígeno la llama es grande, tenue y se apaga pronto. En tierra esto se ensaya dejando caer el experimento 132 m.",
    tech: "Límite de oxígeno del metanol. La Zero Gravity Research Facility da 5.18 s de microgravedad: alcanza para gotas de 1–2 mm; las de FLEX necesitaron la ISS.",
  },
};

/** Escenario predefinido que coincide exactamente con las condiciones, o null si son personalizadas. */
export function matchPreset(q) {
  const hit = PRESETS.find((p) => Object.entries(p.q).every(([k, v]) => (typeof v === "number" ? Math.abs(v - q[k]) < 1e-6 : v === q[k])));
  return hit ? hit.id : null;
}

/**
 * Formas de mirar: la vista libre en 3D o el punto de vista real de una cámara.
 * `bar` es la longitud de la barra de escala (mm) que se dibuja sobre la imagen.
 */
export const VIEWS = [
  { id: "free", label: "Libre", name: "Vista libre en 3D" },
  { id: "color", label: "Color", name: "Cámara a color del MDCA", spec: "0.3 MP · 30 fps", bar: 10 },
  { id: "hibms", label: "HiBMS", name: "HiBMS-1 · gota a contraluz", spec: "1 MP · 30 fps · láser IR de fondo", bar: 5 },
  { id: "lluv", label: "LLUV", name: "LLUV · quimioluminiscencia OH*", spec: "UV de baja luz · ~310 nm", bar: 10 },
];

export const LEVELS = [
  { id: "drop", label: "Gota" },
  { id: "chamber", label: "Cámara" },
  { id: "lab", label: "Laboratorio" },
];

/** Puntos de interés. `level` indica a qué distancia de cámara se muestran. */
export const HOTSPOTS = {
  drop: {
    level: "drop", title: "Gota de combustible",
    plain: "Una gota del tamaño de una lenteja que flota sin tocar nada. Al arder se encoge de forma muy regular: el cuadrado de su diámetro baja en línea recta con el tiempo.",
    tech: "Ley d²: d² = d₀² − K·t. K se predice con los 7 ensayos FLEX más cercanos a las condiciones elegidas.",
  },
  flame: {
    level: "drop", title: "Llama esférica",
    plain: "Sin gravedad el aire caliente no sube, así que la llama no tiene «arriba»: es una esfera. El oxígeno solo llega por difusión, despacio, y por eso la llama queda lejos de la gota.",
    tech: "Llama de difusión esferosimétrica. Relación llama/gota (FSR = D_f/D) típica de 5 a 12; el radio dibujado es cualitativo.",
  },
  plume: {
    level: "drop", title: "Llama con gravedad",
    plain: "En la Tierra el gas caliente pesa menos que el aire y sube. Esa corriente estira la llama en forma de lágrima y le trae oxígeno fresco desde abajo.",
    tech: "Convección natural (flotación): el flujo inducido adelgaza la zona de reacción y aumenta la tasa de quemado respecto al caso esferosimétrico.",
  },
  soot: {
    level: "drop", title: "Cascarón de hollín",
    plain: "El heptano produce hollín que queda atrapado en una cáscara entre la gota y la llama. Es lo que brilla amarillo-naranja.",
    tech: "El hollín se acumula donde la termoforesis (hacia la gota) equilibra el arrastre del vapor que sale (flujo de Stefan). El metanol casi no forma hollín.",
  },
  needles: {
    level: "chamber", title: "Agujas de despliegue",
    plain: "Dos agujas huecas, una frente a otra, inyectan el combustible, estiran la gota entre ambas y se retiran de golpe para dejarla flotando.",
    tech: "MDCA: las agujas forman un puente líquido hasta el diámetro deseado y se retraen rápido. Opcionalmente la gota se sujeta con una fibra de SiC de 80 µm.",
  },
  igniters: {
    level: "chamber", title: "Ignitores de hilo caliente",
    plain: "Dos lazos de alambre se ponen al rojo vivo, encienden la gota por ambos lados y se apartan para no estorbar a la llama.",
    tech: "Hilos calientes simétricos, energizados y retraídos en cuanto hay ignición para preservar la simetría esférica.",
  },
  hibms: {
    level: "chamber", title: "Cámara HiBMS · vista de gota",
    plain: "Mira la gota a contraluz. De estas imágenes sale la curva de diámetro contra tiempo de cada ensayo.",
    tech: "High Bit-depth Multi-Spectral, ~1 MP a 30 fps, retroiluminada con un diodo láser infrarrojo. Una segunda HiBMS con filtro sintonizable mide temperatura de hollín.",
  },
  lluv: {
    level: "chamber", title: "Cámara LLUV",
    plain: "Ve luz ultravioleta que el ojo no ve. Con ella se mide el tamaño real de la llama, incluso cuando es casi invisible.",
    tech: "Low Light Level UV: quimioluminiscencia de OH* (~310 nm). Define el diámetro de llama y marca la extinción de la llama caliente.",
  },
  backlight: {
    level: "chamber", title: "Iluminación de fondo",
    plain: "La luz que queda detrás de la gota para que la cámara HiBMS vea su sombra.",
    tech: "Paquete de iluminación opuesto a la HiBMS; fondo infrarrojo colimado.",
  },
  radiometer: {
    level: "chamber", title: "Radiómetros",
    plain: "Miden el calor que la llama pierde en forma de radiación. En gotas grandes esa pérdida es la que termina apagando la llama.",
    tech: "Radiómetros de banda ancha y banda angosta. La pérdida radiativa crece con el tamaño de la llama y dispara la extinción radiativa.",
  },
  colorcam: {
    level: "chamber", title: "Cámara a color",
    plain: "La vista «a simple vista» que el equipo en tierra usa para seguir el ensayo en tiempo real.",
    tech: "Cámara a color del MDCA: 0.3 MP a 30 fps, operación en tiempo real desde NASA Glenn.",
  },
  chamber: {
    level: "lab", title: "Cámara de combustión del CIR",
    plain: "Un cilindro sellado donde se prepara la atmósfera exacta de cada ensayo: cuánto oxígeno, qué presión y qué gas de relleno.",
    tech: "Cámara de unos 100 L con ocho ventanas ópticas alrededor; el inserto MDCA se desliza dentro y los paquetes de diagnóstico miran por las ventanas.",
  },
  testchamber: {
    level: "lab", title: "Cámara de ensayo",
    plain: "La misma idea que en la estación, en versión compacta: una cámara sellada con la atmósfera del ensayo, lista para caer.",
    tech: "Cámara sellada del vehículo de caída con aguja dispensadora, ignitor, fibra de soporte y cámaras de gota y de llama.",
  },
  bottles: {
    level: "lab", title: "Botellas de gas",
    plain: "De aquí salen el oxígeno, el nitrógeno y los diluyentes (CO₂, helio, xenón) que se mezclan para llenar la cámara.",
    tech: "Manifolds de O₂, N₂, diluyente y combustible gaseoso del CIR. Un cartucho adsorbente limpia la atmósfera entre quemas.",
  },
  earth: {
    level: "lab", title: "La Tierra, 400 km abajo",
    plain: "La estación cae alrededor de la Tierra todo el tiempo. Por eso dentro todo flota, y por eso la llama es redonda.",
    tech: "Ventana nadir de Destiny. Microgravedad residual del orden de 10⁻⁶ g en el CIR.",
  },
  moon: {
    level: "lab", title: "La Luna por la ventana",
    plain: "Los hábitats de exploración planean menos presión y más oxígeno para que salir en traje sea rápido. A cambio, los materiales se vuelven más inflamables.",
    tech: "≈ 8.2 psia y 34 % O₂: menor tiempo de pre-respiración para EVA; exige recalificar inflamabilidad de materiales.",
  },
  pfe: {
    level: "lab", title: "Extintor portátil de CO₂",
    plain: "Así se combate un incendio en el lado estadounidense de la estación. El CO₂ desplaza al oxígeno y además le roba calor a la llama.",
    tech: "Con CO₂ como diluyente la llama se extingue con más oxígeno presente que con N₂: mayor capacidad calorífica y participación radiativa del gas.",
  },
  alarm: {
    level: "lab", title: "Alarma de incendio",
    plain: "Luces rojas y aviso de fuego: la tripulación corta la ventilación y descarga el extintor.",
    tech: "Clase de emergencia «Fire» del sistema Caution & Warning de la ISS.",
  },
  shaft: {
    level: "lab", title: "Pozo de vacío de 143 m",
    plain: "El experimento cae 132 metros dentro de un tubo al que se le saca el aire. Durante 5.18 segundos nada pesa.",
    tech: "Zero Gravity Research Facility (NASA Glenn): caída libre en vacío de ~10⁻² torr, frenado en un lecho de perlas de poliestireno.",
  },
  vehicle: {
    level: "lab", title: "Vehículo de caída",
    plain: "Todo el laboratorio viaja a bordo: cámara, baterías, cámaras de video y gases. Se suelta, cae y se recupera para el siguiente ensayo.",
    tech: "Vehículo autónomo con la cámara de ensayo, aguja dispensadora, ignitor, retroiluminación LED y radiómetros, como en los ensayos de metanol del ZGF.",
  },
};

export const STEPS = [
  { id: "deploy", label: "Despliegue" },
  { id: "ignite", label: "Ignición" },
  { id: "hot", label: "Llama caliente" },
  { id: "cool", label: "Llama fría" },
  { id: "end", label: "Final" },
];

const FUEL_ES = { Heptane: "heptano", Methanol: "metanol" };

/** Paso activo de la secuencia a partir de la fase del modelo y la etapa previa a la ignición. */
export function stepOf(phase, stage) {
  if (stage === "deploy" || stage === "retract") return "deploy";
  if (stage === "ignite") return "ignite";
  if (phase === "hot") return "hot";
  if (phase === "cool") return "cool";
  return "end";
}

/** Narración en lenguaje llano de lo que pasa en este instante. */
export function narrate(sim, { phase, stage, g, inst }) {
  const fuel = FUEL_ES[sim.q.fuel] || sim.q.fuel;
  if (stage === "deploy") return `Dos agujas inyectan ${fuel} y forman una gota de ${sim.q.d0.toFixed(1)} mm.`;
  if (stage === "retract") return "Las agujas se retiran de golpe: la gota queda flotando sola.";
  if (stage === "ignite") return "Dos hilos al rojo vivo la encienden por ambos lados y se apartan.";
  if (inst === "color" && phase === "hot" && !g) return "Así lo ve el equipo en tierra: la llama entre las agujas retraídas, con el interior de la cámara a oscuras.";
  if (inst === "hibms") return phase === "cool" ? "No hay llama visible, pero la sombra de la gota sigue encogiéndose: algo la sigue quemando." : "A contraluz solo se ve la sombra de la gota (y del hollín, si lo hay). Así se mide el diámetro.";
  if (inst === "lluv") return phase === "hot" ? "El anillo brillante es luz ultravioleta del OH*: ahí está la llama caliente." : "Sin OH* no hay señal: la llama caliente se apagó.";
  if (g) return "Con gravedad, el aire caliente sube: la llama se alarga hacia arriba y recibe más oxígeno.";
  if (phase === "hot") return sim.q.fuel === "Heptane"
    ? "Llama esférica: azul por fuera, con un cascarón de hollín incandescente por dentro."
    : "Llama esférica azul y tenue: el metanol casi no produce hollín.";
  if (phase === "cool") return "La llama visible se apagó, pero la gota sigue consumiéndose: es una llama fría, de unos 430 °C, invisible a simple vista.";
  if (phase === "out") return sim.cool ? "La llama fría también se apaga. Queda una gota sin quemar rodeada de vapor que podría volver a encenderse." : "La llama se apagó antes de consumir la gota: perdió más calor del que producía.";
  return "La gota se consumió por completo.";
}
