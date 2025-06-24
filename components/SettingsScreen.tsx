
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { AppSettings } from '../types';
import { apiService } from '../services/apiService';
import { Button, Input, LoadingSpinner } from './shared/UIElements';

export const SettingsScreen: React.FC = () => {
  const { settings: currentGlobalSettings, fetchSettings, user } = useAuth();
  const [localSettings, setLocalSettings] = useState<AppSettings>({ submitterEmail: '', approverEmail: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentGlobalSettings) {
      setLocalSettings(currentGlobalSettings);
    }
  }, [currentGlobalSettings]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (localSettings.submitterEmail === localSettings.approverEmail && localSettings.submitterEmail !== '') {
        throw new Error("Submitter and Approver emails cannot be the same.");
      }
      await apiService.saveSettings(localSettings);
      await fetchSettings(); // Refresh global settings
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError((err as Error).message || 'Failed to save settings.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!user || user.role !== 'ADMIN') {
    return <p className="text-red-500 text-center">Access Denied. Admins only.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-2xl">
      <div className="flex items-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-600 mr-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527c.47-.336 1.06-.039 1.15.483l.78 4.399c.09.522-.213.998-.735 1.148l-.804.24c-.453.134-.784.543-.866.997l-.112.748c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.07-.424-.384-.764-.78-.93-.398-.164-.855-.142-1.205-.108l-.737.527c-.47.336-1.06.039-1.15-.483l-.78-4.399c-.09-.522.213-.998.735-1.148l.804-.24c.453-.134.784-.543-.866-.997l.112-.748ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
        </svg>
        <h2 className="text-3xl font-bold text-slate-800">Application Settings</h2>
      </div>
      
      <p className="mb-6 text-gray-600">Configure email addresses for user roles. The password for these users will be the same as their email address.</p>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
      {successMessage && <p className="mb-4 text-sm text-green-600 bg-green-100 p-3 rounded-md">{successMessage}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          id="submitterEmail"
          name="submitterEmail"
          type="email"
          label="Submitter Email (User A)"
          placeholder="user.a@example.com"
          value={localSettings.submitterEmail}
          onChange={handleInputChange}
          
        />
        <Input
          id="approverEmail"
          name="approverEmail"
          type="email"
          label="Approver Email (User B)"
          placeholder="user.b@example.com"
          value={localSettings.approverEmail}
          onChange={handleInputChange}
          
        />
        <div className="pt-2">
          <Button type="submit" variant="primary" fullWidth disabled={isLoading}>
            {isLoading ? <LoadingSpinner small /> : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};
