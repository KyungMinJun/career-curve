import { ReactNode } from 'react';
import logoImage from '@/assets/logo.png';
import { cn } from '@/lib/utils';

type LogoSize = 'none' | 'sm' | 'lg';

export function PageHeader({
  title,
  subtitle,
  right,
  logoSize = 'sm',
  className,
  titleClassName,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  logoSize?: LogoSize;
  className?: string;
  titleClassName?: string;
}) {
  const logoClassName =
    logoSize === 'lg'
      ? 'w-11 h-11'
      : logoSize === 'sm'
        ? 'w-6 h-6'
        : '';

  return (
    <header className={cn('px-4 pb-4 bg-background safe-top-lg', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {logoSize !== 'none' && (
            <img
              src={logoImage}
              alt="커브 로고"
              className={cn(logoClassName, 'object-contain shrink-0')}
              loading="eager"
            />
          )}
          <div className="min-w-0">
            <h1 className={cn('text-xl font-bold text-foreground truncate', titleClassName)}>{title}</h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
