import { Button, Card, CardBody, Input } from '@heroui/react';
import { FC, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ADMIN_PASSWORD = 'desgraciat';

export const LoginPage: FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('adminAuth') === 'true';
  });
  const [error, setError] = useState('');
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // In a real app, you'd want to hash this password and store it securely
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <h1 className="text-2xl font-brand uppercase tracking-widest">
            Admin Login
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={password}
              onValueChange={setPassword}
              variant="bordered"
              label="Password"
              placeholder="Enter admin password"
              isInvalid={!!error}
              errorMessage={error}
            />
            <Button
              type="submit"
              color="primary"
              variant="shadow"
              className="w-full font-brand uppercase tracking-widest"
            >
              Login
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
