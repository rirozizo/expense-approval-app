
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../App';
import { UserRole } from '../types';
import { Button, Input, LoadingSpinner } from './shared/UIElements';
import { APP_NAME } from '../constants';

export const LoginScreen: React.FC = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
        // Simple client-side validation, actual error handling for failed login is in useAuth
        alert("Please enter both username/email and password.");
        return;
    }
    const loggedInUser = await login({ usernameOrEmail, password });
    if (loggedInUser) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-150px)] bg-gray-100 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto text-slate-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Sign in to {APP_NAME}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Use 'admin' / 'admin' for Admin.
            <br />
            For User A/B, use configured email for both fields.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <Input
            id="usernameOrEmail"
            name="usernameOrEmail"
            type="text"
            label="Username or Email"
            placeholder="admin / user@example.com"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? <LoadingSpinner small /> : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ProtectedRoute is now in App.tsx to avoid circular dependency issues with useAuth
// export const ProtectedRoute: React.FC<{ allowedRoles: UserRole[] }> = ({ allowedRoles, children }) => { ... }
// It is now an Outlet based wrapper.
