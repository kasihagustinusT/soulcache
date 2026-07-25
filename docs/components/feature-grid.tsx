import { type ReactNode } from 'react';

interface FeatureGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  href?: string;
}

const gridCols = {
  2: 'sm:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

export function FeatureGrid({ children, columns = 3 }: FeatureGridProps) {
  return (
    <div className={`my-8 grid grid-cols-1 gap-4 ${gridCols[columns]}`}>
      {children}
    </div>
  );
}

export function FeatureCard({ title, description, icon, href }: FeatureCardProps) {
  const className =
    'group relative rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:shadow-lg';

  const content = (
    <>
      {icon && (
        <div className="mb-3 text-primary">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-[0.95rem] font-semibold text-foreground group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
