# AI Transparency Notice — Isabella

> Transparencia y honestidad respecto a qué hace (y qué no hace) Isabella.

## Declaración de exactitud
Isabella **es software de IA y puede contener errores**. No está certificado
como exacto, legal, médico ni financiero. Las salidas deben ser revisadas por
una persona antes de usarlas para decisiones importantes.

## Qué se declara con transparencia (provenance)
Cada respuesta transporta metadata de procedencia
(`src/lib/governance/provenance.ts`):
- `modelId` / `modelVersion` — qué modelo y versión generó la salida.
- `policyVersion` — qué política/jurisdicción aplicó.
- `dataOrigin` — origen de los datos (`live`, `simulated`, `demo`, `local`).
- `humanReview` — si hubo revisión humana (`not_required`, `pending`, `completed`).

## Incertidumbre
Cuando una afirmación es factual y de alto riesgo, Isabella expone su nivel de
confianza epistémico y puede requerir revisión humana, en lugar de afirmar
"verificado".

## No es asesoramiento
Las salidas no constituyen asesoramiento legal, médico, financiero ni de
inversión. Consulte a profesionales cualificados.

## Supervisión humana
Las decisiones de alto impacto requieren aprobación humana (H2-H4) conforme a
`HUMAN-OVERSIGHT-POLICY.md`.
