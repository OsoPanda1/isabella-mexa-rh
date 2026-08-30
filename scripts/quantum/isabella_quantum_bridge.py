#!/usr/bin/env python3
"""Isabella Quantum Bridge: governed JSONL runtime."""
from __future__ import annotations
import argparse, base64, hashlib, hmac, importlib.util, json, math, os, platform, secrets, sqlite3, sys, time, uuid
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

SYSTEM="isabella-core"; POLICY="EOCT_STRICT_V2"; VERSION="quantum-bridge-v7"; REQ_SCHEMA="isabella.quantum.request.v7"; RES_SCHEMA="isabella.quantum.response.v7"
MAX_IN=int(os.getenv("QUANTUM_MAX_INPUT_BYTES","131072")); MAX_OUT=int(os.getenv("QUANTUM_MAX_OUTPUT_BYTES","4194304")); MAX_WIRES=int(os.getenv("QUANTUM_MAX_WIRES","32")); MAX_SHOTS=int(os.getenv("QUANTUM_MAX_SHOTS","500000")); MAX_FEATURES=int(os.getenv("QUANTUM_MAX_FEATURES","64")); MAX_WEIGHTS=int(os.getenv("QUANTUM_MAX_WEIGHTS","128")); MAX_LATENCY=int(os.getenv("QUANTUM_MAX_LATENCY_MS","45000")); AUTH_SECRET=os.getenv("ISABELLA_AUTH_SECRET"); KEY_DIR=Path(os.getenv("ISABELLA_KEY_DIR","./secrets/isabella")); AUDIT_DB=Path(os.getenv("ISABELLA_AUDIT_DB","./data/isabella-audit.db"))

class F(str,Enum): SECURITY="SECURITY_IDENTITY_FEDERATION"; GOVERNANCE="GOVERNANCE_POLICY_FEDERATION"; DEVICE="DEVICE_MESH_FEDERATION"; STORAGE="STORAGE_STATE_FEDERATION"; QUANTUM="QUANTUM_ENGINE_FEDERATION"
class E(Exception):
    def __init__(self,code:str,message:str,federation:F,status:int=400,retryable:bool=False): self.code=code; self.message=message; self.federation=federation; self.status=status; self.retryable=retryable
@dataclass(frozen=True)
class Device: name:str; implementation:str; modules:tuple[str,...]; scopes:tuple[str,...]; mode:str; remote:bool=False
@dataclass(frozen=True)
class Request:
    request_id:str; tenant_id:str; actor_id:str; task:str; provider:str; wires:int; shots:int|None; features:tuple[float,...]; weights:tuple[float,...]; scopes:tuple[str,...]; ansatz:str; policy_version:str; request_hash:str; circuit_hash:str
DEVICES={
 "default.qubit":Device("default.qubit","PENNYLANE_SIMULATOR",("pennylane",),("quantum:execute",),"quantum_simulator"),
 "lightning.qubit":Device("lightning.qubit","PENNYLANE_LIGHTNING",("pennylane","pennylane_lightning"),("quantum:execute","quantum:lightning"),"quantum_simulator"),
 "qiskit.aer":Device("qiskit.aer","PENNYLANE_QISKIT_AER",("pennylane","pennylane_qiskit"),("quantum:execute","quantum:qiskit"),"quantum_simulator"),
}

def fail(code,msg,fed,status=400,retryable=False): raise E(code,msg,fed,status,retryable)
def canonical(x:Any)->bytes:
    try:return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    except Exception as ex: fail("CANONICALIZATION_FAILED",str(ex),F.STORAGE)
def digest(x:Any)->str:return "sha3-512:"+hashlib.sha3_512(canonical(x)).hexdigest()
def text(x:Any,name:str,default=None,maxlen=256)->str:
    if x is None and default is not None:x=default
    if not isinstance(x,str) or not x.strip():fail("INVALID_FIELD",name,F.SECURITY)
    x=x.strip()
    if len(x)>maxlen:fail("FIELD_TOO_LONG",name,F.SECURITY)
    return x
def number(x:Any,name:str)->float:
    if isinstance(x,bool):fail("INVALID_NUMBER",name,F.GOVERNANCE)
    try:y=float(x)
    except Exception:fail("INVALID_NUMBER",name,F.GOVERNANCE)
    if not math.isfinite(y):fail("NON_FINITE_NUMBER",name,F.GOVERNANCE)
    return y
