import { source } from '@/lib/source';
import { getAdjacentPages } from '@/lib/page-cache';
import { DocsPageWrapper } from '@/components/docs-page-wrapper';
import { getMDXComponents } from '@/mdx-components';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/constants';

export default async function Page(props: {
  params: { slug?: string[] };
}) {
  const page = source.getPage(props.params.slug);
  if (!page) notFound();

  const slug = (props.params.slug ?? []).join('/');
  const url = `/docs/${slug}`;
  const { prev, next } = getAdjacentPages(url);

  const MDX = page.data.body;

  return (
    <DocsPageWrapper
      toc={page.data.toc}
      slug={slug}
      title={page.data.title}
      description={page.data.description}
      prev={prev}
      next={next}
    >
      <MDX components={getMDXComponents()} />
    </DocsPageWrapper>
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
