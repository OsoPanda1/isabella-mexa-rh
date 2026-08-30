package com.isabella.jdr.audit;

public record AuditResponse(
    String id,
    String tenantHash,
    String subject,
    String action,
    String route,
    String requestId,
    int status,
    long latencyMs,
    String createdAt
) {
}
