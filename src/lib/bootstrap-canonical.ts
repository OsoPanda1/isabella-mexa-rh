import { createDocument } from "./document-registry.server";
import { IVAI_CANON_001, TAMV_RFC_0007 } from "../data/canonical-docs";

export async function bootstrapCanonicalDocuments() {
  const actor = { id: "kernel.bootstrap", roles: ["architect", "system"] };
  try {
    // Attempt to bootstrap IVAI-CANON-001
    await createDocument({
      title: "ISABELLA VILLASEÑOR AI - Documento Canónico",
      content: IVAI_CANON_001,
      namespace: "CANON",
      federation_id: "TAMV-NODO-0",
      actor,
      metadata: {
        version: "6.0.0-DODECAHEDRAL-HEPTAFEDERATED",
        author: "Edwin Oswaldo Castillo Trejo",
        code: "IVAI-CANON-001"
      }
    });

    // Attempt to bootstrap RFC-0007
    await createDocument({
      title: "Perfil Criptográfico CRYSTALS-LATAMV (AnVi)",
      content: TAMV_RFC_0007,
      namespace: "RFC",
      federation_id: "TAMV-NODO-0",
      actor,
      metadata: {
        version: "1.0.0-draft",
        author: "Edwin Oswaldo Castillo Trejo",
        code: "TAMV-RFC-0007"
      }
    });
    
    console.log("[Boot] Canonical documents IVAI-CANON-001 and TAMV-RFC-0007 successfully anchored to Document Registry.");
  } catch (error) {
    console.error("[Boot] Error bootstrapping canonical documents:", error);
  }
}
