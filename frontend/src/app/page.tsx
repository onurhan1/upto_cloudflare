import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-8 p-8">
        <h1 className="text-6xl font-bold text-white mb-4">Upto</h1>
        <p className="text-xl text-gray-400 mb-8">Security Monitoring & Incident Management Platform</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition font-medium"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}

