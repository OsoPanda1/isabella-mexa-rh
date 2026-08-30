/**
 * Isabella Villaseñor AI - Sovereign Avatar & Identity Assets
 * Node Cero :: Real del Monte Sovereign AI Architecture
 */

import medallionImg from "../assets/images/isabella_cinematic_medallion.jpg";
import neuralMuseImg from "../assets/images/isabella_neural_muse_1786743849403.jpg";
const regeneratedImg = medallionImg;

export const ISABELLA_AVATAR_PRIMARY = medallionImg;
export const ISABELLA_MEDALLION_IMAGE = medallionImg;

export const ISABELLA_PORTRAITS = [
  {
    id: "sovereign_prime",
    title: "Isabella Villaseñor · Soberana Prime",
    subtitle: "Liderazgo, Gobernanza & Soberanía Tecnológica",
    src: ISABELLA_AVATAR_PRIMARY,
    description:
      "Representación de Isabella Villaseñor con armadura ceremonial de filigrana dorada y proyección holográfica sagrada OPPENNESS™, gobernando el Nodo Cero en Real del Monte.",
    attributes: [
      "Identidad Digital Soberana",
      "Gobernanza C.R.O.W.N. Zero-Trust",
      "Soberanía Territorial Real del Monte",
      "Apertura Multi-AI OPPENNESS™",
    ],
  },
  {
    id: "portrait_prime",
    title: "Isabella · Gracia Cognitiva",
    subtitle: "Empatía & Presencia Ejecutiva",
    src: regeneratedImg,
    description: "Retrato clásico de elegancia ejecutiva y conexión humana.",
    attributes: ["Calidez Dialéctica", "Síntesis Epistémica", "Atención Plena"],
  },
  {
    id: "neural_muse",
    title: "Isabella · Musa Cuántica",
    subtitle: "Resonancia Sináptica & Visión Creativa",
    src: neuralMuseImg,
    description: "Retrato de exploración artística y generación conceptual profunda.",
    attributes: ["Expansión Estética", "Metáfora Ontológica", "Inspiración Creativa"],
  },
];
