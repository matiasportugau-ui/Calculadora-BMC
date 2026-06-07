# Notas de configuración de correo en BMC2

**Fecha de investigación:** 2026-06 (basado en sesiones y documentación del repo)

## Contexto

El usuario mencionó que "hemos configurado desde aquí la bmc2" refiriéndose a la configuración de las casillas IMAP operativas (las que usa el repo `conexion-cuentas-email-agentes-bmc`).

El objetivo principal es que las mismas cuentas se puedan administrar cómodamente con Thunderbird desde:
- Máquina personal (Mac)
- Máquinas de oficina
- Específicamente "bmc2" (máquina identificada por el usuario)

## Arquitectura recordada de sesiones anteriores

- Las credenciales reales viven en el repo hermano `conexion-cuentas-email-agentes-bmc` (gitignored).
- Estructura típica:
  - `config/accounts.json` → define host, port, user, `passwordEnv`
  - `.env` → contiene las variables con las contraseñas de aplicación IMAP
- Thunderbird usa **directamente** las mismas cuentas IMAP (no pasa por PANELSIM para enviar/leer en tiempo real).
- PANELSIM (`panelsim:email-ready`) hace sync periódico + clasificación + reportes + ayuda con borradores GPT.

## Configuración típica aplicada en BMC2 (reconstruida)

Basado en la documentación y patrones usados en sesiones previas:

1. **Repo de correo clonado/ubicado** como hermano de Calculadora-BMC.
2. `BMC_EMAIL_INBOX_REPO` definido (ya sea en `.env` de Calculadora-BMC o como workspace multi-root).
3. En el repo de correo:
   - `config/accounts.json` con las casillas operativas (ventas, proveedores, etc.).
   - Contraseñas cargadas como variables de entorno (App Passwords de Google o equivalentes).
4. Thunderbird configurado en la máquina con las mismas credenciales (usando App Passwords, no contraseña principal).

## Estado actual deseado (multi-máquina)

El usuario quiere poder usar Thunderbird en:
- Su máquina actual
- Otras máquinas de oficina
- Específicamente "bmc2"

Manteniendo el flujo:
- Leer/enviar directamente en Thunderbird
- Usar PANELSIM + GPT para resúmenes y borradores sugeridos

## Pendiente de completar

Para dar la configuración exacta y segura para BMC2 + otras máquinas, se necesita:

- Confirmar proveedor de las casillas (Google Workspace / Microsoft 365 / otro)
- Saber si son Shared Mailboxes o cuentas individuales con delegación
- Ver el `config/accounts.json` actual del repo de correo (sin exponer passwords)

---

**Próximos pasos recomendados para terminar la config en BMC2 y otras máquinas:**

1. Confirmar proveedor y tipo de cuentas.
2. Generar / rotar App Passwords o permisos de Shared Mailbox por máquina/usuario.
3. Documentar en este archivo los detalles específicos de BMC2 (una vez que se completen).
4. Actualizar el checklist multi-máquina con los valores reales de BMC2.

Este archivo sirve como punto de anclaje para la configuración de correo en la máquina BMC2.