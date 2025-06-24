import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Expense, ExpenseStatus, UserRole } from '../types';
import { apiService } from '../services/apiService';
import { Button, LoadingSpinner, Badge, ConfirmModal } from './shared/UIElements';

const ExpenseListItem: React.FC<{ expense: Expense, onUpdate: () => void }> = ({ expense, onUpdate }) => {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<'approve' | 'decline' | null>(null);

  const handleAction = async (status: ExpenseStatus.APPROVED | ExpenseStatus.DECLINED) => {
    if (!user || (user.role !== UserRole.APPROVER && user.role !== UserRole.ADMIN)) return;
    setIsUpdating(true);
    try {
      await apiService.updateExpenseStatus(expense.id, status, user.email || '', user.role);
      onUpdate(); // Refresh the list
    } catch (error) {
      console.error(`Failed to ${status === ExpenseStatus.APPROVED ? 'approve' : 'decline'} expense:`, error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsUpdating(false);
      setShowConfirmModal(false);
      setActionToConfirm(null);
    }
  };

  const openConfirmModal = (action: 'approve' | 'decline') => {
    setActionToConfirm(action);
    setShowConfirmModal(true);
  };

  const confirmAction = () => {
    if (actionToConfirm === 'approve') {
      handleAction(ExpenseStatus.APPROVED);
    } else if (actionToConfirm === 'decline') {
      handleAction(ExpenseStatus.DECLINED);
    }
  };

  const canApproveDecline = user && (user.role === UserRole.APPROVER || (user.role === UserRole.ADMIN && expense.status === ExpenseStatus.PENDING));

  const attachmentDisplayFilename = expense.attachment?.originalFilename || expense.attachment?.filename;

  return (
    <li className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <h3 className="text-xl font-semibold text-slate-800">{expense.name}</h3>
        <Badge status={expense.status} />
      </div>
      <p className="text-gray-700"><span className="font-medium">Amount:</span> {expense.currency} {expense.amount.toFixed(2)}</p>
      <p className="text-gray-600"><span className="font-medium">Department:</span> {expense.department}</p>
      <p className="text-gray-600"><span className="font-medium">Submitted by:</span> {expense.submitterEmail}</p>
      <p className="text-xs text-gray-500"><span className="font-medium">Submitted on:</span> {new Date(expense.submittedAt).toLocaleDateString()}</p>
      {expense.attachment && attachmentDisplayFilename && (
        <p className="text-sm text-gray-700">
          <span className="font-medium">Attachment:</span> {attachmentDisplayFilename}
          {expense.attachment.path && (
            <a 
              href={`/${expense.attachment.path}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="ml-1 text-blue-600 hover:text-blue-800 hover:underline"
              aria-label={`View or download attachment ${attachmentDisplayFilename}`}
            >
              (View/Download)
            </a>
          )}
        </p>
      )}
      {canApproveDecline && expense.status === ExpenseStatus.PENDING && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => openConfirmModal('approve')} 
            variant="success" 
            size="sm"
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {isUpdating && actionToConfirm === 'approve' ? <LoadingSpinner small/> : 'Approve'}
          </Button>
          <Button 
            onClick={() => openConfirmModal('decline')} 
            variant="danger" 
            size="sm"
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {isUpdating && actionToConfirm === 'decline' ? <LoadingSpinner small/> : 'Decline'}
          </Button>
        </div>
      )}
      {showConfirmModal && actionToConfirm && (
        <ConfirmModal
            isOpen={showConfirmModal}
            onClose={() => setShowConfirmModal(false)}
            onConfirm={confirmAction}
            title={`Confirm ${actionToConfirm.charAt(0).toUpperCase() + actionToConfirm.slice(1)}`}
            message={`Are you sure you want to ${actionToConfirm} this expense?`}
        />
      )}
    </li>
  );
};

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allExpenses = await apiService.getExpenses(user?.email, user?.role);
      setExpenses(allExpenses.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (err) {
      setError('Failed to load expenses.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [user, fetchExpenses]);

  if (isLoading) return <div className="flex justify-center mt-10"><LoadingSpinner /></div>;
  if (error) return <p className="text-red-500 text-center">{error}</p>;
  if (!user) return <p className="text-center">Not authenticated.</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-800">Expense Dashboard</h2>
        {user.role === UserRole.SUBMITTER && (
          <Button onClick={() => navigate('/add-expense')} variant="primary" className="w-full md:w-auto">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add New Expense
          </Button>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 10.125 4.5h-4.5A3.375 3.375 0 0 0 2.25 7.875v10.5A3.375 3.375 0 0 0 5.625 21.75h5.25c1.474 0 2.801-.6 3.754-1.583M19.5 14.25h-5.625c-.621 0-1.125.504-1.125 1.125v2.25c0 .621.504 1.125 1.125 1.125h3.375c.621 0 1.125-.504 1.125-1.125V16.5A2.25 2.25 0 0 0 19.5 14.25Z" />
          </svg>
          <p className="mt-5 text-lg font-medium text-gray-700">No expenses found.</p>
          {user.role === UserRole.SUBMITTER && <p className="mt-2 text-sm text-gray-500">Click "Add New Expense" to get started.</p>}
           {user.role === UserRole.APPROVER && <p className="mt-2 text-sm text-gray-500">There are currently no expenses awaiting your approval.</p>}
           {user.role === UserRole.ADMIN && <p className="mt-2 text-sm text-gray-500">No expenses have been submitted yet.</p>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expenses.map(expense => (
            <ExpenseListItem key={expense.id} expense={expense} onUpdate={fetchExpenses} />
          ))}
        </ul>
      )}
    </div>
  );
};