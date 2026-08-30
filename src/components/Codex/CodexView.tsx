import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, FileText, Lock, RefreshCw } from "lucide-react";
import { useServerFn } from "../../lib/tanstack-polyfill";
import { getRegistrySnapshot } from "../../lib/atlas.functions";

type DocumentVersion = {
  content?: unknown;
  canonical_hash?: unknown;
  metadata?: unknown;
  signature?: unknown;
};

type CodexDocument = {
  document_uid: string;
  namespace?: string;
  title?: string;
  state?: string;
  federation_id?: string;
  versions?: DocumentVersion[];
  anchors?: unknown;
  created_by?: unknown;
  created_at?: unknown;
};

type CodexSnapshot = {
  documents?: unknown;
  stats?: unknown;
};

const readText = (value: unknown, fallback = "Sin información") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const readDocuments = (value: unknown): CodexDocument[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (document): document is CodexDocument =>
      Boolean(document) &&
      typeof document === "object" &&
      typeof (document as CodexDocument).document_uid === "string",
  );
};

const latestVersion = (document: CodexDocument): DocumentVersion | null => {
  const versions = Array.isArray(document.versions) ? document.versions : [];
  return versions.length > 0 ? versions[versions.length - 1] : null;
};

const shortId = (value: string) => {
  const parts = value.split("-");
  return parts[parts.length - 1] || value;
};

const shortHash = (value: unknown) => {
  const hash = readText(value, "No disponible");
  return hash.length > 18 ? `${hash.slice(0, 18)}…` : hash;
};

const statusLabel = (state: string) => {
  const labels: Record<string, string> = {
    published: "Publicado",
    draft: "Borrador",
    archived: "Archivado",
    pending: "Pendiente",
  };
  return labels[state.toLowerCase()] ?? "Disponible";
};

const statusClass = (state: string) => {
  switch (state.toLowerCase()) {
    case "published":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "draft":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "archived":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  }
};

export const CodexView: React.FC = () => {
  const getSnapshot = useServerFn(getRegistrySnapshot);
  const [documents, setDocuments] = useState<CodexDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = (await getSnapshot()) as CodexSnapshot;
        const nextDocuments = readDocuments(response?.documents);
        if (!active) return;
        setDocuments(nextDocuments);
        setSelectedId((current) =>
          current && nextDocuments.some((document) => document.document_uid === current)
            ? current
            : nextDocuments[0]?.document_uid ?? null,
        );
      } catch {
        if (!active) return;
        setError("No pudimos cargar los documentos. Intenta nuevamente.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [getSnapshot, retryKey]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.document_uid === selectedId) ?? null,
    [documents, selectedId],
  );

  const selectedVersion = selectedDocument ? latestVersion(selectedDocument) : null;
  const selectedState = readText(selectedDocument?.state, "available");

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12" aria-busy="true">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 animate-pulse text-sky-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-400">Cargando documentos…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-8 text-center" role="alert">
          <p className="text-sm text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Intentar de nuevo
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-200 sm:py-12">
      <header className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Códice Canónico
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Consulta los documentos oficiales del registro Atlas.
        </p>
      </header>

      {documents.length === 0 ? (
        <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center">
          <FileText className="mx-auto h-7 w-7 text-slate-500" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-200">Aún no hay documentos</h2>
          <p className="mt-1 text-sm text-slate-500">Cuando se publique el primer documento aparecerá aquí.</p>
        </section>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside aria-label="Lista de documentos">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Documentos
              </h2>
              <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
                {documents.length}
              </span>
            </div>

            <div className="space-y-2">
              {documents.map((document) => {
                const state = readText(document.state, "available");
                const selected = document.document_uid === selectedId;
                return (
                  <button
                    key={document.document_uid}
                    type="button"
                    onClick={() => {
                      setSelectedId(document.document_uid);
                      setShowTechnicalDetails(false);
                    }}
                    aria-current={selected ? "page" : undefined}
                    className={`w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${selected ? "border-sky-400/50 bg-sky-400/10 shadow-lg shadow-sky-950/20" : "border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900/70"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${statusClass(state)}`}>
                        {statusLabel(state)}
                      </span>
                      {selected && <ChevronDown className="h-4 w-4 rotate-[-90deg] text-sky-300" aria-hidden="true" />}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-slate-100">
                      {readText(document.title, "Documento sin título")}
                    </p>
                    <p className="mt-2 truncate text-[10px] text-slate-500">
                      {readText(document.namespace, "Registro Atlas")}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section aria-label="Documento seleccionado" className="min-w-0">
            {selectedDocument && selectedVersion ? (
              <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-2xl shadow-black/20">
                <header className="border-b border-slate-800/80 p-5 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass(selectedState)}`}>
                      {statusLabel(selectedState)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {readText(selectedDocument.namespace, "Registro Atlas")}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    {readText(selectedDocument.title, "Documento sin título")}
                  </h2>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span>Documento {shortId(selectedDocument.document_uid)}</span>
                    <span>Actualizado {readText(selectedDocument.created_at, "sin fecha")}</span>
                  </div>
                </header>

                <div className="p-5 sm:p-7">
                  <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-300">
                    {readText(selectedVersion.content, "Este documento no contiene contenido visible.")}
                  </div>
                </div>

                <footer className="border-t border-slate-800/80 bg-slate-950/50">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails((value) => !value)}
                    aria-expanded={showTechnicalDetails}
                    className="flex w-full items-center justify-between px-5 py-4 text-left text-xs font-medium text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 sm:px-7"
                  >
                    <span className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      Detalles técnicos
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showTechnicalDetails ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>

                  {showTechnicalDetails && (
                    <div className="border-t border-slate-800/80 px-5 pb-5 pt-4 sm:px-7">
                      <dl className="grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-slate-500">Identificador completo</dt>
                          <dd className="mt-1 break-all font-mono text-slate-300">{selectedDocument.document_uid}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Federación</dt>
                          <dd className="mt-1 break-all font-mono text-slate-300">{readText(selectedDocument.federation_id)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Hash canónico</dt>
                          <dd className="mt-1 break-all font-mono text-slate-300">{shortHash(selectedVersion.canonical_hash)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Creado por</dt>
                          <dd className="mt-1 break-all font-mono text-slate-300">{readText(selectedDocument.created_by)}</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </footer>
              </article>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-10 text-center text-sm text-slate-500">
                Este documento no tiene una versión disponible para mostrar.
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
};
