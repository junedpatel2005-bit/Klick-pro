import { AdminPortal } from "@/components/AdminPortal";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminPortal>{children}</AdminPortal>;
}
