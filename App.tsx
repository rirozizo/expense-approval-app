
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { User, UserRole, AppSettings } from './types';
import { apiService } from './services/apiService';
import { LoginScreen } from './components/AuthComponents';
import { DashboardScreen } from './components/DashboardComponents';
import { SettingsScreen } from './components/SettingsScreen';
import { AddExpenseScreen } from './components/AddExpenseScreen';
import { Navbar, LoadingSpinner } from './components/shared/UIElements';
import { APP_NAME, APP_VERSION } from './constants';

interface AuthContextType {
  user: User | null;
  settings: AppSettings | null;
  login: (credentials: { usernameOrEmail: string; password?: string }) => Promise<User | null>;
  logout: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const currentSettings = await apiService.getSettings();
      setSettings(currentSettings);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
      //setError('Failed to load application settings.');
      // For this app, settings might not exist initially, so don't throw error.
      setSettings({ submitterEmail: '', approverEmail: '' });
    }
  }, []);
  
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      setError(null);
      await fetchSettings();
      const currentUser = apiService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      setIsLoading(false);
    };
    initAuth();
  }, [fetchSettings]);

  const login = async (credentials: { usernameOrEmail: string; password?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      // Corrected: Removed the third argument (settings) as apiService.login expects only two.
      // The backend handles settings lookup for login internally.
      const loggedInUser = await apiService.login(credentials.usernameOrEmail, credentials.password || '');
      setUser(loggedInUser);
      setIsLoading(false);
      return loggedInUser;
    } catch (err) {
      setError((err as Error).message || 'Login failed');
      setIsLoading(false);
      return null;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await apiService.logout();
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, settings, login, logout, fetchSettings, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute: React.FC<{ allowedRoles: UserRole[] }> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to dashboard or a specific "unauthorized" page if preferred
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return <Outlet />;
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
     return (
      <div className="flex flex-col min-h-screen">
        <header className="bg-slate-800 text-white p-4 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
          </div>
        </header>
        <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 flex justify-center items-center">
          <LoadingSpinner />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {user && <Navbar />}
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          
          <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.APPROVER, UserRole.SUBMITTER]} />}>
            <Route path="/dashboard" element={<DashboardScreen />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[UserRole.SUBMITTER]} />}>
            <Route path="/add-expense" element={<AddExpenseScreen />} />
          </Route>
          
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </main>
      <footer className="bg-slate-800 text-white text-center p-4 mt-auto">
        &copy; {new Date().getFullYear()} {APP_NAME} v{APP_VERSION}. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
