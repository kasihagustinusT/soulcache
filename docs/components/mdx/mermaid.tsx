'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function render() {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: 'inherit',
        themeCSS: 'margin: 1.5rem auto 0;',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });

      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const result = await mermaid.render(id, chart.replaceAll('\\n', '\n'));
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setSvg(`<pre>${chart}</pre>`);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart, resolvedTheme, mounted]);

  if (!mounted || !svg) {
    return (
      <div className="my-6 flex justify-center">
        <div className="h-20 w-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto"
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
