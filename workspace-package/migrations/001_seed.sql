-- Seed matching panelin-workspace/src/lib/seed/seed.ts (idempotent)

INSERT INTO panelin_workspace.ws_users (id, email, display_name, role) VALUES
  ('user-superadmin', 'matias.portugau@gmail.com', 'Matías Portugau', 'superadmin'),
  ('user-operator', 'carlos.mendoza@bmc.uy', 'Carlos Mendoza', 'operator')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.workspaces (id, owner_user_id, name, agent_config_id) VALUES
  ('ws-1', 'user-superadmin', 'Panelin Workspace', 'agent-config-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.projects (id, workspace_id, name) VALUES
  ('proj-norte', 'ws-1', 'Obra Industrial Norte - Techos EPS'),
  ('proj-sur', 'ws-1', 'Centro Comercial Sur - Fachadas'),
  ('proj-lote12', 'ws-1', 'Viviendas Lote 12 - Paneles')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.sessions (id, project_id, title, messages, file_ids) VALUES
  (
    'sess-1',
    'proj-norte',
    'Cotización techo EPS 80mm - Obra Norte',
    '[{"id":"m1","role":"assistant","content":"Te ayudo con la cotización del techo EPS 80mm para Obra Norte.","createdAt":"2026-07-20T10:00:00Z"}]'::jsonb,
    '["file-1","file-3"]'::jsonb
  ),
  ('sess-2', 'proj-norte', 'Consulta espesor para zona viento 3', '[]'::jsonb, '["file-3"]'::jsonb),
  ('sess-3', 'proj-sur', 'Presupuesto fachada sur', '[]'::jsonb, '["file-2","file-4"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.files (id, workspace_id, project_id, session_id, name, path, mime, size, status, created_at) VALUES
  ('file-1', 'ws-1', 'proj-norte', 'sess-1', 'Cotizacion_Techo_ObraNorte_v4.pdf', '/Obra Industrial Norte/Cotizacion_Techo_ObraNorte_v4.pdf', 'application/pdf', 1800000, 'Versión Final', '2026-07-20T09:00:00Z'),
  ('file-2', 'ws-1', 'proj-sur', NULL, 'Ficha_Tecnica_Panel_EPS_80.pdf', '/Centro Comercial Sur/Ficha_Tecnica_Panel_EPS_80.pdf', 'application/pdf', 950000, NULL, '2026-07-19T14:00:00Z'),
  ('file-3', 'ws-1', 'proj-norte', 'sess-2', 'Memoria_Calculo_Viento_Zona3.pdf', '/Obra Industrial Norte/Memoria_Calculo_Viento_Zona3.pdf', 'application/pdf', 2400000, 'Versión Final', '2026-07-20T11:30:00Z'),
  ('file-4', 'ws-1', 'proj-sur', NULL, 'Presupuesto_Fachada_Sur.xlsx', '/Centro Comercial Sur/Presupuesto_Fachada_Sur.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 420000, NULL, '2026-07-18T16:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.knowledge_docs (id, workspace_id, title, source_type, status, bmc_kb_id, indexed_at, size, proposed_by) VALUES
  ('kb-1', 'ws-1', 'Manual de instalación paneles sándwich IRAM', 'PDF', 'indexed', 'kb-iram-manual', '2026-07-10', '4.2 MB', NULL),
  ('kb-2', 'ws-1', 'Tabla de espesores según carga de viento (CIRSOC)', 'PDF', 'indexed', 'kb-cirsoc-viento', '2026-07-12', '1.1 MB', NULL),
  ('kb-3', 'ws-1', 'Fichas técnicas de proveedores', 'Markdown', 'indexed', NULL, '2026-07-15', '890 KB', NULL),
  ('kb-4', 'ws-1', 'Guía de protocolos de seguridad en obra', 'PDF', 'pending', NULL, NULL, '2.0 MB', 'Carlos Mendoza')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.skills (id, workspace_id, name, description, enabled, kind, status, bmc_tool_names, proposed_by, updated_at) VALUES
  ('skill-1', 'ws-1', 'Calcular espesor óptimo según carga de viento', 'Determina espesor de panel según zona CIRSOC y uso.', true, 'skill', 'approved', '["calcular_cotizacion","obtener_escenarios"]'::jsonb, NULL, '2026-07-19'),
  ('skill-2', 'ws-1', 'Generar memoria técnica estructural', 'Produce memoria de cálculo estructural en PDF.', true, 'tool', 'approved', '["generar_pdf"]'::jsonb, NULL, '2026-07-18'),
  ('skill-3', 'ws-1', 'Recomendar tipo de panel según uso y normativa', 'Sugiere panel y espesor según normativa IRAM.', true, 'skill', 'approved', '["obtener_catalogo","listar_opciones_panel"]'::jsonb, NULL, '2026-07-17'),
  ('skill-4', 'ws-1', 'Exportar cotización completa (PDF + Excel)', 'Exporta cotización en PDF y Excel para el cliente.', false, 'tool', 'approved', '["generar_pdf","obtener_pdf_html"]'::jsonb, NULL, '2026-07-16'),
  ('skill-5', 'ws-1', 'Integrar herramienta de scraping web', 'Propuesta de skill para monitoreo de precios.', false, 'tool', 'pending', '[]'::jsonb, 'Laura Torres', '2026-07-19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.workflows (id, workspace_id, name, description, steps, version, status, last_edited) VALUES
  ('wf-1', 'ws-1', 'Onboarding de Clientes', 'Captura datos, análisis y aprobación comercial.',
   '[{"id":"s1","label":"Captura de datos"},{"id":"s2","label":"Análisis"},{"id":"s3","label":"Aprobación"}]'::jsonb, 1, 'active', 'Hace 2 horas'),
  ('wf-2', 'ws-1', 'Procesamiento de Reembolsos', 'Validación y pago de solicitudes.',
   '[{"id":"s1","label":"Solicitud"},{"id":"s2","label":"Validación"},{"id":"s3","label":"Cálculo"},{"id":"s4","label":"Pago"}]'::jsonb, 2, 'paused', 'Ayer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.agent_configs (id, workspace_id, system_prompt, models, active_model, api_keys_masked) VALUES
  (
    'agent-config-1',
    'ws-1',
    'Eres un asistente virtual útil y profesional de BMC Uruguay. Ayudás a cotizar paneles sándwich en USD, sin inventar precios. Confirmá siempre antes de escribir en CRM.',
    '["gpt-4o-mini","claude-sonnet-4","grok-2"]'::jsonb,
    'gpt-4o-mini',
    '["sk-****************"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.change_requests (id, workspace_id, type, title, description, status, diff_text, diff_json, author_id, author_name, created_at, reviewed_at, reviewer_id) VALUES
  ('CR-001', 'ws-1', 'knowledge', 'Añadir guía de protocolos de seguridad', 'Añadir guía de protocolos de seguridad', 'proposed',
   E'+ Manual de protocolos de seguridad en obra\n+ Sección EPP obligatorio',
   '{"add":{"title":"Guía protocolos seguridad"}}', 'user-operator', 'Carlos Mendoza', '2026-07-20T10:30:00Z', NULL, NULL),
  ('CR-002', 'ws-1', 'skill', 'Integrar herramienta de scraping web', 'Integrar herramienta de scraping web', 'approved',
   '+ skill: web_scraping_prices',
   '{"skill":"web_scraping_prices","enabled":false}', 'user-operator', 'Laura Torres', '2026-07-19T18:45:00Z', '2026-07-19T20:00:00Z', 'user-superadmin'),
  ('CR-003', 'ws-1', 'workflow', 'Automatizar respuesta de tickets', 'Automatizar respuesta de tickets', 'rejected',
   '- workflow: ticket_auto_reply',
   '{"workflow":"ticket_auto_reply","rejected":true}', 'user-operator', 'Miguel Ruiz', '2026-07-17T09:15:00Z', '2026-07-17T12:00:00Z', 'user-superadmin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO panelin_workspace.telemetry_events (id, workspace_id, source, kind, label, value, status, session_id, created_at) VALUES
  ('tel-1', 'ws-1', 'calc', 'error', 'Error en cálculo de viento zona 3', '1', 'completed', NULL, '2026-07-20T08:00:00Z'),
  ('tel-2', 'ws-1', 'agent', 'fix', 'Fix prompt cotización techo', '1', 'completed', NULL, '2026-07-20T09:30:00Z'),
  ('tel-3', 'ws-1', 'workspace', 'improvement', 'Propuesta KB seguridad', '15', 'pending', NULL, '2026-07-20T10:30:00Z'),
  ('tel-4', 'ws-1', 'calc', 'patch', 'Patch BOM perfiles', '1', 'completed', NULL, '2026-07-19T16:00:00Z'),
  ('tel-5', 'ws-1', 'agent', 'improvement', 'Sesión iniciada', '42', 'completed', 'sess-1', '2026-10-30T00:00:00Z'),
  ('tel-6', 'ws-1', 'agent', 'improvement', 'Llamada a Agente', '8', 'completed', NULL, '2026-10-29T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
