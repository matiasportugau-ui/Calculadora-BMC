// Top-10 run 2026-05-11 (item #10): cleanup imports muertos + wire de loading/error/saving.
import { useCallback, useEffect, useState } from "react";
import {
  Settings,
  Flag,
  Cpu,
  Calculator,
  Clock,
  GitBranch,
  Bell,
  Send,
  Users,
  Webhook,
  MessageSquare,
  History,
  Download,
  Save,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Calendar
} from "lucide-react";

// --- Styles (following Geist/Apple style from BmcWaCockpit) ---
const styles = {
  container: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    background: "#fff",
  },
  sidebar: {
    width: 240,
    borderRight: "1px solid #e5e5ea",
    display: "flex",
    flexDirection: "column",
    background: "#f9f9fb",
    overflowY: "auto",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflowY: "auto",
    padding: "24px 32px",
  },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: 13,
    color: active ? "#0071e3" : "#48484a",
    background: active ? "#eaf2ff" : "transparent",
    borderLeft: active ? "3px solid #0071e3" : "3px solid transparent",
    fontWeight: active ? 600 : 400,
    transition: "all 0.1s ease",
  }),
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1d1d1f",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#86868b",
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e5ea",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#1d1d1f",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#48484a",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e5ea",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e5ea",
    fontSize: 13,
    fontFamily: "inherit",
    background: "#fff",
    outline: "none",
  },
  btnPrimary: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#0071e3",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  btnGhost: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #e5e5ea",
    background: "#fff",
    color: "#1d1d1f",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  toggle: (active) => ({
    width: 40,
    height: 22,
    borderRadius: 11,
    background: active ? "#34c759" : "#e5e5ea",
    position: "relative",
    cursor: "pointer",
    transition: "background 0.2s ease",
  }),
  toggleKnob: (active) => ({
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    position: "absolute",
    top: 2,
    left: active ? 20 : 2,
    transition: "left 0.2s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  }),
  badge: (color) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
    background: color === "blue" ? "#eaf2ff" : color === "green" ? "#e6f7ec" : "#f2f2f7",
    color: color === "blue" ? "#0071e3" : color === "green" ? "#2a7a2a" : "#6e6e73",
  })
};

const SECTIONS = [
  { id: "flags", label: "Feature Flags", icon: Flag },
  { id: "general", label: "General", icon: Settings },
  { id: "ai", label: "AI por tarea", icon: Cpu },
  { id: "quote", label: "Auto-cotización", icon: Calculator },
  { id: "sla", label: "SLA & Horarios", icon: Clock },
  { id: "routing", label: "Reglas de ruteo", icon: GitBranch },
  { id: "followups", label: "Follow-ups", icon: Bell },
  { id: "outbound", label: "Outbound", icon: Send },
  { id: "operators", label: "Operadores", icon: Users },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "prompts", label: "Prompts", icon: MessageSquare },
  { id: "audit", label: "Audit Log", icon: History },
  { id: "export", label: "Export/Import", icon: Download },
];

