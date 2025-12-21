import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto min-h-screen relative">
        {children}
      </div>
    </div>
  );
}
