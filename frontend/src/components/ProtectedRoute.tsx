import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';
import { Layout } from './Layout';

const ROLE_HOME: Record<Role, string> = {
  patient: '/patient/dashboard', doctor: '/doctor/dashboard', hospital: '/hospital-admin/dashboard',
  lab: '/lab-admin/dashboard', pharmacy: '/pharmacy-admin/dashboard', admin: '/system-admin/dashboard',
};

/** Ports app.js's requireAuth() + the role scoping every api/<role>/*.php file enforces server-side. */
export function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return <Layout>{children}</Layout>;
}

export { ROLE_HOME };
