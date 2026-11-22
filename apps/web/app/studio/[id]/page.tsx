import { notFound } from 'next/navigation';
import { Editor } from '@/components/studio/editor';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const project = db.projects.find((p) => p.id === id);
  if (!project) notFound();
  return (
    <Editor
      initial={{
        project,
        media: db.media.find((m) => m.id === project.mediaId) ?? null,
        renders: db.renders.filter((r) => r.projectId === id).reverse(),
        jobs: db.jobs.filter((j) => j.payload.projectId === id).reverse().slice(0, 10),
      }}
    />
  );
}
