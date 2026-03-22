/**
 * Shown when a user tries to access a route they don't have permission for.
 */
import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { homePath } = useAuth();

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <ShieldOff className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-sm text-gray-400 mb-6">
          You don't have permission to view this page.
        </p>
        <button onClick={() => navigate(homePath())} className="btn-primary">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
