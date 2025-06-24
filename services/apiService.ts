
import { User, UserRole, Expense, ExpenseStatus, AppSettings, NewExpenseData, AppUser, NewUserData } from '../types';
import { LOCAL_STORAGE_KEYS } from '../constants';

// Base URL for the API. Assuming server runs on the same host/port or proxied.
const API_BASE_URL = '/api'; // Adjust if your backend is on a different port during dev (e.g. http://localhost:3001/api)

// Helper to get items from localStorage
const getItem = <T,>(key: string): T | null => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) as T : null;
};

// Helper to set items in localStorage
const setItem = <T,>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Helper for fetch requests
const fetchApi = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};


export const apiService = {
  // --- Auth ---
  login: async (usernameOrEmail: string, password_unused: string): Promise<User> => {
    // Note: password_unused is named to match original, but should be 'password'
    const credentials = { usernameOrEmail, password: password_unused };
    const { user } = await fetchApi<{ user: User }>(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (user) {
      setItem(LOCAL_STORAGE_KEYS.USER, user);
    }
    return user;
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
    // No backend call needed for simple logout, but could be added for session invalidation
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
  },

  getCurrentUser: (): User | null => {
    return getItem<User>(LOCAL_STORAGE_KEYS.USER);
  },

  // --- Settings ---
  getSettings: async (): Promise<AppSettings> => {
    const { settings } = await fetchApi<{ settings: AppSettings }>(`${API_BASE_URL}/settings`);
    return settings;
  },

  saveSettings: async (settings: AppSettings): Promise<AppSettings> => {
    const { settings: savedSettings } = await fetchApi<{ settings: AppSettings }>(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return savedSettings;
  },

  // --- Expenses ---
  getExpenses: async (): Promise<Expense[]> => {
    const { expenses } = await fetchApi<{ expenses: Expense[] }>(`${API_BASE_URL}/expenses`);
    return expenses;
  },

  addExpense: async (expenseData: NewExpenseData): Promise<Expense> => {
    const formData = new FormData();
    formData.append('name', expenseData.name);
    formData.append('amount', expenseData.amount.toString());
    formData.append('currency', expenseData.currency);
    formData.append('department', expenseData.department);
    formData.append('submitterEmail', expenseData.submitterEmail);

    if (expenseData.attachment) {
      formData.append('attachmentFile', expenseData.attachment, expenseData.attachment.name);
    }
    
    // When sending FormData, browser sets Content-Type automatically. Don't set it manually.
    const { expense: newExpense } = await fetchApi<{ expense: Expense }>(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      body: formData, 
    });
    return newExpense;
  },

  approveExpense: async (expenseId: string, userEmail: string, userRole: UserRole): Promise<Expense> => {
    const { expense: updatedExpense } = await fetchApi<{ expense: Expense }>(`${API_BASE_URL}/expenses/${expenseId}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, userRole }),
    });
    return updatedExpense;
  },

  declineExpense: async (expenseId: string, userEmail: string, userRole: UserRole): Promise<Expense> => {
    const { expense: updatedExpense } = await fetchApi<{ expense: Expense }>(`${API_BASE_URL}/expenses/${expenseId}/decline`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, userRole }),
    });
    return updatedExpense;
  },

  // Convenience method used by the dashboard to update an expense's status.
  // Delegates to the appropriate approve or decline endpoint based on the
  // desired status.
  updateExpenseStatus: async (
    expenseId: string,
    status: ExpenseStatus.APPROVED | ExpenseStatus.DECLINED,
    userEmail: string,
    userRole: UserRole
  ): Promise<Expense> => {
    if (status === ExpenseStatus.APPROVED) {
      return apiService.approveExpense(expenseId, userEmail, userRole);
    } else {
      return apiService.declineExpense(expenseId, userEmail, userRole);
    }
  },

  // --- Users ---
  getUsers: async (): Promise<AppUser[]> => {
    const { users } = await fetchApi<{ users: AppUser[] }>(`${API_BASE_URL}/users`);
    return users;
  },

  addUser: async (userData: NewUserData): Promise<AppUser> => {
    const { user: newUser } = await fetchApi<{ user: AppUser }>(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return newUser;
  },

  updateUser: async (userId: string, role: 'SUBMITTER' | 'APPROVER'): Promise<void> => {
    await fetchApi(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
  },

  deleteUser: async (userId: string): Promise<void> => {
    await fetchApi(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
    });
  },
};
