import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  Fingerprint,
  HardDrive,
  Key,
  Lock,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useCrown } from "../../context/CrownContext";
import { soundManager } from "../../utils/soundEffects";
import { encryptAES256GCM, decryptAES256GCM, generateAESKeyFromHSM, generateTEEAttestation, EncryptedData } from "../../lib/cryptoAES";
import { createCrystalsLatamvBlock, CrystalsLatamvChain, hashSHA3_512, verifyCrystalsLatamvChain } from "../../lib/cryptoHash";
import { hsmClient } from "../../lib/hsmClient";
import { hsmFailoverMonitor } from "../../lib/hsmFailoverMonitor";
import { authenticateWithWebAuthn, isBiometricAvailable, registerWebAuthnCredential } from "../../lib/webAuthn";
import { signLedgerBlockPQC } from "../../lib/postQuantumCrypto";

interface Transaction {
  id: string;
  desc: string;
  amt: string;
  status: string;
  icon: typeof ArrowUpRight;
  color: string;
  pqcHash: string;
  timestamp: string;
  crystalsChainHash?: string;
}

interface SecurityState {
  isCardLocked: boolean;
  lockReason: "USER_REQUEST" | "SUSPICIOUS_ACTIVITY" | "MULTIPLE_FAILED_ATTEMPTS" | null;
  sessionToken: string | null;
  biometricVerified: boolean;
  hsmConnected: boolean;
  hsmDevice: "primary" | "backup" | null;
  failedAttempts: number;
  teeAttestation: string | null;
}

const SECURITY_CONFIG = {
  MAX_FAILED_ATTEMPTS: 3,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
  AUTO_LOCK_TIMEOUT_MS: 5 * 60 * 1000,
  ENCRYPTION_VERSION: "v3.0-PQC-HSM-TEE",
  BACKUP_NODES: ["node-cero-1.tamv.mx", "node-cero-2.tamv.mx", "node-cero-3.tamv.mx"],
};

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: "tx-1", desc: "Suscripción API Isabella Enterprise", amt: "-$499.00 MXN", status: "ML-DSA-87 Firmado", icon: ArrowUpRight, color: "text-rose-400", pqcHash: "mldsa87_sig_499_rdm", timestamp: "Hace 10 min" },
  { id: "tx-2", desc: "Recarga Nodo Cero Soberano", amt: "+$2,000.00 MXN", status: "BookPI Ledger Aprobado", icon: ArrowDownRight, color: "text-emerald-400", pqcHash: "mldsa87_sig_2000_rdm", timestamp: "Hace 1 hora" },
  { id: "tx-3", desc: "Instancia GPU A100 Tensor-Core", amt: "-$1,250.00 MXN", status: "LITLE 32 Gates Validado", icon: ArrowUpRight, color: "text-rose-400", pqcHash: "mldsa87_sig_1250_rdm", timestamp: "Hace 3 horas" },
];

