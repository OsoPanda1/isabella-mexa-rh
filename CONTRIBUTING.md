# Guía de Contribución :: Isabella Villaseñor AI™

¡Gracias por tu interés en contribuir a **Isabella Villaseñor AI™ v4.2.0**!

---

## 🛠️ Principios de Contribución

1. **Gobernanza C.R.O.W.N. & Zero-Trust**: Ninguna modificación debe debilitar los filtros de seguridad de **ARGUS Sentinel** ni el registro inmutable de auditoría.
2. **Sin Secretos en Código**: No incluyas API Keys, certificados ni datos personales en tus commits.
3. **Reproducibilidad y Pruebas**: Cualquier cambio en `src/` o `server.ts` debe compilar limpiamente (`npx tsc --noEmit` y `npm run build`).

---

## 🚀 Flujo de Trabajo para Pull Requests

1. **Fork del Repositorio**:
   Crea un fork de `https://github.com/OsoPanda1/isabella-mexa.git`.

2. **Crear una Rama de Trabajo**:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

3. **Verificación de Tipos y Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

4. **Commit con Formato Convencional**:
   ```bash
   git commit -m "feat(crown): agregar enrutamiento sináptico para herramientas locales"
   ```

5. **Enviar Pull Request**:
   Abre el PR hacia la rama `main` describiendo los cambios y los comandos de verificación ejecutados.
