package com.isabella.jdr.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "audit_events", indexes = {
    @Index(name = "idx_audit_tenant", columnList = "tenant_id"),
    @Index(name = "idx_audit_created", columnList = "created_at")
})
public class AuditEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "subject", length = 255)
    private String subject;

    @Column(name = "action", nullable = false, length = 80)
    private String action;

    @Column(name = "route", length = 160)
    private String route;

    @Column(name = "request_id", length = 64)
    private String requestId;

    @Column(name = "status", length = 3)
    private int status;

    @Column(name = "latency_ms", nullable = false)
    private long latencyMs;

    @Column(name = "payload_hash", length = 64)
    private String payloadHash;

    @Column(nullable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }
    public long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(long latencyMs) { this.latencyMs = latencyMs; }
    public String getPayloadHash() { return payloadHash; }
    public void setPayloadHash(String payloadHash) { this.payloadHash = payloadHash; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
