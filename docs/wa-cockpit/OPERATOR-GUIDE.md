# WA Cockpit — Guía del Operador (Owner/Admin)

Esta guía explica cómo gestionar el módulo WhatsApp Pro desde la nueva pestaña de **Configuración**.

## 1. Gestión de Operadores
- **Invitar**: Ingresá el email del vendedor. Recibirá un **Magic Link** por correo.
- **Roles**:
  - `Owner`: Control total, un solo usuario.
  - `Admin`: Puede cambiar settings, flags y ver audit logs.
  - `Member`: Puede operar chats, ver sugerencias AI y cotizar.
- **Revocar**: Si un dispositivo se pierde o un operador deja el equipo, click en "Revocar sesiones" para invalidar todos sus tokens.

## 2. Reglas de Ruteo (Routing Rules)
Las reglas se evalúan de arriba hacia abajo (prioridad).
- **Condiciones**: Podés filtrar por teléfono, nombre del contacto o palabras clave en el mensaje.
- **Acciones**: Asignar automáticamente a un operador, poner etiquetas (labels) o cambiar el estado del chat.
- **Preview**: Antes de guardar, usá el botón "Preview" para ver a cuántos chats de los últimos 200 les aplicaría la regla.

## 3. SLA y Alertas
- **Unreplied**: Tiempo máximo que un cliente puede esperar sin respuesta nuestra.
- **Unassigned**: Tiempo máximo que un chat nuevo puede estar sin dueño.
- **Business Hours**: Las alertas de SLA solo corren durante el horario configurado.

## 4. IA Customizable
Podés elegir qué modelo usa cada tarea:
- **Classify**: Modelo rápido y barato para detectar intención.
- **Suggestions**: Modelo potente (ej. Claude 3.5 Sonnet) para respuestas de alta calidad.
- **QuoteParse**: Modelo preciso para extraer m² y dimensiones.

## 5. Audit Log
Cada cambio en la configuración o acción crítica (como enviar un mensaje vía Cloud API) queda registrado con:
- Quién lo hizo.
- Qué valor había antes y cuál después.
- IP y navegador del operador.

---
*Para detalles técnicos de cada variable, ver [CONFIG-REFERENCE.md](./CONFIG-REFERENCE.md).*
