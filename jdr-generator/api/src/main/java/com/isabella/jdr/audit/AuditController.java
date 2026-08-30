package com.isabella.jdr.audit;

import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.isabella.jdr.common.ApiResponse;
import com.isabella.jdr.common.PageResponse;
import com.isabella.jdr.security.TenantContext;
import jakarta.validation.constraints.Max;

@RestController
@RequestMapping("/api/v1/audit/events")
@Validated
public class AuditController {
    private final AuditRepository auditRepository;
    private final TenantContext tenantContext;

    public AuditController(AuditRepository auditRepository, TenantContext tenantContext) {
        this.auditRepository = auditRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ApiResponse<PageResponse<AuditResponse>> events(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "50") @Max(200) int limit) {
        String tenant = tenantContext.requiredTenant(jwt);
        int size = Math.min(limit, 200);
        List<AuditEntity> rows = auditRepository.findByTenantIdOrderByCreatedAtDesc(tenant, PageRequest.of(0, size));
        List<AuditResponse> data = rows.stream().map(e -> new AuditResponse(
            e.getId().toString(),
            tenantContext.tenantHash(tenant),
            e.getSubject(),
            e.getAction(),
            e.getRoute(),
            e.getRequestId(),
            e.getStatus(),
            e.getLatencyMs(),
            e.getCreatedAt().toString())).toList();
        return ApiResponse.ok(new PageResponse<>(data, null, size));
    }
}
