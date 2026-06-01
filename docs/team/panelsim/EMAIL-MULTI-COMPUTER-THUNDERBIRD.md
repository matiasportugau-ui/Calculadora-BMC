# Configurar casillas de correo BMC para múltiples computadoras (Thunderbird)

**Objetivo**: Permitir que la misma cuenta IMAP operativa se use cómodamente desde tu Mac personal + computadoras de oficina, manteniendo el flujo actual de PANELSIM + GPT drafts + Thunderbird como cliente principal de envío.

---

## Principio fundamental (no romper)

Thunderbird y el sistema PANELSIM usan **exactamente las mismas cuentas IMAP**.  
La fuente de verdad es siempre el servidor de correo. PANELSIM solo hace sync + clasificación + ayuda con borradores.

Cualquier configuración que hagas debe respetar esto.

---

## Recomendación general

Para uso multi-computadora (tú + oficina) la mejor opción actual es:

**Thunderbird + IMAP bien configurado en todas las máquinas + disciplina de carpetas/etiquetas.**

No uses POP3. No compartas contraseñas en texto plano.

---

## Pasos recomendados

### 1. Configuración básica en cada máquina (Thunderbird)

En cada computadora donde quieras usar las casillas:

1. Agrega la cuenta como **IMAP** (no POP).
2. En la configuración de la cuenta → **Sincronización y almacenamiento**:
   - Activa "Mantener mensajes para esta cuenta en este equipo".
   - Sincroniza las carpetas que realmente usen (evita sincronizar "Papelera" o "Spam" si son muy grandes).
3. Ve a **Configuración avanzada** de la cuenta:
   - Desactiva "Compactar carpetas al salir" automático si varios la usan simultáneamente.
   - Marca "Usar IDLE" (IMAP push) si el proveedor lo soporta.

### 2. Seguridad recomendada (importante)

**Nunca compartir la contraseña principal** entre usuarios o máquinas.

Opciones según proveedor:

- **Google Workspace / Gmail**:
  - Usa **Contraseñas de aplicación** (App Passwords) por máquina.
  - Mejor aún: delega acceso a la casilla (Delegated Access) a las personas que necesiten administrarla.

- **Microsoft 365**:
  - Crea **Shared Mailbox** o usa "Send As" / "Send on Behalf".
  - Evita compartir credenciales.

- Otros proveedores: genera credenciales específicas o tokens cuando sea posible.

### 3. Flujo de trabajo recomendado con GPT + Thunderbird

Mantén el flujo actual:

1. En cualquier máquina: corre `npm run panelsim:email-ready` (o el sync correspondiente).
2. Usa el GPT de correo (o `/api/email/panelsim-summary` + `POST /api/email/draft-outbound`) para generar borradores.
3. Copia el borrador y pégalo en **Thunderbird** de la máquina donde estés trabajando.
4. Envía desde Thunderbird (así queda registrado correctamente en el servidor IMAP).

Esto funciona igual desde tu Mac o desde una PC de oficina.

### 4. Buenas prácticas para evitar conflictos

- Usa **carpetas/etiquetas claras** y consistentes (ej: `Por responder`, `En seguimiento`, `Cerrado-2026`).
- Evita que dos personas respondan el mismo email al mismo tiempo sin coordinación.
- Después de enviar desde Thunderbird, deja que el sync de PANELSIM vuelva a leer la bandeja (normalmente ya lo hace).
- En máquinas secundarias (oficina), considera sincronizar solo las carpetas más importantes para no saturar el disco.

### 5. Opciones avanzadas (si el uso crece)

- Una máquina "principal" hace el sync pesado del repo IMAP + PANELSIM.
- Las demás máquinas usan Thunderbird directamente contra IMAP + solo consultan resúmenes cuando hace falta.
- Evaluar en el futuro herramientas como **Mailspring**, **Evolution** o un webmail interno si el volumen aumenta mucho.

---

## Preguntas para afinar la configuración

Para darte instrucciones más precisas (especialmente credenciales y delegación), necesito saber:

1. ¿Las casillas operativas principales están en **Google Workspace**, **Microsoft 365**, o otro proveedor?
2. ¿Son casillas compartidas (ventas@, cotizaciones@, etc.) o cuentas personales de los que responden?
3. ¿Cuántas personas van a usar estas casillas regularmente?

Con esa información puedo darte los pasos exactos de delegación + configuración de Thunderbird + contraseñas de aplicación.

---

## Configuración recomendada de Thunderbird (valores comunes)

### Para Google Workspace / Gmail

**IMAP (recepción):**
- Servidor: `imap.gmail.com`
- Puerto: `993`
- SSL/TLS: Sí (STARTTLS no recomendado para Thunderbird)
- Nombre de usuario: tu email completo
- Contraseña: **Contraseña de aplicación** (nunca la contraseña normal)

**SMTP (envío):**
- Servidor: `smtp.gmail.com`
- Puerto: `465` (SSL) o `587` (STARTTLS)
- Autenticación: Normal password
- Nombre de usuario: mismo email

**Configuración extra recomendada:**
- En la cuenta → Copias y carpetas: Configura "Borradores", "Enviados" y "Papelera" para que usen las carpetas del servidor.
- Activa "Usar IDLE" para notificaciones rápidas.

### Para Microsoft 365 / Outlook

**IMAP:**
- Servidor: `outlook.office365.com`
- Puerto: `993`
- SSL/TLS: Sí

**SMTP:**
- Servidor: `smtp.office365.com`
- Puerto: `587`
- STARTTLS: Sí
- Autenticación: Normal password

**Importante para Microsoft 365:**
- Es mucho mejor usar **Shared Mailbox** + permisos "Full Access" + "Send As" en lugar de compartir credenciales.
- Si usas autenticación moderna (OAuth), Thunderbird 115+ tiene mejor soporte.

---

## Checklist rápido para agregar una cuenta en nueva computadora

1. [ ] Instalar Thunderbird (misma versión mayor que las otras máquinas si es posible).
2. [ ] Crear la cuenta como IMAP con los datos de arriba.
3. [ ] Usar **contraseña de aplicación** o credenciales delegadas (nunca la contraseña principal del usuario).
4. [ ] Configurar carpetas del servidor para Borradores / Enviados / Papelera.
5. [ ] Sincronizar solo las carpetas operativas importantes.
6. [ ] Probar enviar un correo de prueba a ti mismo.
7. [ ] Verificar que el correo aparezca en las otras máquinas después de unos minutos.
8. [ ] (Opcional) Configurar firma corporativa idéntica en todas las máquinas.

---

**Referencias relacionadas:**
- [EMAIL-GPT-THUNDERBIRD-WORKFLOW.md](./EMAIL-GPT-THUNDERBIRD-WORKFLOW.md)
- [EMAIL-ADMINISTRATOR.md](./EMAIL-ADMINISTRATOR.md)
- Skill: `.cursor/skills/panelsim-email-inbox/SKILL.md`