
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { ExpenseStatus, UserRole } from '../../types';
import { APP_NAME } from '../../constants';

// --- Navbar ---
export const Navbar: React.FC = () => {
  const { user, logout, settings } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClasses = "px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-700 transition-colors";
  const activeNavLinkClasses = "bg-slate-900";

  return (
    <nav className="bg-slate-800 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <NavLink to="/dashboard" className="flex-shrink-0 text-xl font-bold">
              {APP_NAME}
            </NavLink>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <NavLink to="/dashboard" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>Dashboard</NavLink>
              {user?.role === UserRole.ADMIN && (
                <NavLink to="/settings" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>Settings</NavLink>
              )}
            </div>
          </div>
          <div className="hidden md:block">
            {user && (
              <div className="flex items-center space-x-3">
                <span className="text-sm">Welcome, {user.role === UserRole.ADMIN ? user.username : user.email}!</span>
                <Button onClick={handleLogout} variant="danger" size="sm">Logout</Button>
              </div>
            )}
          </div>
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="block h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="block h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink to="/dashboard" className={({isActive}) => `block ${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`} onClick={()=>setMobileMenuOpen(false)}>Dashboard</NavLink>
            {user?.role === UserRole.ADMIN && (
              <NavLink to="/settings" className={({isActive}) => `block ${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`} onClick={()=>setMobileMenuOpen(false)}>Settings</NavLink>
            )}
          </div>
          {user && (
            <div className="pt-4 pb-3 border-t border-gray-700">
              <div className="flex items-center px-5">
                <div className="ml-3">
                  <div className="text-base font-medium leading-none text-white">{user.role === UserRole.ADMIN ? user.username : user.email}</div>
                  <div className="text-sm font-medium leading-none text-gray-400">{user.role}</div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center border border-transparent font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    primary: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 focus:ring-slate-500 text-gray-700 border-gray-300',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-white',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id: string;
}
export const Input: React.FC<InputProps> = ({ label, id, className, ...props }) => {
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        id={id}
        className={`mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm disabled:bg-gray-50 ${className || ''}`}
        {...props}
      />
    </div>
  );
};

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  id: string;
  options: Array<{ value: string | number; label: string }>;
}
export const Select: React.FC<SelectProps> = ({ label, id, options, className, ...props }) => {
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        id={id}
        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm rounded-md disabled:bg-gray-50 ${className || ''}`}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};

// --- FileUploadInput ---
interface FileUploadInputProps {
  id: string;
  name: string;
  label: string;
  onFileChange: (file: File | null) => void;
  accept?: string;
}
export const FileUploadInput: React.FC<FileUploadInputProps> = ({ id, name, label, onFileChange, accept }) => {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    onFileChange(file);
    setFileName(file ? file.name : null);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex text-sm text-gray-600">
            <label htmlFor={id} className="relative cursor-pointer bg-white rounded-md font-medium text-slate-600 hover:text-slate-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-slate-500">
              <span>Upload a file</span>
              <input id={id} name={name} type="file" className="sr-only" onChange={handleFileChange} accept={accept} />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
          <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB (mock)</p>
        </div>
      </div>
    </div>
  );
};

// --- LoadingSpinner ---
interface LoadingSpinnerProps {
  small?: boolean;
}
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ small = false }) => {
  const sizeClass = small ? "h-5 w-5" : "h-12 w-12";
  return (
    <div className={`animate-spin rounded-full ${sizeClass} border-t-2 border-b-2 border-slate-600`}></div>
  );
};

// --- Badge ---
interface BadgeProps {
  status: ExpenseStatus;
}
export const Badge: React.FC<BadgeProps> = ({ status }) => {
  let colorClasses = '';
  switch (status) {
    case ExpenseStatus.PENDING:
      colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-300';
      break;
    case ExpenseStatus.APPROVED:
      colorClasses = 'bg-green-100 text-green-800 border-green-300';
      break;
    case ExpenseStatus.DECLINED:
      colorClasses = 'bg-red-100 text-red-800 border-red-300';
      break;
    default:
      colorClasses = 'bg-gray-100 text-gray-800 border-gray-300';
  }
  return (
    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${colorClasses}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
};

// --- ConfirmModal ---
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={title.toLowerCase().includes("decline") ? "danger" : "primary"} onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  );
};

