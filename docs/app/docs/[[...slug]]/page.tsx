import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
  defaultMdxComponents,
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
  FrameworkBadge,
  ComparisonTable,
  Accordion,
  CodeBlock,
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
  KeyboardShortcut,
  ShortcutList,
  CopyButton,
} from '@/components/docs-page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = 'https://soulcache.vercel.app';
const GITHUB_REPO = 'https://github.com/kasihagustinusT/soulcache';
const DOCS_DIR = 'docs/content/docs';

const customComponents = {
  ...defaultMdxComponents,
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
  FrameworkBadge,
  ComparisonTable,
  Accordion,
  CodeBlock,
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
  KeyboardShortcut,
  ShortcutList,
  CopyButton,
};

export default async function Page(props: {
  params: { slug?: string[] };
}) {
  const page = source.getPage(props.params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const slug = (props.params.slug ?? []).join('/');
  const editUrl = `${GITHUB_REPO}/edit/main/${DOCS_DIR}/${slug}.mdx`;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={customComponents} />
        <div className="mt-12 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-6">
          <a
            href={editUrl}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Edit this page on GitHub
          </a>
          <Link
            href="/docs/contributing"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            Report an issue
          </Link>
        </div>
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: { slug?: string[] };
}): Promise<Metadata> {
  const page = source.getPage(props.params.slug);
  if (!page) notFound();

  const slug = (props.params.slug ?? []).join('/');
  const url = `${BASE_URL}/docs/${slug}`;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url,
      siteName: 'SoulCache',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description,
    },
  };
}
