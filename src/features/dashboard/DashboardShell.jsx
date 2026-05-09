import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Wrench, RotateCcw, Pencil, Save } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import ComercialDashboard from './pages/ComercialDashboard.jsx';
import CrmDashboard from './pages/CrmDashboard.jsx';
import DevopsDashboard from './pages/DevopsDashboard.jsx';
import { useDashboardLayout } from './useDashboardLayout.js';

const SECTIONS = [
  { path: 'comercial', label: 'Comercial', icon: LayoutDashboard, description: 'KPIs, ventas, márgenes' },
  { path: 'crm',       label: 'CRM',       icon: Users,           description: 'Cotizaciones, entregas' },
  { path: 'devops',    label: 'Técnico',   icon: Wrench,          description: 'Health, stock, build' },
];

function currentScopeFromPath(pathname) {
  const match = SECTIONS.find((s) => pathname.includes(`/dashboard/${s.path}`));
  return match?.path || 'comercial';
}

function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-stone-200 flex flex-col">
      <div className="px-4 py-4 border-b border-stone-100">
        <div className="text-xs uppercase tracking-wide text-stone-500 font-semibold">BMC</div>
        <div className="text-base font-semibold text-stone-900">Dashboard</div>
        <Badge variant="accent" className="mt-2">v0 · local</Badge>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {SECTIONS.map(({ path, label, icon: Icon, description }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-start gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`
            }
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{label}</div>
              <div className="text-[11px] opacity-70 truncate">{description}</div>
            </div>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-stone-100">
        <a
          href="/"
          className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900"
        >
          ← Volver a la calculadora
        </a>
      </div>
    </aside>
  );
}

function Topbar({ editable, onToggleEdit, onReset, scope }) {
  return (
    <header className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-stone-900 capitalize">{scope}</h1>
        <p className="text-xs text-stone-500">
          Datos en vivo desde Google Sheets · Layout en tu navegador (localStorage)
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editable && (
          <Button variant="ghost" size="sm" onClick={onReset} title="Restaurar layout por defecto">
            <RotateCcw size={14} />
            Restaurar
          </Button>
        )}
        <Button variant={editable ? 'accent' : 'outline'} size="sm" onClick={onToggleEdit}>
          {editable ? <><Save size={14} /> Guardar</> : <><Pencil size={14} /> Editar layout</>}
        </Button>
      </div>
    </header>
  );
}

export default function DashboardShell() {
  const location = useLocation();
  const scope = currentScopeFromPath(location.pathname);
  const [editable, setEditable] = useState(false);
  const { reset } = useDashboardLayout(scope);

  return (
    <div className="dashboard-root flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar
          scope={scope}
          editable={editable}
          onToggleEdit={() => setEditable((v) => !v)}
          onReset={reset}
        />
        <div className="flex-1 overflow-auto p-4 bg-stone-50">
          <Routes>
            <Route index element={<Navigate to="comercial" replace />} />
            <Route path="comercial" element={<ComercialDashboard editable={editable} />} />
            <Route path="crm" element={<CrmDashboard editable={editable} />} />
            <Route path="devops" element={<DevopsDashboard editable={editable} />} />
            <Route path="*" element={<Navigate to="comercial" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
