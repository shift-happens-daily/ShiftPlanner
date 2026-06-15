// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Auth from './pages/Auth';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      
      <Route
        path="/employee"
        element={
          <PrivateRoute requiredRole="employee">
            <EmployeeDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/manager"
        element={
          <PrivateRoute requiredRole="manager">
            <ManagerDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            {user?.role === 'manager' ? (
              <Navigate to="/manager" />
            ) : (
              <Navigate to="/employee" />
            )}
          </PrivateRoute>
        }
      />
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

export default App;