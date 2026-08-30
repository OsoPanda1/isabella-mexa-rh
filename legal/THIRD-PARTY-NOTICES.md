# Third-Party Notices — Isabella

Atribuciones de dependencias y servicios de terceros utilizados por Isabella.

## Dependencias de código (frontend/backend)
Se documentan en `package.json` y en el SBOM generado en el build. Principales:

- **React 19, Vite, Tailwind CSS 4, Express** — sus respectivas licencias MIT.
- **Stripe SDK** — bajo Apache 2.0 / MIT (ver paquete `stripe`).
- **ioredis** — MIT.
- **@supabase/*, @neondatabase/*, upstash/*, zod, etc.** — según sus paquetes.

## Servicios externos
- **Stripe** — pagos (PCI-DSS). Datos de tarjeta los maneja Stripe.
- **Neon** — Postgres gestionado.
- **Supabase** — identidad/persistencia.
- **Redis Cloud (REDIS_URL) / Upstash** — rate-limit distribuido.

## Modelos de IA
El uso de modelos de terceros se documenta en
`governance/model-cards/` y `governance/system-cards/`, con sus respectivas
licencias de proveedor. Isabella **puede contener errores**; ver
`AI-TRANSPARENCY-NOTICE.md`.

## Marcas
Las marcas de terceros pertenecen a sus titulares.

Para fallos de seguridad en dependencias, ver `SECURITY-DISCLOSURE.md`.
