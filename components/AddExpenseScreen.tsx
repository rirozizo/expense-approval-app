
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { NewExpenseData, UserRole } from '../types';
import { apiService } from '../services/apiService';
import { Button, Input, Select, FileUploadInput, LoadingSpinner } from './shared/UIElements';
import { CURRENCIES, CATEGORIES } from '../constants';

export const AddExpenseScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState<string>(''); // Store as string for input control
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [attachment, setAttachment] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.role !== UserRole.SUBMITTER) {
    navigate('/dashboard'); // Or show an unauthorized message
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!expenseName.trim()) {
        setError("Expense name cannot be empty.");
        return;
    }

    const newExpenseData: NewExpenseData = {
      name: expenseName.trim(),
      amount: parsedAmount, // Keep as number here, apiService will handle FormData conversion
      currency,
      category,
      submitterEmail: user.email!, // Submitter must have an email
      attachment: attachment || undefined,
    };

    setIsLoading(true);
    try {
      await apiService.addExpense(newExpenseData);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Failed to submit expense.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-2xl">
      <div className="flex items-center mb-6">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-600 mr-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <h2 className="text-3xl font-bold text-slate-800">Add New Expense</h2>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          id="expenseName"
          name="expenseName"
          type="text"
          label="Expense Name"
          placeholder="e.g., Client Dinner, Software Subscription"
          value={expenseName}
          onChange={(e) => setExpenseName(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            id="amount"
            name="amount"
            type="number"
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0.01"
            required
          />
          <Select
            id="currency"
            name="currency"
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={CURRENCIES.map(c => ({ value: c, label: c }))}
            required
          />
        </div>
        <Select
          id="category"
          name="category"
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={CATEGORIES.map(c => ({ value: c, label: c }))}
          required
        />
        <FileUploadInput
          id="attachment"
          name="attachment"
          label="Attach Receipt (Optional)"
          onFileChange={setAttachment}
        />
        <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')} disabled={isLoading} className="w-full sm:w-auto">
                Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? <LoadingSpinner small /> : 'Submit Expense'}
            </Button>
        </div>
      </form>
    </div>
  );
};