export default function BmcWaSettingsPanel({ token, apiBase }) {
  const [activeSection, setActiveSection] = useState("flags");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/wa/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setConfig(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleUpdateSetting = async (key, value) => {
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/wa/settings`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ key, value })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fetchConfig();
    } catch (e) {
      alert(`Error guardando: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = async (key, enabled) => {
    setSaving(true);
    try {
      const r = await fetch(`${apiBase}/api/wa/flags/${key}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ enabled })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fetchConfig();
    } catch (e) {
      alert(`Error toggle flag: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return <div style={{ padding: 40, color: "#86868b" }}>Cargando configuración...</div>;
  }

  // Top-10 run 2026-05-11 (item #10): mostrar errores de fetch y estado "Guardando…" en lugar de silenciarlos.
  const statusBanner = error ? (
    <div style={{ margin: "12px 24px", padding: "10px 14px", background: "#fff1f0", border: "1px solid #ffa39e", borderRadius: 8, color: "#cf1322", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
      <AlertCircle size={16} /> Error cargando configuración: {error}
      <button onClick={() => { setError(""); fetchConfig(); }} style={{ marginLeft: "auto", padding: "4px 10px", border: "1px solid #cf1322", background: "transparent", color: "#cf1322", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Reintentar</button>
    </div>
  ) : saving ? (
    <div style={{ margin: "12px 24px", padding: "8px 12px", background: "#f0f9ff", border: "1px solid #91d5ff", borderRadius: 8, color: "#0958d9", fontSize: 13 }}>
      Guardando cambios…
    </div>
  ) : null;

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={{ padding: "20px 16px", fontSize: 12, fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Configuración
        </div>
        {SECTIONS.map((s) => (
          <div 
            key={s.id} 
            style={styles.navItem(activeSection === s.id)}
            onClick={() => setActiveSection(s.id)}
          >
            <s.icon size={16} />
            {s.label}
          </div>
        ))}
      </div>
      
      <div style={styles.main}>
        {statusBanner}
        {activeSection === "flags" && <FlagsSection config={config} onToggle={handleToggleFlag} />}
        {activeSection === "general" && <GeneralSection config={config} onUpdate={handleUpdateSetting} />}
        {activeSection === "ai" && <AiSection config={config} onUpdate={handleUpdateSetting} apiBase={apiBase} token={token} />}
        {activeSection === "quote" && <QuoteSection config={config} onUpdate={handleUpdateSetting} />}
        {activeSection === "sla" && <SlaSection config={config} onUpdate={handleUpdateSetting} />}
        {activeSection === "routing" && <RoutingSection config={config} token={token} apiBase={apiBase} />}
        {activeSection === "followups" && <FollowupsSection config={config} onUpdate={handleUpdateSetting} />}
        {activeSection === "outbound" && <OutboundSection config={config} onUpdate={handleUpdateSetting} />}
        {activeSection === "operators" && <OperatorsSection token={token} apiBase={apiBase} />}
        {activeSection === "webhooks" && <WebhooksSection token={token} apiBase={apiBase} />}
        {activeSection === "prompts" && <PromptsSection config={config} onUpdate={handleUpdateSetting} />}
        {activeSection === "audit" && <AuditSection token={token} apiBase={apiBase} />}
        {activeSection === "export" && <ExportSection token={token} apiBase={apiBase} />}
      </div>
    </div>
  );
}

// --- Sub-sections ---

function FlagsSection({ config, onToggle }) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>Feature Flags</h2>
      <p style={styles.sectionSubtitle}>Habilita o deshabilita módulos completos en tiempo real.</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {config.flags.map(f => (
          <div key={f.key} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{f.key}</div>
              <div 
                style={styles.toggle(f.enabled)} 
                onClick={() => onToggle(f.key, !f.enabled)}
              >
                <div style={styles.toggleKnob(f.enabled)} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#86868b", lineHeight: 1.4, margin: 0 }}>
              {f.description}
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <span style={styles.badge("default")}>Owner: {f.owner || "System"}</span>
              {f.expiresAt && <span style={styles.badge("blue")}>Expira: {new Date(f.expiresAt).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneralSection({ config, onUpdate }) {
  const enricher = config.settings.filter(s => s.key.startsWith("enricher."));
  const data = config.settings.filter(s => s.key.startsWith("data."));
  
  return (
    <div>
      <h2 style={styles.sectionTitle}>General</h2>
      <p style={styles.sectionSubtitle}>Configuración base del worker y retención de datos.</p>
      
      <div style={styles.card}>
        <h3 style={styles.cardTitle}><RefreshCw size={16} /> Enricher Worker</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {enricher.map(s => (
            <div key={s.key} style={styles.inputGroup}>
              <label style={styles.label}>{s.key.split(".")[1]}</label>
              <input 
                type="number" 
                style={styles.input} 
                defaultValue={s.value}
                onBlur={(e) => onUpdate(s.key, Number(e.target.value))}
              />
              <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}><History size={16} /> Retención de Datos</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {data.map(s => (
            <div key={s.key} style={styles.inputGroup}>
              <label style={styles.label}>{s.key.split(".")[1]}</label>
              {typeof s.value === "boolean" ? (
                <div 
                  style={styles.toggle(s.value)} 
                  onClick={() => onUpdate(s.key, !s.value)}
                >
                  <div style={styles.toggleKnob(s.value)} />
                </div>
              ) : (
                <input 
                  type="number" 
                  style={styles.input} 
                  defaultValue={s.value}
                  onBlur={(e) => onUpdate(s.key, Number(e.target.value))}
                />
              )}
              <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiSection({ config, onUpdate, apiBase, token }) {
  const tasks = ["classify", "suggestions", "quoteParse", "followupText"];
  const [testing, setTesting] = useState({});

  const handleTest = async (task) => {
    setTesting(prev => ({ ...prev, [task]: true }));
    try {
      const r = await fetch(`${apiBase}/api/wa/settings/test-ai`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ task, sampleMessage: "Hola, necesito presupuesto para 50m2 de isodec eps 50mm para techo en color blanco." })
      });
      const j = await r.json();
      alert(`Resultado AI (${task}):\n\n${JSON.stringify(j, null, 2)}`);
    } catch (e) {
      alert(`Error test: ${e.message}`);
    } finally {
      setTesting(prev => ({ ...prev, [task]: false }));
    }
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>AI por tarea</h2>
      <p style={styles.sectionSubtitle}>Personaliza el modelo y parámetros para cada función de inteligencia artificial.</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 20 }}>
        {tasks.map(task => {
          const settings = config.settings.filter(s => s.key.startsWith(`ai.${task}.`));
          return (
            <div key={task} style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>
                  {task === "classify" && "Clasificación"}
                  {task === "suggestions" && "Sugerencias"}
                  {task === "quoteParse" && "Parsing de Cotización"}
                  {task === "followupText" && "Texto de Follow-up"}
                </h3>
                <button 
                  style={{ ...styles.btnGhost, padding: "4px 8px", fontSize: 11 }}
                  onClick={() => handleTest(task)}
                  disabled={testing[task]}
                >
                  {testing[task] ? "Probando..." : "Probar"}
                </button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {settings.map(s => {
                  const subkey = s.key.split(".").pop();
                  return (
                    <div key={s.key} style={styles.inputGroup}>
                      <label style={styles.label}>{subkey}</label>
                      {subkey === "provider" ? (
                        <select 
                          style={styles.select} 
                          value={s.value}
                          onChange={(e) => onUpdate(s.key, e.target.value)}
                        >
                          <option value="anthropic">Anthropic</option>
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Gemini</option>
                          <option value="grok">Grok</option>
                        </select>
                      ) : (
                        <input 
                          type={typeof s.value === "number" ? "number" : "text"}
                          style={styles.input}
                          defaultValue={s.value}
                          step={subkey === "temperature" ? 0.1 : 1}
                          onBlur={(e) => onUpdate(s.key, typeof s.value === "number" ? Number(e.target.value) : e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuoteSection({ config, onUpdate }) {
  const settings = config.settings.filter(s => s.key.startsWith("quote."));
  
  return (
    <div>
      <h2 style={styles.sectionTitle}>Auto-cotización</h2>
      <p style={styles.sectionSubtitle}>Reglas para la generación automática de presupuestos.</p>
      
      <div style={styles.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {settings.map(s => (
            <div key={s.key} style={styles.inputGroup}>
              <label style={styles.label}>{s.key.split(".")[1]}</label>
              {typeof s.value === "boolean" ? (
                <div 
                  style={styles.toggle(s.value)} 
                  onClick={() => onUpdate(s.key, !s.value)}
                >
                  <div style={styles.toggleKnob(s.value)} />
                </div>
              ) : (
                <input 
                  type="number" 
                  style={styles.input} 
                  defaultValue={s.value}
                  onBlur={(e) => onUpdate(s.key, Number(e.target.value))}
                />
              )}
              <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlaSection({ config, onUpdate }) {
  const sla = config.settings.filter(s => s.key.startsWith("sla.") && s.key !== "sla.businessHours");
  const bh = config.settings.find(s => s.key === "sla.businessHours")?.value || {};
  
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const dayLabels = { mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado", sun: "Domingo" };

  const handleBhChange = (day, index, val) => {
    const newBh = { ...bh };
    if (!newBh[day]) newBh[day] = [9, 18];
    newBh[day][index] = Number(val);
    onUpdate("sla.businessHours", newBh);
  };

  const toggleDay = (day) => {
    const newBh = { ...bh };
    newBh[day] = newBh[day] ? null : [9, 18];
    onUpdate("sla.businessHours", newBh);
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>SLA & Horarios</h2>
      <p style={styles.sectionSubtitle}>Define tiempos de respuesta esperados y horas hábiles.</p>
      
      <div style={styles.card}>
        <h3 style={styles.cardTitle}><AlertCircle size={16} /> Alertas de SLA</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {sla.map(s => (
            <div key={s.key} style={styles.inputGroup}>
              <label style={styles.label}>{s.key.split(".")[1]}</label>
              {s.key === "sla.breachAction" ? (
                <select 
                  style={styles.select} 
                  value={s.value}
                  onChange={(e) => onUpdate(s.key, e.target.value)}
                >
                  <option value="notify">Notificar</option>
                  <option value="reassign">Reasignar</option>
                  <option value="webhook">Disparar Webhook</option>
                </select>
              ) : (
                <input 
                  type="number" 
                  style={styles.input} 
                  defaultValue={s.value}
                  onBlur={(e) => onUpdate(s.key, Number(e.target.value))}
                />
              )}
              <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}><Calendar size={16} /> Horas de Negocio ({bh.tz || "America/Montevideo"})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {days.map(day => (
            <div key={day} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "1px solid #f2f2f7" }}>
              <div style={{ width: 100, fontSize: 13, fontWeight: 600 }}>{dayLabels[day]}</div>
              <div 
                style={styles.toggle(!!bh[day])} 
                onClick={() => toggleDay(day)}
              >
                <div style={styles.toggleKnob(!!bh[day])} />
              </div>
              {bh[day] ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input 
                    type="number" 
                    style={{ ...styles.input, width: 60 }} 
                    value={bh[day][0]} 
                    onChange={(e) => handleBhChange(day, 0, e.target.value)}
                  />
                  <span>a</span>
                  <input 
                    type="number" 
                    style={{ ...styles.input, width: 60 }} 
                    value={bh[day][1]} 
                    onChange={(e) => handleBhChange(day, 1, e.target.value)}
                  />
                  <span style={{ fontSize: 12, color: "#86868b" }}>hs</span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: "#86868b" }}>Cerrado</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoutingSection({ token, apiBase }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);

  const fetchRules = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/api/wa/rules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      setRules(j.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSaveRule = async (rule) => {
    try {
      const method = rule.id ? "PATCH" : "POST";
      const url = rule.id ? `${apiBase}/api/wa/rules/${rule.id}` : `${apiBase}/api/wa/rules`;
      const r = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(rule)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEditingRule(null);
      fetchRules();
    } catch (e) {
      alert(`Error guardando regla: ${e.message}`);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    try {
      const r = await fetch(`${apiBase}/api/wa/rules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fetchRules();
    } catch (e) {
      alert(`Error eliminando: ${e.message}`);
    }
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Reglas de ruteo</h2>
      <p style={styles.sectionSubtitle}>Automatiza la asignación, etiquetado y alertas de chats.</p>
      
      {!editingRule ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <button style={styles.btnPrimary} onClick={() => setEditingRule({ name: "Nueva Regla", enabled: true, priority: 10, when_conditions: {}, then_actions: {} })}>
              <Plus size={16} /> Nueva Regla
            </button>
          </div>

          {loading ? <div>Cargando reglas...</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rules.length === 0 ? (
                <div style={{ ...styles.card, textAlign: "center", color: "#86868b" }}>
                  No hay reglas configuradas.
                </div>
              ) : rules.map(rule => (
                <div key={rule.id} style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{rule.name}</div>
                      <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>
                        Prioridad: {rule.priority} · {rule.enabled ? "Activada" : "Pausada"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...styles.btnGhost, padding: "4px 8px" }} onClick={() => setEditingRule(rule)}><Settings size={14} /></button>
                      <button style={{ ...styles.btnGhost, padding: "4px 8px", color: "#ff3b30" }} onClick={() => handleDeleteRule(rule.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <RuleEditor rule={editingRule} onSave={handleSaveRule} onCancel={() => setEditingRule(null)} />
      )}
    </div>
  );
}

function RuleEditor({ rule, onSave, onCancel }) {
  const [data, setData] = useState(rule);

  const updateCondition = (key, val) => {
    setData({ ...data, when_conditions: { ...data.when_conditions, [key]: val } });
  };

  const updateAction = (key, val) => {
    setData({ ...data, then_actions: { ...data.then_actions, [key]: val } });
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{rule.id ? "Editar Regla" : "Nueva Regla"}</h3>
      
      <div style={styles.inputGroup}>
        <label style={styles.label}>Nombre de la regla</label>
        <input 
          style={styles.input} 
          value={data.name} 
          onChange={e => setData({ ...data, name: e.target.value })} 
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Prioridad</label>
          <input 
            type="number" 
            style={styles.input} 
            value={data.priority} 
            onChange={e => setData({ ...data, priority: Number(e.target.value) })} 
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Estado</label>
          <div style={styles.toggle(data.enabled)} onClick={() => setData({ ...data, enabled: !data.enabled })}>
            <div style={styles.toggleKnob(data.enabled)} />
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #f2f2f7", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>CUANDO (Condiciones)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Teléfono contiene</label>
            <input 
              style={styles.input} 
              value={data.when_conditions.phone_matches || ""} 
              onChange={e => updateCondition("phone_matches", e.target.value)} 
              placeholder="+598..."
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Intent es</label>
            <select 
              style={styles.select} 
              value={data.when_conditions.intent || ""} 
              onChange={e => updateCondition("intent", e.target.value)}
            >
              <option value="">(cualquiera)</option>
              <option value="quote">Cotización</option>
              <option value="technical">Técnica</option>
              <option value="followup">Seguimiento</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #f2f2f7", borderRadius: 8, padding: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>ENTONCES (Acciones)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Asignar a</label>
            <input 
              style={styles.input} 
              value={data.then_actions.assign || ""} 
              onChange={e => updateAction("assign", e.target.value)} 
              placeholder="operator_id"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Etiquetar como</label>
            <input 
              style={styles.input} 
              value={data.then_actions.label || ""} 
              onChange={e => updateAction("label", e.target.value)} 
              placeholder="urgente, vip, etc."
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button style={styles.btnPrimary} onClick={() => onSave(data)}><Save size={16} /> Guardar Regla</button>
        <button style={styles.btnGhost} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function FollowupsSection({ config, onUpdate }) {
  const followups = config.settings.find(s => s.key === "followups.rules")?.value || [];
  
  const handleAddRule = () => {
    const newRules = [...followups, { kind: "custom", hours: 24, template: "Hola...", enabled: true }];
    onUpdate("followups.rules", newRules);
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Follow-ups</h2>
      <p style={styles.sectionSubtitle}>Reglas para el seguimiento automático de clientes.</p>
      
      <div style={{ marginBottom: 20 }}>
        <button style={styles.btnPrimary} onClick={handleAddRule}><Plus size={16} /> Nueva Regla</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {followups.map((rule, idx) => (
          <div key={idx} style={styles.card}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Nombre/Tipo</label>
                <input type="text" style={styles.input} value={rule.kind} readOnly />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Horas de espera</label>
                <input type="number" style={styles.input} value={rule.hours} readOnly />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Estado</label>
                <div style={styles.toggle(rule.enabled)}><div style={styles.toggleKnob(rule.enabled)} /></div>
              </div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Template del mensaje</label>
              <textarea style={{ ...styles.input, height: 80, resize: "none" }} value={rule.template} readOnly />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutboundSection({ config, onUpdate }) {
  const settings = config.settings.filter(s => s.key.startsWith("outbound."));
  
  return (
    <div>
      <h2 style={styles.sectionTitle}>Outbound</h2>
      <p style={styles.sectionSubtitle}>Límites de envío y control de spam.</p>
      
      <div style={styles.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {settings.map(s => (
            <div key={s.key} style={styles.inputGroup}>
              <label style={styles.label}>{s.key.split(".")[1]}</label>
              <input 
                type="number" 
                style={styles.input} 
                defaultValue={s.value}
                onBlur={(e) => onUpdate(s.key, Number(e.target.value))}
              />
              <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperatorsSection({ token, apiBase }) {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOperators = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/api/wa/operators`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      setOperators(j.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => { fetchOperators(); }, [fetchOperators]);

  if (loading && operators.length === 0) {
    // Top-10 run 2026-05-11 (item #10): hint visible mientras carga.
    return <div style={{ padding: 24, color: "#86868b" }}>Cargando operadores…</div>;
  }

  return (
    <div>
      <h2 style={styles.sectionTitle}>Operadores</h2>
      <p style={styles.sectionSubtitle}>Gestiona el acceso del equipo al módulo.</p>
      
      <div style={{ marginBottom: 20 }}>
        <button style={styles.btnPrimary}><Plus size={16} /> Invitar Operador</button>
      </div>

      <div style={styles.card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e5ea", textAlign: "left" }}>
              <th style={{ padding: "12px 8px", fontSize: 12, color: "#86868b" }}>Nombre</th>
              <th style={{ padding: "12px 8px", fontSize: 12, color: "#86868b" }}>Email</th>
              <th style={{ padding: "12px 8px", fontSize: 12, color: "#86868b" }}>Rol</th>
              <th style={{ padding: "12px 8px", fontSize: 12, color: "#86868b" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {operators.map(op => (
              <tr key={op.operator_id} style={{ borderBottom: "1px solid #f2f2f7" }}>
                <td style={{ padding: "12px 8px", fontSize: 13 }}>{op.name}</td>
                <td style={{ padding: "12px 8px", fontSize: 13 }}>{op.email}</td>
                <td style={{ padding: "12px 8px", fontSize: 13 }}>
                  <span style={styles.badge(op.role === "owner" ? "blue" : "default")}>{op.role}</span>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <button style={{ ...styles.btnGhost, padding: "4px 8px" }}>Revocar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Top-10 run 2026-05-11 (item #10): la sección Webhooks es placeholder; los props token/apiBase no se usan acá.
function WebhooksSection() {
  return (
    <div>
      <h2 style={styles.sectionTitle}>Webhooks</h2>
      <p style={styles.sectionSubtitle}>Notificaciones salientes para integraciones externas.</p>
      
      <div style={{ marginBottom: 20 }}>
        <button style={styles.btnPrimary}><Plus size={16} /> Nuevo Webhook</button>
      </div>

      <div style={styles.card}>
        <div style={{ textAlign: "center", padding: 20, color: "#86868b" }}>
          Configura endpoints para recibir eventos message.in, quote.created, etc.
        </div>
      </div>
    </div>
  );
}

function PromptsSection({ config, onUpdate }) {
  const prompts = config.settings.filter(s => s.key.startsWith("prompts."));
  
  return (
    <div>
      <h2 style={styles.sectionTitle}>Prompts</h2>
      <p style={styles.sectionSubtitle}>Personaliza las instrucciones del sistema para los modelos AI.</p>
      
      {prompts.map(s => (
        <div key={s.key} style={styles.card}>
          <label style={{ ...styles.label, fontSize: 14 }}>{s.key.split(".")[1]}</label>
          <textarea 
            style={{ ...styles.input, height: 120, marginTop: 8, resize: "vertical" }} 
            defaultValue={s.value}
            placeholder="Default del sistema..."
            onBlur={(e) => onUpdate(s.key, e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>{s.description}</div>
        </div>
      ))}
    </div>
  );
}

function AuditSection({ token, apiBase }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const r = await fetch(`${apiBase}/api/wa/audit-log?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const j = await r.json();
        setLogs(j.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [apiBase, token]);

  return (
    <div>
      <h2 style={styles.sectionTitle}>Audit Log</h2>
      <p style={styles.sectionSubtitle}>Historial de cambios y acciones administrativas.</p>
      
      <div style={styles.card}>
        {loading ? <div>Cargando logs...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.map(log => (
              <div key={log.id} style={{ padding: "8px 0", borderBottom: "1px solid #f2f2f7", fontSize: 12 }}>
                <span style={{ color: "#86868b" }}>[{new Date(log.occurred_at).toLocaleString()}]</span>{" "}
                <strong>{log.operator_id || "System"}</strong>: {log.action} en {log.target}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExportSection({ token, apiBase }) {
  const handleExport = () => {
    window.open(`${apiBase}/api/wa/config/export?token=${token}`, "_blank");
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>Export/Import</h2>
      <p style={styles.sectionSubtitle}>Mueve configuraciones entre entornos o realiza backups.</p>
      
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ ...styles.card, flex: 1 }}>
          <h3 style={styles.cardTitle}><Download size={16} /> Exportar</h3>
          <p style={{ fontSize: 13, color: "#86868b", marginBottom: 20 }}>Descarga toda la configuración actual en formato JSON.</p>
          <button style={styles.btnPrimary} onClick={handleExport}><Download size={16} /> Descargar JSON</button>
        </div>
        <div style={{ ...styles.card, flex: 1 }}>
          <h3 style={styles.cardTitle}><Plus size={16} /> Importar</h3>
          <p style={{ fontSize: 13, color: "#86868b", marginBottom: 20 }}>Sube un archivo JSON para sobrescribir la configuración.</p>
          <button style={styles.btnGhost} disabled><Plus size={16} /> Subir archivo</button>
        </div>
      </div>
    </div>
  );
}
