'use client';

import { useEffect, useRef, useState } from 'react';

const MONOCHROME_VARIABLES = {
  background: '#0d1117',
  fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
  primaryColor: '#161b22',
  primaryTextColor: '#e6edf3',
  primaryBorderColor: '#8b949e',
  secondaryColor: '#161b22',
  tertiaryColor: '#161b22',
  lineColor: '#8b949e',
  clusterBkg: '#010409',
  clusterBorder: '#30363d',
  titleColor: '#e6edf3',
  edgeLabelBackground: '#161b22',
  edgeLabelTextColor: '#e6edf3',
  nodeBorder: '#8b949e',
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
