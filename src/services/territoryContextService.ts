/**
 * Territory-Context Integration Service Layer
 * C.R.O.W.N. Orchestrator :: Nodo Cero Territorial Knowledge Engine
 * 
 * Provides academic, real-time and historical telemetry for Real del Monte,
 * enabling sovereign contextualization of all cognitive inferences.
 */

export interface TerritoryCoordinates {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  region: string;
  puebloMagicoDesignation: number; // 2004
}

export interface TerritorySensorsTelemetry {
  temperatureCelsius: number;
  humidityPercent: number;
  barometricPressureHpa: number;
  mountainFogIndex: "despejado" | "niebla_ligera" | "niebla_densa_serrana";
  nodeMeshLatencyMs: number;
  localEnclaveStatus: "online_sovereign" | "federated" | "degraded";
  dataSovereigntyPercent: number;
}

export interface TerritoryHeritageEntity {
  id: string;
  name: string;
  periodOrYear: string;
  category: "mineria" | "arquitectura" | "gastronomia" | "archivo" | "naturaleza";
  description: string;
  coordinates?: { lat: number; lng: number };
  culturalSignificance: string;
}

export interface TerritoryContextSnapshot {
  timestamp: string;
  nodeId: string;
  nodeName: string;
  coordinates: TerritoryCoordinates;
  telemetry: TerritorySensorsTelemetry;
  jurisdiction: {
    state: "Hidalgo";
    country: "México";
    municipality: "Mineral del Monte";
    sovereignZone: "Sierra de Pachuca - Nodo Cero Enclave";
    legalFramework: "Protocolo de Soberanía Digital Territorial RDM";
  };
  heritageEntities: TerritoryHeritageEntity[];
  activeSovereignVariables: {
    miningHeritageAlignment: boolean;
    localLanguageVariations: string[];
    cornishMexicanSynthesisFactor: number;
    sovereignDataBoundary: "strictly_local" | "federated_monitored";
  };
}

export const REAL_DEL_MONTE_HERITAGE_ENTITIES: TerritoryHeritageEntity[] = [
  {
    id: "mina_acosta",
    name: "Mina de Acosta",
    periodOrYear: "1727",
    category: "mineria",
    description: "Una de las minas más emblemáticas del distrito minero Real del Monte-Pachuca. Conserva vestigios de la época novohispana, británica y norteamericana con tiro de mina y casa de máquinas de vapor Cornish.",
    culturalSignificance: "Testimonio vivo de la transferencia tecnológica minera entre el Reino Unido y México en el siglo XIX.",
  },
  {
    id: "panteon_ingles",
    name: "Panteón Inglés de Real del Monte",
    periodOrYear: "1851",
    category: "arquitectura",
    description: "Monumento funerario neogótico y romántico emplazado en la cima boscosa del Cerro del Judío, rodeado de oyameles y neblina permanente. Todas las tumbas están orientadas hacia Inglaterra.",
    culturalSignificance: "Símbolo de hermandad histórica, memoria colectiva y respeto transatlántico.",
  },
  {
    id: "mina_la_dificultad",
    name: "Mina La Dificultad & Museo de Sitio",
    periodOrYear: "1889",
    category: "mineria",
    description: "Portentoso conjunto industrial con chimenea de mampostería y casa de máquinas de vapor de gran capacidad. Marca la transición a la era del vapor y la electricidad.",
    culturalSignificance: "Obra cumbre de la arquitectura industrial mexicana de finales del siglo XIX.",
  },
  {
    id: "museo_del_paste",
    name: "Museo Histórico del Paste",
    periodOrYear: "Tradición desde 1824",
    category: "gastronomia",
    description: "Patrimonio gastronómico inmaterial de Real del Monte derivado del 'pasty' minero de Cornualles, adaptado con papa, poro, chiles y carnes locales con borde trenzado protector.",
    culturalSignificance: "Fusión cultural gastronómica declarada Patrimonio Cultural del Estado de Hidalgo.",
  },
  {
    id: "penas_cargadas",
    name: "Parque Ecológico Peñas Cargadas",
    periodOrYear: "Ancestral / Geológico",
    category: "naturaleza",
    description: "Formaciones basálticas colosales y bosques de coníferas que resguardan la cuenca hidrológica y la biodiversidad de la Sierra de Pachuca.",
    culturalSignificance: "Reserva natural y santuario geológico del territorio de Real del Monte.",
  },
  {
    id: "senor_zelontla",
    name: "Santuario del Señor de Zelontla",
    periodOrYear: "Siglo XVIII",
    category: "arquitectura",
    description: "Templo venerado por los mineros locales que encomendaban sus vidas antes de descender a las profundidades de los tiros mineros.",
    culturalSignificance: "Centro espiritual y de cohesión comunitaria tradicional de la población minera.",
  },
];

