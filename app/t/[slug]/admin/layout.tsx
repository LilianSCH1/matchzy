import { AdminTabs } from "@/components/AdminTabs";
import { IconEye } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { TopBar, TopLink } from "@/components/TopBar";
import { bundleOr404, requireOrganizerPage } from "@/lib/server/page";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizerPage(`/t/${slug}/admin`);
  const b = await bundleOr404(slug);
  const base = `/t/${b.tournament.slug}/admin`;
  return (
    <>
      <LiveRefresh seconds={10} />
      <TopBar
        title={b.tournament.name}
        subtitle="Organisation"
        back="/"
        right={<TopLink href={`/t/${b.tournament.slug}`} icon={<IconEye className="size-4" />} label="Vue publique" />}
      />
      <AdminTabs base={base} />
      {children}
    </>
  );
}
