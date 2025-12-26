import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background pt-safe-top">
      <div className="max-w-lg mx-auto min-h-screen relative pt-4">
        {children}
      </div>
    </div>
  );
}
