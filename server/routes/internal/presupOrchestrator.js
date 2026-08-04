/**
 * Rutas internas para testing y ejecución del Presupuestación Orchestrator.
 *
 * Auth: Bearer / X-Api-Key = API_AUTH_TOKEN (same contract as
 * /api/internal/panelin and Deep Research). Anonymous callers burn
 * callAgentOnce LLM spend on every sub-agent step — must stay gated.
 */

import { Router } from 'express';
import { runPresupFlow } from '../../lib/presupOrchestrator.js';
import { requireAuth } from '../../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/internal/presup/run
 *
 * Ejecuta un flujo completo de presupuestación usando el orchestrator.
 *
 * Body esperado:
 * {
 *   "channel": "chat" | "wa" | "ml" | "wolfboard" | "manual",
 *   "consulta": "string",
 *   "cliente": { ...opcional... },
 *   "mode": "ligero" | "profundo"   // default: "ligero"
 * }
 */
router.post('/run', async (req, res) => {
  try {
    const { channel, consulta, cliente, mode } = req.body || {};

    if (!consulta || typeof consulta !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'El campo "consulta" es obligatorio y debe ser string',
      });
    }

    // Pass request-scoped pino logger (provided by pino-http middleware) when available
    const result = await runPresupFlow(
      {
        channel: channel || 'manual',
        consulta,
        cliente,
      },
      {
        mode: mode || 'ligero',
        logger: req.log ? req.log.child({ component: 'presup-orchestrator' }) : undefined,
      }
    );

    res.json({
      ok: true,
      requestId: result.requestId,
      status: result.status,
      totalCostUsd: result.totalCostUsd,
      trace: result.trace,
      artifacts: result.artifacts,
      gates: result.gates,
    });
  } catch (err) {
    (req.log || console).error({ err, route: '/api/internal/presup/run' }, 'Error executing presup flow');
    res.status(500).json({
      ok: false,
      error: err.message || 'Error interno del orchestrator',
    });
  }
});

/**
 * GET /api/internal/presup/status
 * Health check básico del orchestrator
 */
router.get('/status', (req, res) => {
  res.json({
    ok: true,
    service: 'presupOrchestrator',
    version: 'v1-scaffolding',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/internal/presup/run/example
 * Devuelve un ejemplo de body para usar en POST /run
 */
router.get('/run/example', (req, res) => {
  res.json({
    description: 'Ejemplo de body para POST /api/internal/presup/run',
    body: {
      channel: 'chat',
      consulta: 'Necesito cotizar 380m2 de techo para nave industrial en zona 3, altura 8.5m',
      cliente: { nombre: 'Acme Metals', rut: '12345678-9' },
      mode: 'profundo' // o 'ligero'
    },
    nota: 'Ruta interna — requiere Authorization: Bearer ${API_AUTH_TOKEN}.',
  });
});

export default router;
