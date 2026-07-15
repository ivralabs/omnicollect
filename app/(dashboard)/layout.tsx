import SidebarNav from '@/components/dashboard/SidebarNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 ml-60 min-h-screen bg-[#0a0f0e]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
