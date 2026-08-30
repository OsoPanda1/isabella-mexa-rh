package com.isabella.jdr.audit;

import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private final AuditRepository repository;

    public AuditService(AuditRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void record(String tenantId, String subject, String action, String route,
                       String requestId, int status, long latencyMs, String payloadHash) {
        AuditEntity e = new AuditEntity();
        e.setTenantId(tenantId);
        e.setSubject(subject);
        e.setAction(action);
        e.setRoute(route);
        e.setRequestId(requestId);
        e.setStatus(status);
        e.setLatencyMs(latencyMs);
        e.setPayloadHash(payloadHash);
        e.setCreatedAt(Instant.now());
        repository.save(e);
    }
}