class TerritoryContextService {
  private static instance: TerritoryContextService;

  private currentTelemetry: TerritorySensorsTelemetry = {
    temperatureCelsius: 14.4,
    humidityPercent: 72,
    barometricPressureHpa: 738,
    mountainFogIndex: "niebla_ligera",
    nodeMeshLatencyMs: 1.8,
    localEnclaveStatus: "online_sovereign",
    dataSovereigntyPercent: 100,
  };

  private constructor() {
    // Periodically update subtle simulated telemetry
    if (typeof window !== "undefined") {
      setInterval(() => {
        this.updateTelemetryFluctuations();
      }, 15000);
    }
  }

  public static getInstance(): TerritoryContextService {
    if (!TerritoryContextService.instance) {
      TerritoryContextService.instance = new TerritoryContextService();
    }
    return TerritoryContextService.instance;
  }

  private updateTelemetryFluctuations() {
    const tempDelta = (Math.random() - 0.5) * 0.4;
    const humidityDelta = (Math.random() - 0.5) * 2;
    const latencyDelta = (Math.random() - 0.5) * 0.3;

    this.currentTelemetry = {
      ...this.currentTelemetry,
      temperatureCelsius: parseFloat(Math.max(10, Math.min(22, this.currentTelemetry.temperatureCelsius + tempDelta)).toFixed(1)),
      humidityPercent: Math.round(Math.max(40, Math.min(95, this.currentTelemetry.humidityPercent + humidityDelta))),
      nodeMeshLatencyMs: parseFloat(Math.max(0.8, Math.min(4.5, this.currentTelemetry.nodeMeshLatencyMs + latencyDelta)).toFixed(1)),
    };
  }

  public getSnapshot(): TerritoryContextSnapshot {
    return {
      timestamp: new Date().toISOString(),
      nodeId: "nd-rdm-nodo-cero",
      nodeName: "Nodo Cero :: Real del Monte Sovereign Hub",
      coordinates: {
        latitude: 20.1419,
        longitude: -98.6738,
        altitudeMeters: 2760,
        region: "Sierra de Pachuca, Estado de Hidalgo, México",
        puebloMagicoDesignation: 2004,
      },
      telemetry: { ...this.currentTelemetry },
      jurisdiction: {
        state: "Hidalgo",
        country: "México",
        municipality: "Mineral del Monte",
        sovereignZone: "Sierra de Pachuca - Nodo Cero Enclave",
        legalFramework: "Protocolo de Soberanía Digital Territorial RDM",
      },
      heritageEntities: REAL_DEL_MONTE_HERITAGE_ENTITIES,
      activeSovereignVariables: {
        miningHeritageAlignment: true,
        localLanguageVariations: ["español_mexicano_hidalguense", "terminologia_minera_cornish", "nahuatl_toponimico"],
        cornishMexicanSynthesisFactor: 0.98,
        sovereignDataBoundary: "strictly_local",
      },
    };
  }

  public queryHeritage(query?: string, category?: string): TerritoryHeritageEntity[] {
    let list = REAL_DEL_MONTE_HERITAGE_ENTITIES;
    if (category && category !== "all") {
      list = list.filter((item) => item.category === category);
    }
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.culturalSignificance.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public injectTerritoryContextIntoPrompt(basePrompt: string): string {
    const snapshot = this.getSnapshot();
    const formattedContext = `
[CONTEXTO TERRITORIAL SOBERANO NODO CERO - REAL DEL MONTE]
- Ubicación: ${snapshot.coordinates.region} (${snapshot.coordinates.altitudeMeters} msnm)
- Telemetría Ambiental: ${snapshot.telemetry.temperatureCelsius}°C, ${snapshot.telemetry.humidityPercent}% humedad, Presión: ${snapshot.telemetry.barometricPressureHpa} hPa
- Entidades Patrimoniales Clave: Mina de Acosta (1727), Panteón Inglés (1851), Mina La Dificultad (1889), Museo del Paste.
- Soberanía de Datos: ${snapshot.activeSovereignVariables.sovereignDataBoundary} (Enclave Seguro Nodo Cero).
`;
    return `${formattedContext}\n${basePrompt}`;
  }
}

export const territoryContextService = TerritoryContextService.getInstance();
