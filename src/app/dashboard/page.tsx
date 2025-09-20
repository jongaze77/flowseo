import Link from 'next/link';
import AppLayout from '../../components/layout/AppLayout';

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to your FlowSEO workspace</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium text-gray-900 mb-2">User Management</h3>
            <p className="text-gray-600 text-sm mb-4">Manage team members and their access to your workspace</p>
            <a
              href="/users"
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 hover:text-blue-900 rounded border border-blue-300 cursor-pointer transition-colors inline-block"
            >
              Manage Users →
            </a>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Projects</h3>
            <p className="text-gray-600 text-sm mb-4">View and manage your SEO projects</p>
            <Link
              href="/projects"
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 hover:text-blue-900 rounded border border-blue-300 cursor-pointer transition-colors inline-block"
            >
              Manage Projects →
            </Link>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics</h3>
            <p className="text-gray-600 text-sm mb-4">Track your SEO performance and metrics</p>
            <span className="text-gray-400 text-sm">Coming Soon</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}