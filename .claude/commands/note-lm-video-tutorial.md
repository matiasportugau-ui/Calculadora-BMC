/note-lm-video-tutorial — NotebookLM video tutorial workflow

Prepara un notebook de NotebookLM con las fuentes clave del proyecto BMC y genera el guion y estructura para un video tutorial de la Calculadora BMC.

Argumento opcional: $ARGUMENTS
(URL del notebook NotebookLM, tema específico, o "full" para cobertura completa)

Cuando usar este comando
El equipo quiere producir un video tutorial o demo de la Calculadora BMC.
Se necesita un guion estructurado basado en la documentación real del proyecto.
Se quiere aprovechar NotebookLM para sintetizar fuentes y generar audio/podcast overview.

Fuentes recomendadas para el notebook

Agregar al notebook de NotebookLM las siguientes fuentes del proyecto:

1. README del repo: https://github.com/matiasportugau-ui/Calculadora-BMC
2. App en produccion: https://calculadora-bmc.vercel.app
3. Documentacion de paneles: docs/team/PROJECT-STATE.md (exportar como texto)
4. ROADMAP: docs/team/ROADMAP.md

Protocolo del agente

Paso 1 - Preparar fuentes
Listar las fuentes clave del proyecto BMC relevantes para el tutorial.
Si $ARGUMENTS incluye una URL de notebook, navegar a ese notebook.
Si no hay URL, usar el notebook abierto en el browser o crear uno nuevo en notebooklm.google.com.

Paso 2 - Definir el tema y audiencia del video
Audiencia: vendedores, instaladores, o clientes finales de BMC Uruguay.
Temas posibles:
  - "Cotizacion paso a paso": como ingresar dimensiones y obtener precio
    - "Catalogo de paneles": tipos de paneles, espesores, usos
      - "Exportar cotizacion": como descargar o compartir el presupuesto
        - "full": cobertura completa de todas las funcionalidades

        Paso 3 - Generar estructura del video
        Producir un outline con secciones:
          00:00 - Intro y bienvenida (30s)
            00:30 - Que es la Calculadora BMC (60s)
              01:30 - Paso a paso: ingresar proyecto (90s)
                03:00 - Seleccion de paneles del catalogo (60s)
                  04:00 - Revision de cotizacion y totales (60s)
                    05:00 - Exportar / compartir presupuesto (45s)
                      05:45 - Cierre y contacto (15s)

                      Paso 4 - Guion por seccion
                      Para cada seccion del outline, producir:
                        - Texto narrado (voz en off)
                          - Descripcion de lo que se muestra en pantalla
                            - Puntos de enfasis o zoom

                            Paso 5 - Audio overview (opcional)
                            Si NotebookLM esta disponible con la funcion Audio Overview:
                              Ir a la pestana Studio del notebook.
                                Hacer clic en "Generate" en la seccion Audio Overview.
                                  Descargar o compartir el audio generado.

                                  Paso 6 - Guardar artefactos
                                  Guardar el guion en: docs/team/video-tutorials/VIDEO-TUTORIAL-YYYY-MM-DD-<slug>.md
                                  Seguir el formato de la plantilla si existe en: docs/team/video-tutorials/TEMPLATE-VIDEO-TUTORIAL.md
                                  Si el archivo de plantilla no existe, crearlo con la estructura del Paso 3.

                                  Salida obligatoria
                                  Outline del video con timestamps
                                  Guion completo por seccion (narrador + descripcion de pantalla)
                                  Lista de fuentes agregadas al notebook NotebookLM
                                  Nombre del archivo guardado en docs/team/video-tutorials/

                                  Anti-patrones
                                  No inventar precios, dimensiones o especificaciones tecnicas — solo lo que esta en la documentacion del repo.
                                  No generar audio directamente — solo el guion y las instrucciones para usar NotebookLM Audio Overview.
                                  No publicar el video sin revision humana (human gate cm-2).

                                  Referencias repo
                                  Documentacion del proyecto: docs/team/PROJECT-STATE.md
                                  Roadmap: docs/team/ROADMAP.md
                                  Human gates: docs/team/HUMAN-GATES-ONE-BY-ONE.md
                                  App produccion: https://calculadora-bmc.vercel.app
