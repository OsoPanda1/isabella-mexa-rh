import { generateAuditId } from "./apiInterceptor";

export interface AuditEvent {
  id: string;
  timestamp: string;
  module: "VOICE_STUDIO" | "IMAGE_STUDIO" | "TERMINAL" | "CODEX" | "SYSTEM";
  action: string;
  details: string;
  userId: string;
}

const AUDIT_STORAGE_KEY = "isabella_enterprise_audit_log";

/**
 * Enterprise Audit Logging System
 * Records critical user interactions to local storage for compliance.
 */
export const AuditLog = {
  record: (module: AuditEvent["module"], action: string, details: string) => {
    try {
      const event: AuditEvent = {
        id: generateAuditId(),
        timestamp: new Date().toISOString(),
        module,
        action,
        details,
        userId: "CURRENT_SESSION_USER", // In a real app, this comes from auth
      };

      const existingLogsRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
      const existingLogs: AuditEvent[] = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
      
      const updatedLogs = [event, ...existingLogs].slice(0, 1000); // Keep last 1000 events
      
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updatedLogs));
      
      console.log(`[AUDIT] ${module} - ${action}`, event.id);
    } catch (e) {
      console.error("Failed to record audit log", e);
    }
  },

  getLogs: (): AuditEvent[] => {
    try {
      const logsRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
      return logsRaw ? JSON.parse(logsRaw) : [];
    } catch (e) {
      console.error("Failed to read audit logs", e);
      return [];
    }
  },
  
  clearLogs: () => {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  }
};
