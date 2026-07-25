import type { MDXComponents } from 'mdx/types';
import defaultComponents from 'fumadocs-ui/mdx';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { Mermaid } from './components/mdx/mermaid';
import { Note } from './components/note';
import { Steps, Step } from './components/steps';
import { FeatureGrid, FeatureCard } from './components/feature-grid';
import { Badge, VersionBadge, PackageBadge } from './components/badge';
import { TerminalBlock } from './components/terminal-block';
import { CodeGroup } from './components/code-group';
import { ComparisonTable } from './components/comparison-table';
import { Accordion } from './components/accordion';
import { ArchitectureDiagram, ArchBox, ArchConnector, ArchRow } from './components/architecture-diagram';
import { FlowDiagram, FlowNode, FlowArrow } from './components/flow-diagram';
import { FileTree, FileTreeFile, FileTreeDir } from './components/file-tree';
import { APIBox } from './components/api-box';
import { PropsTable } from './components/props-table';

const builtInComponents: MDXComponents = {
  ...defaultComponents,
  pre: ({ ref: _ref, ...props }) => (
    <CodeBlock {...props}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
  Mermaid,
  Note,
  Steps,
  Step,
  FeatureGrid,
  FeatureCard,
  Badge,
  VersionBadge,
  PackageBadge,
  TerminalBlock,
  CodeGroup,
  ComparisonTable,
  Accordion,
  ArchitectureDiagram,
  ArchBox,
  ArchConnector,
  ArchRow,
  FlowDiagram,
  FlowNode,
  FlowArrow,
  FileTree,
  FileTreeFile,
  FileTreeDir,
  APIBox,
  PropsTable,
};

let _cachedComponents: MDXComponents | null = null;

export function getMDXComponents(): MDXComponents {
  if (_cachedComponents) return _cachedComponents;
  _cachedComponents = { ...builtInComponents };
  return _cachedComponents;
}

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  if (!components) return getMDXComponents();
  return { ...builtInComponents, ...components };
}
