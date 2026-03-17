# Referencia Operativa Impositiva (BMC Uruguay)

## 1) Normativa minima de trabajo (resumen)

### Codigo Tributario - Vista (Art. 46)

- La Vista abre una instancia previa a la resolucion definitiva.
- En general, se dispone de 15 dias habiles para responder con descargos o regularizar.
- Recomendacion operativa: registrar fecha de notificacion, fecha limite y evidencia adjunta desde el dia 1.

### IVA (regla operativa)

- Regla base de control DGI: IVA debito (ventas/CFE emitidos) - IVA credito (compras/CFE recibidos) = saldo.
- Puntos criticos:
  - facturas emitidas sin nota de credito cuando hubo anulacion/devolucion
  - creditos fiscales no reconocidos por errores de RUT, emision o proveedor observado
  - desfasajes entre fecha de CFE y periodo declarado

### IRAE (SAS)

- Las SAS tributan IRAE igual que SRL a efectos tributarios.
- Si aplica regimen ficto, revisar umbral de ingresos (4.000.000 UI) y su impacto en anticipos/liquidacion.

### Impuesto al Patrimonio (IP)

- Revisar alta y valuacion de activos.
- Bajo regimenes promocionales (ej. COMAP) pueden existir exoneraciones sobre bienes elegibles.

### COMAP (Decreto 329/025)

- Instrumento para promover inversiones con exoneraciones sobre IRAE/IP y otros beneficios segun proyecto.
- Para mipymes puede haber mejoras de puntaje/porcentaje y mayor plazo de uso.
- Requiere estructurar proyecto, indicadores y trazabilidad documental.

### Exoneracion por actividad de software (aplicable segun condiciones)

- Evaluar si parte de la renta de desarrollo de software califica para beneficios.
- Requiere respaldo de sustancia economica (gastos/actividad en Uruguay, personal calificado y documentacion).

## 2) Guia de extraccion rapida de datos

## DGI (Servicios en linea)

Objetivo: descargar fuente oficial para conciliacion.

1. Ingresar con RUT y credenciales de servicios en linea.
2. Exportar CFE emitidos del periodo (Excel/CSV).
3. Exportar CFE recibidos del periodo (Excel/CSV).
4. Descargar formularios precargados del periodo (1050 y 2178, si aplican).
5. Guardar archivos con convencion: `fuente_rut_periodo_tipo.ext`.

Campos minimos esperados:
- tipo de comprobante
- serie y numero
- fecha
- RUT contraparte
- neto/IVA/total

## Sistema de facturacion (ej. Factura Express)

Objetivo: extraer la version interna para comparar contra DGI.

1. Exportar ventas emitidas del mismo periodo.
2. Exportar notas de credito emitidas del mismo periodo.
3. Exportar compras (si el sistema las registra).
4. Incluir identificador del documento origen cuando exista.

Campos recomendados:
- tipo, serie, numero
- fecha de emision
- cliente/proveedor (RUT)
- neto, IVA, total
- referencia de anulacion/NC

## BROU (opcional)

Objetivo: validar trazabilidad de cobros/pagos.

1. Exportar movimientos del periodo (CSV/Excel).
2. Marcar ingresos asociados a ventas y egresos asociados a compras/impuestos.
3. Usar esta capa como validacion secundaria, no como reemplazo de CFE.

## 3) Matriz de beneficios y financiamiento (SAS)

| Instrumento | Para que sirve | Prueba requerida |
| --- | --- | --- |
| COMAP | Exoneraciones por inversion elegible | Proyecto de inversion y soporte de ejecucion |
| IRAE ficto | Simplificacion/cambio de base segun umbral | Control de ingresos en UI y regimen vigente |
| Regimen software | Potencial exoneracion de renta de software | Evidencia de actividad y condiciones de sustancia |
| BROU | Financiamiento pyme/industrial/capital de trabajo | Carpeta economico-financiera y destino del credito |
| ANDE | Programas de fortalecimiento pyme y apoyo tecnico | Perfil de empresa y proyecto |
| ANII | Apoyo a innovacion y desarrollo | Proyecto I+D+i y plan de resultados |
| INEFOP | Subsidios/capacitacion de personal | Programa formativo y elegibilidad |

## 4) Checklist para analisis rapido de una Vista

1. Fecha exacta de notificacion y fecha limite (15 dias habiles).
2. Periodo observado y tributos impactados.
3. Diferencia principal (normalmente IVA) cuantificada.
4. CFE emitidos no conciliados.
5. Notas de credito faltantes o mal vinculadas.
6. Creditos fiscales observados/no reconocidos.
7. Anticipos no imputados o mal aplicados.
8. Carpeta de evidencia por hallazgo (archivo fuente + explicacion).

## 5) Disclaimer profesional

Este documento es una referencia operativa para analisis tecnico y conciliacion. No constituye asesoramiento legal o contable definitivo. Toda estrategia y presentacion ante DGI debe ser validada por profesionales habilitados.