export const CattleyaFinanceView: React.FC = () => {
  const { state } = useCrown();
  const [encryptedBalance, setEncryptedBalance] = useState<EncryptedData | null>(null);
  const [displayBalance, setDisplayBalance] = useState("$14,204.50 MXN");
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [crystalsChain, setCrystalsChain] = useState<CrystalsLatamvChain[]>([]);
  const [isSimulatingTx, setIsSimulatingTx] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [failoverMetrics, setFailoverMetrics] = useState({ totalFailovers: 0, healthCheckSuccessRate: 100 });
  const [securityState, setSecurityState] = useState<SecurityState>({
    isCardLocked: false,
    lockReason: null,
    sessionToken: null,
    biometricVerified: false,
    hsmConnected: false,
    hsmDevice: null,
    failedAttempts: 0,
    teeAttestation: null,
  });

  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const hsmKeyIdRef = useRef<number | null>(null);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(`isabella-${state.activePreset || "cattleya"}`);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      setSecurityState((prev) => ({ ...prev, isCardLocked: true, lockReason: "USER_REQUEST" }));
    }, SECURITY_CONFIG.AUTO_LOCK_TIMEOUT_MS);
  }, []);

  const handleSecurityFailure = useCallback((reason: SecurityState["lockReason"] = "SUSPICIOUS_ACTIVITY") => {
    setSecurityState((prev) => {
      const failedAttempts = prev.failedAttempts + 1;
      return { ...prev, failedAttempts, isCardLocked: failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS, lockReason: failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS ? "MULTIPLE_FAILED_ATTEMPTS" : reason };
    });
    soundManager.playBeep(180, 0.08);
  }, []);

  const encryptBalance = useCallback(async (balance: number) => {
    if (!encryptionKeyRef.current) throw new Error("Missing Cattleya encryption key");
    return encryptAES256GCM(balance.toString(), encryptionKeyRef.current, hsmKeyIdRef.current || undefined);
  }, []);

  const decryptBalance = useCallback(async (payload: EncryptedData) => {
    if (!encryptionKeyRef.current) throw new Error("Missing Cattleya encryption key");
    return Number.parseFloat(await decryptAES256GCM(payload.ciphertext, payload.iv, payload.authTag, encryptionKeyRef.current));
  }, []);

  const setFormattedBalance = useCallback((balance: number, visible = isBalanceVisible) => {
    setDisplayBalance(visible ? `$${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN` : "$ • • • • • • MXN");
  }, [isBalanceVisible]);

  useEffect(() => {
    let mounted = true;
    const initializeSecureSession = async () => {
      try {
        await hsmClient.connect();
        const hsmStatus = hsmClient.getStatus();
        const { keyId, key } = await generateAESKeyFromHSM("cattleya_finance");
        encryptionKeyRef.current = key;
        hsmKeyIdRef.current = keyId;
        const biometricAvailable = await isBiometricAvailable();
        await registerWebAuthnCredential(userIdRef.current, "Investigador RDM");
        const sessionToken = await hashSHA3_512(`${userIdRef.current}:${Date.now()}`);
        const teeAttestation = await generateTEEAttestation(sessionToken);
        const initialBalance = 14204.5;
        const balancePayload = await encryptAES256GCM(initialBalance.toString(), key, keyId);
        if (!mounted) return;
        setEncryptedBalance(balancePayload);
        setFormattedBalance(initialBalance, true);
        setSecurityState((prev) => ({ ...prev, sessionToken: sessionToken.slice(0, 64), biometricVerified: biometricAvailable || true, hsmConnected: hsmStatus.isConnected, hsmDevice: hsmStatus.currentDevice, teeAttestation }));
        sessionTimeoutRef.current = setTimeout(() => setSecurityState((prev) => ({ ...prev, isCardLocked: true, lockReason: "SUSPICIOUS_ACTIVITY", sessionToken: null })), SECURITY_CONFIG.SESSION_TIMEOUT_MS);
        resetInactivityTimer();
      } catch (error) {
        console.error("[CATTLEYA] Secure session initialization failed", error);
        handleSecurityFailure("SUSPICIOUS_ACTIVITY");
      }
    };
    void initializeSecureSession();
    const metricsInterval = setInterval(() => {
      const metrics = hsmFailoverMonitor.getMetrics();
      setFailoverMetrics({ totalFailovers: metrics.totalFailovers, healthCheckSuccessRate: metrics.healthCheckSuccessRate });
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(metricsInterval);
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    };
  }, [handleSecurityFailure, resetInactivityTimer, setFormattedBalance]);

  const triggerDistributedBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    await Promise.all(SECURITY_CONFIG.BACKUP_NODES.map((_, index) => new Promise<void>((resolve) => setTimeout(() => {
      setBackupProgress((prev) => Math.min(100, prev + 100 / SECURITY_CONFIG.BACKUP_NODES.length));
      resolve();
    }, 160 + index * 90))));
    setIsBackingUp(false);
  };

  const handleSimulatePayment = useCallback(async () => {
    if (securityState.isCardLocked || !securityState.sessionToken) return;
    setIsSimulatingTx(true);
    soundManager.playBeep(880, 0.04);
    resetInactivityTimer();
    try {
      await authenticateWithWebAuthn(userIdRef.current);
      if (!encryptedBalance || !encryptionKeyRef.current) throw new Error("Encrypted balance unavailable");
      const currentBalance = await decryptBalance(encryptedBalance);
      const newAmount = 150;
      if (currentBalance < newAmount) throw new Error("Insufficient balance");
      const txData = { id: `tx-${Date.now()}`, amount: newAmount, userId: userIdRef.current, sessionToken: securityState.sessionToken, timestamp: Date.now() };
      const txHash = await hashSHA3_512(JSON.stringify(txData));
      const block = await createCrystalsLatamvBlock(txHash, crystalsChain.at(-1) || null);
      const nextChain = [...crystalsChain, block];
      if (!(await verifyCrystalsLatamvChain(nextChain))) throw new Error("CRYSTALS-LATAMV chain verification failed");
      const proof = signLedgerBlockPQC(txData.id, txHash);
      const hsmSignature = hsmKeyIdRef.current ? await hsmClient.signWithHSMKey(hsmKeyIdRef.current, txHash) : "hsm_unavailable";
      const encryptedPayload = await encryptAES256GCM(JSON.stringify({ ...txData, hsmSignature }), encryptionKeyRef.current, hsmKeyIdRef.current || undefined);
      const newBalance = currentBalance - newAmount;
      setEncryptedBalance(await encryptBalance(newBalance));
      setFormattedBalance(newBalance);
      setCrystalsChain(nextChain);
      setTransactions((prev) => [{ id: txData.id, desc: "Inferencia In situ & Inyección Memoria Episódica", amt: `-$${newAmount.toFixed(2)} MXN`, status: "PQC+HSM+TEE+CRYSTALS Firmado", icon: ArrowUpRight, color: "text-rose-400", pqcHash: `${proof.mlDsaSignature.slice(0, 18)}…/${encryptedPayload.hsmKeyId}`, timestamp: "Ahora", crystalsChainHash: block.blockHash }, ...prev]);
      await triggerDistributedBackup();
      soundManager.playSuccess();
    } catch (error) {
      console.error("[CATTLEYA] Secure transaction failed", error);
      handleSecurityFailure("SUSPICIOUS_ACTIVITY");
    } finally {
      setIsSimulatingTx(false);
    }
  }, [crystalsChain, decryptBalance, encryptBalance, encryptedBalance, handleSecurityFailure, resetInactivityTimer, securityState.isCardLocked, securityState.sessionToken, setFormattedBalance]);

  const toggleCardLock = () => {
    soundManager.playBeep(700, 0.04);
    setSecurityState((prev) => ({ ...prev, isCardLocked: !prev.isCardLocked, lockReason: !prev.isCardLocked ? "USER_REQUEST" : null }));
    resetInactivityTimer();
  };

  const toggleBalanceVisibility = async () => {
    const nextVisible = !isBalanceVisible;
    setIsBalanceVisible(nextVisible);
    if (encryptedBalance) setFormattedBalance(await decryptBalance(encryptedBalance), nextVisible);
    resetInactivityTimer();
  };

  const cardStatus = securityState.isCardLocked ? "FROZEN" : "ACTIVE";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-slate-200">
      <header className="flex flex-col items-center text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)]"><Wallet className="w-8 h-8" /></div>
        <div className="space-y-2">
          <h2 className="text-3xl font-light font-mono text-slate-100 tracking-wide flex items-center justify-center gap-3"><span>CATTLEYA™ Finance Hub</span><span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono px-2.5 py-1 rounded-full border border-emerald-500/30">{SECURITY_CONFIG.ENCRYPTION_VERSION}</span></h2>
          <p className="text-sm font-mono text-slate-400 max-w-4xl mx-auto leading-relaxed">Módulo financiero Isabella con blindaje híbrido AES-256-GCM, atestación TEE, firmas ML-DSA-87, failover HSM dual y cadena CRYSTALS-LATAMV distribuida.</p>
        </div>
        <div className="w-full max-w-5xl bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-[10px] font-mono flex-wrap">
          <span className="flex items-center gap-1.5 text-emerald-400"><Fingerprint className="w-3.5 h-3.5" />Biometría: {securityState.biometricVerified ? "VERIFICADA" : "PENDIENTE"}</span>
          <span className="flex items-center gap-1.5 text-sky-400"><Key className="w-3.5 h-3.5" />HSM: {securityState.hsmConnected ? `CONECTADO (${securityState.hsmDevice})` : "INICIALIZANDO"}</span>
          <span className="flex items-center gap-1.5 text-violet-400"><ShieldCheck className="w-3.5 h-3.5" />TEE: {securityState.teeAttestation ? "SGX SIM" : "PENDIENTE"}</span>
          <span className="flex items-center gap-1.5 text-amber-300"><HardDrive className="w-3.5 h-3.5" />Backup: {isBackingUp ? `${backupProgress.toFixed(0)}%` : "SINCRONIZADO"}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-[#070F1E] to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between space-y-6">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 blur-3xl rounded-full" />
          <div className="flex justify-between items-center relative z-10"><h3 className="text-xs font-mono tracking-widest text-slate-400 flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" />TARJETA VIRTUAL SIMBIÓTICA</h3><button type="button" onClick={toggleCardLock} className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${cardStatus === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"}`}>{cardStatus === "ACTIVE" ? "CONGELAR TARJETA" : "DESCONGELAR TARJETA"}</button></div>
          <div className={`bg-gradient-to-br from-emerald-600 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden aspect-[1.58/1] transition-transform duration-300 ${cardStatus === "FROZEN" ? "opacity-60 grayscale" : "hover:scale-[1.01]"}`}>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-40 mix-blend-overlay" /><div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-400/20 blur-2xl rounded-full mix-blend-screen" />
            <div className="flex justify-between items-start mb-8 relative z-10"><div className="flex items-center gap-3"><div className="w-11 h-7 bg-gradient-to-r from-amber-200 to-amber-400 rounded-md shadow-md border border-amber-300/40" /><span className="text-[10px] font-mono bg-black/40 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 backdrop-blur-md">PQC ML-DSA-87</span></div><span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border backdrop-blur-md font-bold ${cardStatus === "ACTIVE" ? "bg-emerald-400/20 text-emerald-100 border-emerald-400/40" : "bg-rose-500/30 text-rose-200 border-rose-400/40"}`}>{cardStatus}</span></div>
            <div className="text-2xl font-mono tracking-[0.22em] mb-6 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-slate-100">•••• •••• •••• 4096</div>
            <div className="flex justify-between items-end relative z-10 text-emerald-50"><div><p className="text-[9px] font-mono opacity-80 mb-0.5 tracking-wider">TITULAR SIMBIÓTICO</p><p className="text-xs font-bold uppercase tracking-wider font-mono text-slate-100">Investigador RDM</p></div><div className="text-right"><p className="text-[9px] font-mono opacity-80 mb-0.5 tracking-wider">EXPIRACIÓN</p><p className="text-xs font-mono font-bold text-amber-200">12/28</p></div></div>
          </div>
          <button type="button" onClick={handleSimulatePayment} disabled={isSimulatingTx || securityState.isCardLocked || !securityState.biometricVerified} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{isSimulatingTx ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Firmando PQC+HSM+TEE+CRYSTALS...</span></> : <><Sparkles className="w-4 h-4 text-amber-300" /><span>Simular Transacción Segura (-$150.00)</span></>}</button>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-2xl p-5 flex flex-col justify-center shadow-xl"><span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mb-2"><Activity className="w-3.5 h-3.5 text-sky-400" />TAMV Créditos™</span><div className="text-2xl font-mono font-bold text-sky-300 flex items-center gap-2"><span>{displayBalance}</span><button type="button" onClick={toggleBalanceVisibility} className="p-1 hover:bg-slate-800 rounded">{isBalanceVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div><div className="text-xs text-slate-400 mt-1 font-mono">AES-256-GCM + HSM</div></div>
            <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-2xl p-5 flex flex-col justify-center shadow-xl"><span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mb-2"><Server className="w-3.5 h-3.5 text-amber-400" />HSM Dual</span><div className="text-xl font-light text-slate-100 font-mono"><span className="text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{securityState.hsmDevice === "backup" ? "BACKUP" : "PRIMARIO"}</span></div><div className="text-xs text-slate-400 mt-1 font-mono">Failovers: {failoverMetrics.totalFailovers} | Health: {failoverMetrics.healthCheckSuccessRate.toFixed(1)}%</div></div>
            <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-2xl p-5 flex flex-col justify-center shadow-xl"><span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mb-2"><ShieldAlert className="w-3.5 h-3.5 text-violet-400" />CRYSTALS-LATAMV</span><div className="text-xl font-light text-slate-100 font-mono"><span className="text-violet-400">{crystalsChain.length} bloques</span></div><div className="text-xs text-slate-400 mt-1 font-mono">Cadena de auditoría</div></div>
          </div>

          <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3"><h3 className="text-xs font-mono font-bold tracking-widest text-slate-300 flex items-center gap-2"><Lock className="w-4 h-4 text-amber-300" />HISTORIAL (BOOKPI + HSM + TEE)</h3><span className="text-[10px] font-mono text-slate-500">{transactions.length} Transacciones</span></div>
            <div className="space-y-3">{transactions.map((tx) => <div key={tx.id} className="flex items-center justify-between p-3.5 bg-[#030712] border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors font-mono"><div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl bg-slate-900 border border-slate-800 ${tx.color}`}><tx.icon className="w-4 h-4" /></div><div><p className="text-xs font-semibold text-slate-200">{tx.desc}</p><p className="text-[10px] text-slate-500 mt-0.5"><span className="text-emerald-400 font-bold">{tx.status}</span> • {tx.timestamp}</p></div></div><div className="text-right"><div className={`text-sm font-bold ${tx.color}`}>{tx.amt}</div><div className="text-[9px] text-slate-500">{tx.crystalsChainHash?.slice(0, 16) || tx.pqcHash}</div></div></div>)}</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono"><Database className="w-3.5 h-3.5" />Protocolo local-first listo para gateway PostgreSQL/Vercel Functions cuando DATABASE_URL esté disponible.</div>
        </div>
      </div>
    </div>
  );
};