def ints(x:Any,name:str,lo:int,hi:int)->int:
    if isinstance(x,bool):fail("INVALID_INTEGER",name,F.GOVERNANCE)
    try:y=int(x)
    except Exception:fail("INVALID_INTEGER",name,F.GOVERNANCE)
    if not lo<=y<=hi:fail(name.upper()+"_LIMIT_EXCEEDED",f"{name} outside policy",F.GOVERNANCE)
    return y
def nums(x:Any,name:str,limit:int)->tuple[float,...]:
    if x is None:return ()
    if not isinstance(x,list) or len(x)>limit:fail("INVALID_ARRAY",name,F.GOVERNANCE)
    return tuple(number(v,name) for v in x)
def modules(ds:tuple[str,...])->dict[str,bool]:return {m:importlib.util.find_spec(m) is not None for m in ds}

class Replay:
    def __init__(self):self.seen:dict[str,int]={}
    def check(self,nonce:str,timestamp:int):
        now=int(time.time()); self.seen={k:v for k,v in self.seen.items() if now-v<300}
        if abs(now-timestamp)>300:fail("REQUEST_TIMESTAMP_EXPIRED","timestamp outside replay window",F.SECURITY)
        if nonce in self.seen:fail("REPLAY_DETECTED","nonce already used",F.SECURITY)
        self.seen[nonce]=now
class Auth:
    @staticmethod
    def verify(raw:dict[str,Any]):
        if not AUTH_SECRET:fail("AUTH_SECRET_NOT_CONFIGURED","authorization secret missing",F.SECURITY,500)
        sig=raw.get("authorizationSignature"); ts=raw.get("timestamp"); nonce=raw.get("nonce")
        if not isinstance(sig,str) or not isinstance(ts,int) or not isinstance(nonce,str):fail("AUTHORIZATION_FIELDS_INVALID","authorization fields invalid",F.SECURITY,401)
        material={k:v for k,v in raw.items() if k!="authorizationSignature"}; expected=hmac.new(AUTH_SECRET.encode(),canonical(material),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected,sig):fail("INVALID_AUTHORIZATION_SIGNATURE","invalid request signature",F.SECURITY,401)
class Security:
    @staticmethod
    def validate_data_classification(raw):
        value=str(raw.get("dataClassification","public")).lower()
        if value in {"restricted","top_secret","confidential_pii"}: fail("DATA_CLASS_RESTRICTED",value,F.SECURITY,403)

class Manifest:
    @staticmethod
    def verify(m:Any)->str:
        if not isinstance(m,dict):fail("MISSING_ARTIFACT_MANIFEST","manifest required",F.SECURITY)
        if m.get("algorithm")!="Ed25519":fail("UNSUPPORTED_MANIFEST_ALGORITHM","Ed25519 required",F.SECURITY)
        payload=m.get("payload"); sig=m.get("signature")
        if not isinstance(payload,dict) or not isinstance(sig,str):fail("INVALID_MANIFEST","manifest malformed",F.SECURITY)
        path=KEY_DIR/"manifest-public.pem"
        if not path.exists():fail("MANIFEST_PUBLIC_KEY_NOT_FOUND","public key missing",F.SECURITY,500)
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
            key=serialization.load_pem_public_key(path.read_bytes())
            if not isinstance(key,Ed25519PublicKey):fail("INVALID_MANIFEST_PUBLIC_KEY","invalid key type",F.SECURITY)
            key.verify(base64.b64decode(sig),canonical(payload)); return "MANIFEST_VERIFIED"
        except E:raise
        except Exception:fail("MANIFEST_SIGNATURE_MISMATCH","manifest signature invalid",F.SECURITY)
class Audit:
    def __init__(self):
        AUDIT_DB.parent.mkdir(parents=True,exist_ok=True); self.db=sqlite3.connect(AUDIT_DB); self.db.execute("CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,type TEXT NOT NULL,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,previous_hash TEXT,event_hash TEXT NOT NULL,created INTEGER NOT NULL)"); self.db.commit()
    def append(self,kind:str,payload:dict[str,Any])->dict[str,str]:
        eid="evt-"+str(uuid.uuid4()); previous=self.db.execute("SELECT event_hash FROM events ORDER BY created DESC LIMIT 1").fetchone(); prev=previous[0] if previous else None; ph=digest(payload); material={"id":eid,"type":kind,"payload_hash":ph,"previous_hash":prev,"created":int(time.time())}; eh=digest(material); self.db.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?)",(eid,kind,json.dumps(payload,sort_keys=True,default=str),ph,prev,eh,material["created"])); self.db.commit(); return {"eventId":eid,"eventHash":eh,"payloadHash":ph}
