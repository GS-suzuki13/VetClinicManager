import { ReactNode } from 'react';

// Peças visuais compartilhadas pelas telas de vendas, financeiro, internação e
// relacionamento (mesmo estilo das telas existentes).

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (tab: T) => void }) {
  return (
    <div className="flex border-b border-slate-200 mb-6 overflow-x-auto overflow-y-hidden">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
            value === id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-slate-100">
          {title && <h2 className="font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatTile({ label, value, tone = 'slate', hint }: { label: string; value: ReactNode; tone?: 'slate' | 'emerald' | 'red' | 'amber' | 'blue'; hint?: string }) {
  const tones = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-700',
    red: 'text-red-600',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 min-w-0">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
      {hint && (
        <p className="text-xs text-slate-500 mt-1 truncate" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>{children}</span>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-8 text-center text-slate-500 text-sm">
        {children}
      </td>
    </tr>
  );
}

export function PrimaryButton({ onClick, children, type = 'button', disabled }: { onClick?: () => void; children: ReactNode; type?: 'button' | 'submit'; disabled?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 transition-colors font-medium text-sm whitespace-nowrap"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ onClick, children, disabled }: { onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors font-medium text-sm whitespace-nowrap"
    >
      {children}
    </button>
  );
}
