import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm">
        <p className="text-8xl font-bold text-white/10 select-none">404</p>
        <div>
          <h1 className="text-xl font-bold text-white">Page not found</h1>
          <p className="text-sm text-gray-500 mt-1">The page you're looking for doesn't exist or has been moved.</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary btn-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <Link to="/" className="btn-primary btn-sm">
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
