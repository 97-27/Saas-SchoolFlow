import { redirect } from 'next/navigation';

export default async function ScolaritePage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole || 'epc-manoi';
  redirect(`/${ecoleSlug}/admin/depenses`);
}

