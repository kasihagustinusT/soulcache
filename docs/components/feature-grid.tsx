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
    'group rounded-xl border border-gray-200 dark:border-gray-800 p-6 transition-all hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-600/5 dark:hover:shadow-primary-500/5 bg-white dark:bg-gray-900/50';

  const content = (
    <>
      {icon && (
        <div className="mb-3 text-primary-600 dark:text-primary-400">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
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
