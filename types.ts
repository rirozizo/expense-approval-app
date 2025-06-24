
export enum UserRole {
  ADMIN = 'ADMIN',
  SUBMITTER = 'SUBMITTER',
  APPROVER = 'APPROVER',
}

export interface User {
  id: string;
  username: string; // For Admin, this is 'admin'. For others, it's their email.
  email?: string; // Optional, as Admin doesn't have a configured email in the same way
  role: UserRole;
}

export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  status: ExpenseStatus;
  submitterEmail: string;
  submittedAt: string; // ISO date string
  attachment?: {
    filename: string; // Name of the file on the server
    mimetype: string;
    path: string; // Server path to the file (e.g., uploads/filename.ext)
    originalFilename?: string; // Original name of the uploaded file
  };
  approvedOrDeclinedAt?: string; // ISO date string
}

export interface AppSettings {
  submitterEmail: string;
  approverEmail: string;
}

// Props for API service functions usually involve partial types or specific request payloads
export interface LoginCredentials {
  usernameOrEmail: string;
  password?: string; // Made optional as some logins might be passwordless if extended
}

export interface NewExpenseData {
  name: string;
  amount: number; // Will be sent as string in FormData, parsed by backend
  currency: string;
  category: string;
  submitterEmail: string;
  attachment?: File; // The actual file object for upload
}
