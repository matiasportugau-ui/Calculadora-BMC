# Checklist: Agregar casilla BMC en nueva computadora (Thunderbird)

Usa este checklist cada vez que configures una nueva máquina (tuya o de oficina).

## Antes de empezar
- [ ] Confirmar que la persona tiene permisos para acceder a la(s) casilla(s) operativa(s).
- [ ] Tener a mano las credenciales correctas (**nunca** la contraseña principal del usuario — usar contraseñas de aplicación o acceso delegado).
- [ ] Instalar Thunderbird (preferentemente misma versión mayor que las otras máquinas).

## Configuración de la cuenta

1. [ ] Abrir Thunderbird → Agregar cuenta de correo existente.
2. [ ] Elegir **Configuración manual**.
3. [ ] Completar datos IMAP según proveedor:
   - **Google Workspace**: imap.gmail.com puerto 993 SSL/TLS
   - **Microsoft 365**: outlook.office365.com puerto 993 SSL/TLS
4. [ ] SMTP:
   - Google: smtp.gmail.com puerto 465 o 587
   - Microsoft: smtp.office365.com puerto 587 STARTTLS
5. [ ] Usar **contraseña de aplicación** (App Password) o credenciales de mailbox compartido.
6. [ ] Probar conexión (botón "Probar").

## Configuración post-creación (obligatorio para multi-máquina)

- [ ] Ir a Configuración de la cuenta → Copias y carpetas
  - [ ] Borradores → Usar la carpeta "Borradores" del servidor
  - [ ] Enviados → Usar la carpeta "Enviados" del servidor
  - [ ] Papelera → Usar la carpeta "Papelera" / "Eliminados" del servidor
- [ ] Sincronización y almacenamiento:
  - [ ] Activar "Mantener mensajes para esta cuenta en este equipo"
  - [ ] Sincronizar solo las carpetas operativas importantes (evitar sincronizar toda la vida si la bandeja es muy grande)
- [ ] Avanzado:
  - [ ] Desactivar compactación automática al salir (si varias máquinas usan la cuenta)
  - [ ] Activar IDLE si está disponible

## Pruebas obligatorias

- [ ] Enviar un correo de prueba a ti mismo desde esta máquina.
- [ ] Verificar que el correo aparezca en **Thunderbird de otra máquina** (y en el sync de PANELSIM).
- [ ] Responder un email desde esta máquina y confirmar que queda registrado correctamente.
- [ ] Verificar que los borradores generados con GPT se puedan pegar y enviar sin problemas.

## Buenas prácticas

- [ ] Usar siempre las mismas etiquetas/carpetas que el resto del equipo (`Por responder`, `En seguimiento`, etc.).
- [ ] No dejar correos "en borrador" en el cliente local por mucho tiempo (mejor usar la carpeta Borradores del servidor).
- [ ] Comunicar al equipo cuando se agrega una nueva máquina.
- [ ] Documentar qué credencial (App Password) se usó en qué máquina (para poder revocar si hace falta).

---

**Referencia principal:**  
[EMAIL-MULTI-COMPUTER-THUNDERBIRD.md](./EMAIL-MULTI-COMPUTER-THUNDERBIRD.md)

**Flujo completo con GPT + PANELSIM:**  
[EMAIL-GPT-THUNDERBIRD-WORKFLOW.md](./EMAIL-GPT-THUNDERBIRD-WORKFLOW.md)