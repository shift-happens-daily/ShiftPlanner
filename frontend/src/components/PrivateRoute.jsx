import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getStoredLanguage } from '../services/language';

export default function PrivateRoute({ children, requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div style={styles.loader}>{getStoredLanguage() === 'en' ? 'Loading...' : 'Загрузка...'}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'manager' ? '/manager' : '/employee'} replace />;
  }

  return children;
}

const styles = {
  loader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '18px',
    color: '#F4FAFF',
  },
};
