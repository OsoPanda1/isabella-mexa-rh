# SECURITY.md — Isabella Villaseñor AI

**Estado:** diseño integrado y preparado para validación.
**Producción bloqueada** hasta demostrar criptografía real, procedencia de artefactos, pruebas de seguridad, benchmarks reproducibles, restauración y aprobación operativa.

## Declaración de seguridad

Isabella Villaseñor AI se encuentra en fase de integración y validación técnica. La arquitectura define contratos, políticas, evidencia, seguridad, despliegue y recuperación. Ninguna etiqueta de producción, firma criptográfica, certificación o capacidad institucional se considerará válida sin artefactos verificables, pruebas reproducibles y aprobación operativa documentada.

## Principios

1. **Egress deny-by-default.** Toda salida de datos requiere autorización explícita del PDP.
2. **Fail closed.** La falta de firma, evidencia o autorización produce rechazo o degradación explícita.
3. **Separación de poderes.** El modelo propone; el PDP autoriza; el auditor registra.
4. **Mínimo privilegio.** Cada herramienta recibe solo las capacidades necesarias.
5. **Local-first.** La ejecución local es la ruta predeterminada.

## Cómo reportar vulnerabilidades

Envíe reportes a: [https://github.com/OsoPanda1/isabella-mexa/security/advisories/new](https://github.com/OsoPanda1/isabella-mexa/security/advisories/new)

- Incluya descripción, pasos para reproducir, impacto y propuesta de mitigación.
- No publique vulnerabilidades públicamente antes de un fix.
- Tiempo de respuesta objetivo: 48 horas para confirmación, 7 días para fix o mitigación.
