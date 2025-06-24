
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
  department: string;
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
  currentApprovalLevel: number;
  maxApprovalLevel: number;
  approvals: ApprovalRecord[];
}

export interface AppSettings {
  submitterEmail: string;
  approverEmail: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: 'SUBMITTER' | 'APPROVER';
  createdAt: string;
}

export interface NewUserData {
  email: string;
  role: 'SUBMITTER' | 'APPROVER';
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
  department: string;
  submitterEmail: string;
  attachment?: File; // The actual file object for upload
}

export interface ApprovalRecord {
  level: number;
  approverEmail: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  approvedAt?: string;
}

export interface ApprovalRule {
  id: string;
  department: string;
  amountMin: number;
  amountMax: number;
  currency: string;
  level: number;
  recipient: string;
}
