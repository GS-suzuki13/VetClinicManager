// Botão hambúrguer animado: as três barras viram um X quando o menu está aberto
// (e voltam ao recolher). Usado na sidebar (desktop) e na barra do celular.
export default function HamburgerButton({ open, onClick, label, className = '' }: { open: boolean; onClick: () => void; label: string; className?: string }) {
  const bar = 'absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      title={label}
      className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-slate-800 active:scale-95 ${className}`}
    >
      <span className="relative block h-4 w-5">
        <span className={`${bar} top-0 origin-center ${open ? 'translate-y-[7px] rotate-45' : 'group-hover:-translate-y-px'}`} />
        <span className={`${bar} top-[7px] ${open ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'}`} />
        <span className={`${bar} top-[14px] origin-center ${open ? '-translate-y-[7px] -rotate-45' : 'group-hover:translate-y-px'}`} />
      </span>
    </button>
  );
}
