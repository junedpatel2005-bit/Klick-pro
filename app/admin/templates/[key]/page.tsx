import { AdminTemplateEditorStudio } from "@/components/AdminTemplateEditorStudio";

export default async function AdminTemplateDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <AdminTemplateEditorStudio templateKey={key} />;
}