class Devices:
    @staticmethod
    def resolve(name:str)->Device:
        d=DEVICES.get(name)
        if not d:fail("UNSUPPORTED_DEVICE",name,F.DEVICE)
        state=modules(d.modules)
        if not all(state.values()):fail("DEVICE_DEPENDENCY_MISSING",str(state),F.DEVICE,503,True)
        return d
    @staticmethod
    def diagnostics():
        return {n:{"implementation":d.implementation,"available":all(modules(d.modules).values()),"modules":modules(d.modules),"mode":d.mode,"remote":d.remote} for n,d in DEVICES.items()}
class Runtime:
    @staticmethod
    def execute(r:Request)->dict[str,Any]:
        d=Devices.resolve(r.provider)
        try:import pennylane as qml; import numpy as np
        except ImportError as ex:fail("PENNYLANE_UNAVAILABLE",str(ex),F.QUANTUM,503,True)
        start=time.perf_counter(); dev=qml.device(r.provider,wires=r.wires,shots=r.shots); f=np.asarray(list(r.features[:r.wires])+[0.0]*max(0,r.wires-len(r.features))); w=np.asarray(list(r.weights[:r.wires])+[0.125]*max(0,r.wires-len(r.weights)))
        @qml.qnode(dev)
        def circuit(x,p):
            for i in range(r.wires):qml.RY(x[i],wires=i);qml.RZ(p[i],wires=i)
            for i in range(r.wires-1):qml.CNOT(wires=[i,i+1])
            return qml.expval(qml.PauliZ(0))
        value=float(np.asarray(circuit(f,w)).reshape(-1)[0]); elapsed=(time.perf_counter()-start)*1000
        if elapsed>MAX_LATENCY:fail("QUANTUM_LATENCY_EXCEEDED","latency budget exceeded",F.QUANTUM,504,True)
        return {"status":"ok","executionMode":d.mode,"quantumResult":True,"implementation":d.implementation,"provider":r.provider,"wires":r.wires,"shots":r.shots,"expectation":round(value,8),"latencyMs":round(elapsed,3),"pennylaneVersion":getattr(qml,"__version__","unknown")}
class Fallback:
    @staticmethod
    def execute(r:Request,reason:str)->dict[str,Any]:
        fs=r.features or (0.1,0.2); ws=r.weights or (0.3,0.4); vals=[math.tanh(math.sin(x)+math.cos(ws[i%len(ws)])) for i,x in enumerate(fs)]; score=sum(vals)/len(vals)
        return {"status":"degraded","executionMode":"classical_fallback","quantumResult":False,"implementation":"DETERMINISTIC_CLASSICAL_ESTIMATOR","providerRequested":r.provider,"estimate":round(max(-1,min(1,score)),8),"uncertaintyLabel":"UNCERTAIN","fallbackReason":reason[:300]}
