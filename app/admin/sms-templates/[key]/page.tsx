import { AdminSmsTemplateStudio } from "@/components/AdminSmsTemplateStudio";

export default async function AdminSmsTemplateDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <AdminSmsTemplateStudio templateKey={key} />;
}
