import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FilterProvider } from './context/FilterContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Traffic from './pages/Traffic';
import Ads from './pages/Ads';
import Sales from './pages/Sales';
import Products from './pages/Products';
import Campaigns from './pages/Campaigns';
import Users from './pages/Users';
import ExecutiveSummary from './pages/ExecutiveSummary';
import Profitability from './pages/Profitability';
import CustomerAnalysis from './pages/CustomerAnalysis';
import MetricDetail from './pages/MetricDetail';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <FilterProvider>
            <Layout />
          </FilterProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="analytics/:metricType" element={<MetricDetail />} />
        <Route path="executive" element={<ExecutiveSummary />} />
        <Route path="traffic" element={<Traffic />} />
        <Route path="ads" element={<Ads />} />
        <Route path="sales" element={<Sales />} />
        <Route path="profitability" element={<Profitability />} />
        <Route path="products" element={<Products />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="customers" element={<CustomerAnalysis />} />
        <Route path="users" element={
          <ProtectedRoute adminOnly={true}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="import" element={<Import />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-custom',
            style: {
              background: '#141416',
              color: '#f5f5f5',
              border: '1px solid rgba(227,6,19,0.15)',
              fontFamily: 'Futura PT, sans-serif',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