class Bridge:
    def __init__(self):self.replay=Replay();self.audit=Audit()
    def normalize(self,raw:dict[str,Any])->Request:
        schema=text(raw.get("schema"),"schema",maxlen=96)
        if schema!=REQ_SCHEMA:fail("UNSUPPORTED_SCHEMA",schema,F.GOVERNANCE)
        rid=text(raw.get("requestId"),"requestId",maxlen=128); tenant=text(raw.get("tenantId"),"tenantId",maxlen=128); actor=text(raw.get("actorId"),"actorId",maxlen=128); task=text(raw.get("task","execute"),"task",maxlen=32); provider=text(raw.get("provider","default.qubit"),"provider",maxlen=96); wires=ints(raw.get("wires",2),"wires",1,MAX_WIRES); shots=raw.get("shots"); shots=ints(shots,"shots",1,MAX_SHOTS) if shots is not None else None; features=nums(raw.get("features",[]),"features",MAX_FEATURES); weights=nums(raw.get("weights",[]),"weights",MAX_WEIGHTS); scopes=tuple(text(x,"scope",maxlen=128) for x in raw.get("scopes",[])); ansatz=text(raw.get("ansatz","RY-RZ-chain-CNOT"),"ansatz",maxlen=128); policy=text(raw.get("policyVersion",POLICY),"policyVersion",maxlen=128)
        if task not in {"execute","diagnose"}:fail("UNSUPPORTED_TASK",task,F.GOVERNANCE)
        Devices.resolve(provider); required=set(DEVICES[provider].scopes)
        if not required.issubset(set(scopes)):fail("MISSING_SECURITY_SCOPE",", ".join(sorted(required-set(scopes))),F.SECURITY,403)
        self.replay.check(text(raw.get("nonce"),"nonce",maxlen=256),ints(raw.get("timestamp"),"timestamp",1,4102444800))
        material={"schema":schema,"requestId":rid,"tenantId":tenant,"actorId":actor,"task":task,"provider":provider,"wires":wires,"shots":shots,"features":features,"weights":weights,"ansatz":ansatz,"policyVersion":policy}; return Request(rid,tenant,actor,task,provider,wires,shots,features,weights,scopes,ansatz,policy,digest(material),digest({"provider":provider,"wires":wires,"shots":shots,"features":features,"weights":weights,"ansatz":ansatz}))
    def process(self,raw:dict[str,Any])->dict[str,Any]:
        rid=str(raw.get("requestId","unknown")); start=time.perf_counter()
        try:
            Auth.verify(raw); Security.validate_data_classification(raw); manifest=Manifest.verify(raw.get("artifactManifest")); r=self.normalize(raw); result={"status":"ok","executionMode":"diagnostic","quantumResult":False,"devices":Devices.diagnostics()} if r.task=="diagnose" else self._execute(r); audit=self.audit.append("quantum.result",{"requestId":r.request_id,"tenantId":r.tenant_id,"result":result}); result.update({"schema":RES_SCHEMA,"systemIdentifier":SYSTEM,"bridgeVersion":VERSION,"requestId":r.request_id,"tenantId":r.tenant_id,"requestHash":r.request_hash,"circuitHash":r.circuit_hash,"policyId":POLICY,"policyVersion":r.policy_version,"auditId":audit["eventId"],"provenance":{"manifest":manifest,"eventHash":audit["eventHash"]},"telemetry":{"runtimeMs":round((time.perf_counter()-start)*1000,3)}}); return self._limit(result)
        except E as ex:
            audit=self.audit.append("quantum.rejected",{"requestId":rid,"code":ex.code,"federation":ex.federation.value}); return {"schema":RES_SCHEMA,"systemIdentifier":SYSTEM,"bridgeVersion":VERSION,"status":"rejected","executionMode":"rejected","quantumResult":False,"requestId":rid,"error":{"code":ex.code,"message":ex.message[:300],"federation":ex.federation.value,"retryable":ex.retryable},"auditId":audit["eventId"],"telemetry":{"runtimeMs":round((time.perf_counter()-start)*1000,3)}}
        except Exception: return {"schema":RES_SCHEMA,"systemIdentifier":SYSTEM,"bridgeVersion":VERSION,"status":"error","executionMode":"rejected","quantumResult":False,"requestId":rid,"error":{"code":"INTERNAL_ERROR","message":"Internal bridge error","retryable":False}}
    def _execute(self,r:Request):
        try:return Runtime.execute(r)
        except E as ex:return Fallback.execute(r,f"{ex.code}:{ex.message}")
        except Exception as ex:return Fallback.execute(r,f"ENGINE_EXCEPTION:{ex}")
    def _limit(self,x:dict[str,Any]):
        if len(canonical(x))>MAX_OUT:return {"schema":RES_SCHEMA,"status":"error","executionMode":"rejected","error":{"code":"OUTPUT_LIMIT_EXCEEDED","message":"Output limit exceeded"}}
        return x

def emit(x:dict[str,Any]):sys.stdout.write(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n");sys.stdout.flush()
def main()->int:
    p=argparse.ArgumentParser();p.add_argument("--stdio",action="store_true");p.add_argument("--diagnose",action="store_true");a=p.parse_args()
    if a.diagnose:emit({"schema":RES_SCHEMA,"status":"ok","executionMode":"diagnostic","devices":Devices.diagnostics()});return 0
    if not a.stdio:return 2
    bridge=Bridge()
    for line in sys.stdin:
        if line.strip():
            try:
                raw=json.loads(line)
                emit(bridge.process(raw if isinstance(raw,dict) else {}))
            except Exception:emit({"schema":RES_SCHEMA,"status":"error","executionMode":"rejected","error":{"code":"INVALID_JSON","message":"Invalid JSON request","retryable":False}})
    return 0
if __name__=="__main__":raise SystemExit(main())
