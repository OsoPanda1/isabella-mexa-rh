/**
 * KORIMA DAO — Governance Engine
 * Proposals, voting, treasury, namespace management.
 * Federation: F-03 Gobernanza
 */
import { createHash } from "node:crypto";
import { appendBlock } from "./bookpi.server";
import { recordSeguimiento } from "./anubis.server";

export type VotingModel = "1p1v" | "token-weighted";
export type ProposalStatus = "draft" | "active" | "closed" | "executed" | "rejected";
export type VoteChoice = "yes" | "no" | "abstain";

export interface DaoNamespace {
  id: string;
  slug: string;
  title: string;
  description: string;
  votingModel: VotingModel;
  federation: string;
  quorum: number; // 0-1
  createdAt: string;
}

export interface DaoProposal {
  id: string;
  namespaceId: string;
  authorId: string;
  title: string;
  body: string;
  status: ProposalStatus;
  votes: { yes: number; no: number; abstain: number };
  voterIds: Set<string>;
  createdAt: string;
  closedAt?: string;
}

export interface DaoVote {
  id: string;
  proposalId: string;
  voterId: string;
  choice: VoteChoice;
  weight: number;
  ts: string;
}

const namespaces: DaoNamespace[] = [];
const proposals: DaoProposal[] = [];
const voteLog: DaoVote[] = [];

function uid(s: string) { return createHash("sha256").update(s + Date.now() + Math.random()).digest("hex").slice(0, 16); }

// Seed canonical namespaces
const SEED_NS: Omit<DaoNamespace, "id" | "createdAt">[] = [
  { slug: "atlas-core", title: "Atlas Core Governance", description: "Decisiones sobre el kernel central del metasistema TAMV", votingModel: "token-weighted", federation: "F03", quorum: 0.51 },
  { slug: "territorial-rdm", title: "RDM Digital Territory", description: "Gobernanza del nodo Real del Monte, Hidalgo", votingModel: "1p1v", federation: "F03", quorum: 0.30 },
  { slug: "economy-protocol", title: "Lucrum Prime Protocol", description: "Cambios en el protocolo económico y tarifas", votingModel: "token-weighted", federation: "F04", quorum: 0.60 },
  { slug: "security-policy", title: "Anubis Security Policy", description: "Actualizaciones a políticas de seguridad y guardas", votingModel: "1p1v", federation: "F05", quorum: 0.67 },
];
for (const n of SEED_NS) namespaces.push({ ...n, id: uid(n.slug), createdAt: new Date().toISOString() });

// Seed demo proposals
const SEED_PROPS = [
  { namespaceId: namespaces[0].id, authorId: "anubis-villaseñor", title: "Upgrade OmniKernelGatewayX6 to v7", body: "Propuesta de actualización del gateway central para soporte de 1000 req/s y nuevos módulos de seguridad post-cuántica." },
  { namespaceId: namespaces[1].id, authorId: "rdm-admin", title: "Nodo RDM: Smart Destination Integration", body: "Integrar datos de turismo y servicios de Real del Monte al grafo civilizatorio Atlas." },
  { namespaceId: namespaces[2].id, authorId: "tamv-finance", title: "Reducir tarifa de redención a $0.0015 USD", body: "Ajuste tarifario para incentivar el uso de TAMV Credits™ en el ecosistema." },
];
for (const p of SEED_PROPS) {
  proposals.push({ ...p, id: uid(p.title), status: "active", votes: { yes: Math.floor(Math.random()*20+5), no: Math.floor(Math.random()*8), abstain: Math.floor(Math.random()*3) }, voterIds: new Set(), createdAt: new Date().toISOString() });
}

export function listNamespaces(): DaoNamespace[] { return namespaces; }

export function listProposals(namespaceId?: string): DaoProposal[] {
  const src = namespaceId ? proposals.filter(p => p.namespaceId === namespaceId) : proposals;
  return src.map(p => ({ ...p, voterIds: undefined as any }));
}

export function createProposal(authorId: string, namespaceId: string, title: string, body: string): DaoProposal {
  const p: DaoProposal = { id: uid(title), namespaceId, authorId, title, body, status: "active", votes: { yes: 0, no: 0, abstain: 0 }, voterIds: new Set(), createdAt: new Date().toISOString() };
  proposals.push(p);
  appendBlock({ eventType: "dao_proposal", module: "KORIMA", action: "proposal.create", actor: authorId, data: { proposalId: p.id, title, namespaceId } });
  recordSeguimiento({ radar: "DEKATEOTL", level: "INFO", action: "DAO_PROPOSAL_CREATED", details: { proposalId: p.id, authorId, title } });
  return { ...p, voterIds: undefined as any };
}

export function castVote(proposalId: string, voterId: string, choice: VoteChoice): { proposal: DaoProposal; vote: DaoVote } {
  const p = proposals.find(x => x.id === proposalId);
  if (!p) throw new Error(`Proposal ${proposalId} not found`);
  if (p.status !== "active") throw new Error("Proposal is not active");
  if (p.voterIds.has(voterId)) throw new Error("Already voted");

  p.voterIds.add(voterId);
  p.votes[choice]++;

  const v: DaoVote = { id: uid(`${proposalId}${voterId}`), proposalId, voterId, choice, weight: 1, ts: new Date().toISOString() };
  voteLog.push(v);

  appendBlock({ eventType: "dao_vote", module: "KORIMA", action: "vote.cast", actor: voterId, data: { proposalId, choice } });
  recordSeguimiento({ radar: "DEKATEOTL", level: "INFO", action: "DAO_VOTE_CAST", details: { proposalId, voterId, choice } });

  return { proposal: { ...p, voterIds: undefined as any }, vote: v };
}

export function daoStats() {
  const activeProps = proposals.filter(p => p.status === "active").length;
  const totalVotes = voteLog.length;
  const totalVoters = new Set(voteLog.map(v => v.voterId)).size;
  return { namespaces: namespaces.length, proposals: proposals.length, activeProposals: activeProps, totalVotes, uniqueVoters: totalVoters };
}