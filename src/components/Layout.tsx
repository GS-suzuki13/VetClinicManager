import { ReactNode } from 'react';

interface LayoutProps {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}

export default function Layout({ title, collapsed, children }: LayoutProps) {
  return (
    <div
      className={`transition-all duration-300 ${
        collapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">{title}</h1>
        {children}
      </div>
    </div>
  );
}