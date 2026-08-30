import React, { useState } from "react";
import { Database, Hash, Shield, Search, CheckCircle2, Clock } from "lucide-react";
import { DemoDataNotice } from "../DemoDataNotice";

const MOCK_BLOCKS = [
  {
    blockId: "bk-993",
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    transactionCount: 2,
    prevHash: "7f8b9e...21a4",
    hash: "a39c4d...88f1",
    status: "verified",
  },
  {
    blockId: "bk-994",
    timestamp: new Date(Date.now() - 1000 * 60).toISOString(),
    transactionCount: 5,
    prevHash: "a39c4d...88f1",
    hash: "e542bd...991c",
    status: "verified",
  },
  {
    blockId: "bk-995",
    timestamp: new Date().toISOString(),
    transactionCount: 1,
    prevHash: "e542bd...991c",
    hash: "c28f11...00ae",
    status: "verified",
  },
];

export const BookPITab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
      <div className="space-y-6 animate-fade-in pb-12">
        <DemoDataNotice />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#030712] border border-slate-800 p-6 rounded-xl flex items-start gap-4">
          <div className="p-3 bg-blue-900/30 text-blue-400 rounded-lg border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">Ledger BookPI</h4>
            <p className="text-xs text-slate-400 mt-1">Cadena de procedencia $O(1)$</p>
          </div>
        </div>
        <div className="bg-[#030712] border border-slate-800 p-6 rounded-xl flex items-start gap-4">
          <div className="p-3 bg-emerald-900/30 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">Estado Integridad</h4>
            <p className="text-xs text-slate-400 mt-1">Validado por firmas PQC</p>
          </div>
        </div>
      </div>

      <div className="bg-[#050C1B] border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#030712]">
          <h3 className="font-mono text-sm font-bold text-slate-200 flex items-center gap-2">
            <Hash className="w-4 h-4 text-amber-400" />
            Bloques del Ledger (Tenant: nodo-cero-rdm)
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar por Block ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-[#0A101D] border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-wider bg-[#02050D]">
                <th className="p-4 font-semibold">Block ID</th>
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold">Tx Count</th>
                <th className="p-4 font-semibold">Prev Hash</th>
                <th className="p-4 font-semibold">Block Hash</th>
                <th className="p-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs font-mono text-slate-300">
              {MOCK_BLOCKS.filter(b => b.blockId.includes(searchTerm)).map((block, idx) => (
                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 font-bold text-sky-400">{block.blockId}</td>
                  <td className="p-4 text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(block.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-4">{block.transactionCount}</td>
                  <td className="p-4 text-slate-500">{block.prevHash}</td>
                  <td className="p-4 text-amber-300/80">{block.hash}</td>
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/30 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="uppercase text-[9px] font-bold tracking-wider">{block.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
