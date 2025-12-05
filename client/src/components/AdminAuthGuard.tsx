import { FC, PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const AdminAuthGuard: FC<PropsWithChildren> = ({ children }) => {
  const isAuthenticated = sessionStorage.getItem('adminAuth') === 'true';
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
