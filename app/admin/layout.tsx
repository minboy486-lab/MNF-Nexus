import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell flex min-h-dvh">
      <div className="bg-mesh" aria-hidden />
      <AdminSidebar />
      <div className="admin-main flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
