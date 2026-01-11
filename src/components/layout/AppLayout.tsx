import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background pt-safe-top">
      <div className="w-full mx-auto min-h-screen relative pt-4 sm:max-w-xl md:max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1400px]">
        {children}
      </div>
    </div>
  );
}
