import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import { getStoredLanguage } from './services/language';

function FullScreenLoader() {
  return <div style={styles.loader}>{getStoredLanguage() === 'en' ? 'Loading...' : 'Загрузка...'}</div>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />}
      />
      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />}
      />
      <Route
        path="/employee"
        element={(
          <PrivateRoute requiredRole="employee">
            <EmployeeDashboard />
          </PrivateRoute>
        )}
      />
      <Route
        path="/manager"
        element={(
          <PrivateRoute requiredRole="manager">
            <ManagerDashboard />
          </PrivateRoute>
        )}
      />
      <Route
        path="/dashboard"
        element={(
          <PrivateRoute>
            <Navigate to={user?.role === 'manager' ? '/manager' : '/employee'} replace />
          </PrivateRoute>
        )}
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

const styles = {
  loader: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #002642 0%, #4F646F 100%)',
    color: '#F4FAFF',
    fontSize: '18px',
    fontWeight: '600',
  },
};

export default App;
