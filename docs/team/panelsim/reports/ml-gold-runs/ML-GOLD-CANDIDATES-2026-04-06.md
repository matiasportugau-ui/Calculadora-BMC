# ML gold candidates — lote 2026-04 (actualizado contra API)

## Estado API (verificación reciente)

- **Origen:** `GET /ml/questions?status=UNANSWERED` vía API local (`:3001`), **paginado** (`limit=50`, `offset` hasta agotar).
- **`total` reportado por ML:** **11** — **coincide** con cantidad traída (no hay “página oculta” con este filtro).
- **Otros estados (mismo endpoint):** `ANSWERED` **479** · `UNDER_REVIEW` **0** · `CLOSED_UNANSWERED` **0**.
- **Nota:** si en la interfaz de ML ves un número mayor (~**498**), suele ser el **total de preguntas del historial** (todas), no solo **sin responder**.

## CRM (`CRM_Operativo`)

- Último `node scripts/panelsim-ml-crm-sync.js`: **0** filas nuevas — **todas** las `Q:<id>` pendientes ya estaban registradas (dedupe por Observaciones).

## Ya no están en `UNANSWERED` (archivo)

Estas figuraban en una captura anterior y **ya no** aparecen en búsqueda `UNANSWERED` (normalmente **respondidas** en ML):

| Q:id (archivo) | item |
|----------------|------|
| 13555660057 | MLU467582115 |
| 13556661889 | MLU894145354 |

---

## Tabla actual — 11 pendientes ML

| Q:id | item | `deleted_from_listing` | Estado gold |
|------|------|------------------------|-------------|
| 13552691868 | MLU445615830 | sí (publicación borrada en listado) | _pendiente_ |
| 13556481092 | MLU758577874 | no | _pendiente_ |
| 13555818041 | MLU445009361 | no | _pendiente_ |
| 13556027377 | MLU445615830 | no | _pendiente_ |
| 13556898204 | MLU445615830 | no | _pendiente_ |
| 13556428179 | MLU881039084 | no | _pendiente_ |
| 13557321894 | MLU445615830 | no | _pendiente_ |
| 13557438416 | MLU445009361 | no | _pendiente_ |
| 13557120647 | MLU445010620 | no | _pendiente_ |
| 13557498641 | MLU445615830 | no | _pendiente_ |
| 13558247210 | MLU445615830 | no | _pendiente_ |

**Checklist publicación:** [`ML-RESPUESTAS-KB-BMC.md`](../../knowledge/ML-RESPUESTAS-KB-BMC.md) §7.

---

## 13552691868 · MLU445615830

**Pregunta (comprador):** Hola buenaa tarde me podrían presupuestar el siguiente pedido: Isopanel Pared: 7 de 2.60 mts 4 de 2.40 mts 7 isopanel

**Borrador IA (histórico):** Pedía espesor y aclaración “7 isopanel”.

**Respuesta gold (humana):** _completar_

---

## 13556481092 · MLU758577874

**Pregunta:** Hola! 6,70 m de canalón , 2,15 m tapa lateral con gotero ,3,72 m frontal con gotero y 4m frontal sin gotero . Barrio villa dolores Montevideo ! Me podrían informar el costo del envío también ? Muchas gracias

**Borrador IA (histórico):** Alinear a publicación **kit canalón** (no desalinear con “no es nuestro producto”).

**Respuesta gold:** _completar_

---

## 13555818041 · MLU445009361

**Pregunta:** Hola ustedes hacen la colocación?

**Respuesta gold:** _completar_

---

## 13556027377 · MLU445615830

**Pregunta:** reemplazar un techo de chapa. Son 6 metros de ancho por 3.6 de largo. Precio con y sin colocación. Gracias!

**Nota:** borrador IA previo con **precio inventado** — **no** usar.

**Respuesta gold:** _completar_

---

## 13556898204 · MLU445615830

**Pregunta:** Hola para hacer una habitación de 4x3x2.40 sin techo qué precio andaria

**Respuesta gold:** _completar_

---

## 13556428179 · MLU881039084

**Pregunta:** Buen día, hay más anchas? Tipo 40 cm?

**Respuesta gold:** _completar_

---

## 13557321894 · MLU445615830

**Pregunta:** Cada panel de 4.50 metros vale U$S 46?

**Respuesta gold:** _completar_

---

## 13557438416 · MLU445009361

**Pregunta:** De 10 cm de espesor por 8 metros de largo que costo tiene

**Respuesta gold:** _completar_

---

## 13557120647 · MLU445010620

**Pregunta:** Hola ,seria una caída sola paredes 6 metros de ancho por 12 de largo la caída a los 6 cuántas nesecito?

**Respuesta gold:** _completar_

---

## 13557498641 · MLU445615830 _(nueva en captura 2026-04-06)_

**Pregunta:** Buen día, quisiera cotización para una casa de isopanel, tanto techo como pared, sería de 10 metros de largo x 7 metros

**Respuesta gold:** _completar_

---

## 13558247210 · MLU445615830 _(seguimiento mismo comprador)_

**Pregunta:** Más todos sus accesorios, sería para jaureguiberry, gracias

**Respuesta gold:** _completar_ (coherente con **13557498641**)

---

*Tras completar cada **Respuesta gold**, `POST /api/agent/train` o publicar en ML según [README.md](./README.md).*
