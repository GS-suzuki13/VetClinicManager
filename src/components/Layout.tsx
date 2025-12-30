import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  return (
    <div className="ml-64 min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-8 py-6">
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        </div>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
