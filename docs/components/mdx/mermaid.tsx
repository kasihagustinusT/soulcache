'use client';

import { useEffect, useRef, useState } from 'react';

const MONOCHROME_VARIABLES = {
  fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
  fontSize: 14,
  primaryColor: '#3a3a3a',
  primaryTextColor: '#ffffff',
  primaryBorderColor: '#e6edf3',
  secondaryColor: '#2c2c2c',
  secondaryTextColor: '#f0f6fc',
  secondaryBorderColor: '#8b949e',
  tertiaryColor: '#161b22',
  tertiaryTextColor: '#e6edf3',
  tertiaryBorderColor: '#6e7681',
  lineColor: '#6e7681',
  clusterBkg: '#161b22',
  clusterBorder: '#30363d',
  titleColor: '#6e7681',
  edgeLabelBackground: '#21262d',
  edgeLabelTextColor: '#e6edf3',
  nodeBorder: '#e6edf3',
  nodeTextColor: '#e6edf3',
};

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
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
        theme: 'base',
        themeVariables: MONOCHROME_VARIABLES,
        themeCSS: 'margin: 1.5rem auto 0;',
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
  }, [chart, mounted]);

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
