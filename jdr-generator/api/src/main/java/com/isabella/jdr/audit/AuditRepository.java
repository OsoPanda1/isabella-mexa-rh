package com.isabella.jdr.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditRepository extends JpaRepository<AuditEntity, Long> {
    java.util.List<AuditEntity> findByTenantIdOrderByCreatedAtDesc(
        String tenantId, org.springframework.data.domain.Pageable pageable);
}
