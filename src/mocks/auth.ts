import { endpoints } from '@/lib/constants';
import type { SocialLoginPayload } from '@/lib/social-auth';
import type { User } from '@/types/api';

import { mockOrganizer, mockTokenFor, mockUsers } from './core';
import { bodyOf, mock, mockError, type MockHandler, type MockRequest } from './mock';

export const MOCK_WRONG_PASSWORD = 'wrong-password';
export const MOCK_INVALID_CODE = '000000';

interface PendingRegistration {
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
}

const registeredEmails = new Set<string>(['ion.rusu@gmail.com', 'elena.munteanu@yahoo.com']);
const pendingRegistrations = new Map<string, PendingRegistration>();
const resetTokens = new Map<string, string>();

function normalize(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function knownUser(email: string): User | undefined {
  return mockUsers.find((user) => user.email === email);
}

function accountExists(email: string): boolean {
  return knownUser(email) !== undefined || registeredEmails.has(email);
}

function sessionUser(email: string): User {
  return knownUser(email) ?? mockOrganizer;
}

function formValue(request: MockRequest, key: string): string {
  const body = request.body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const value = body.get(key);
    return typeof value === 'string' ? value.trim() : '';
  }
  const record = bodyOf<Record<string, unknown>>(request);
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function socialSession(user: User) {
  const tokens = mockTokenFor(user.id);
  return { access_token: tokens.access, refresh_token: tokens.refresh, user };
}

export const handlers: MockHandler[] = [
  mock('POST', endpoints.passwordLogin, (request) => {
    const body = bodyOf<{ email: string; password: string }>(request);
    if (body.password === MOCK_WRONG_PASSWORD) {
      return mockError(401, { detail: 'No active account found with the given credentials' });
    }
    return mockTokenFor(sessionUser(normalize(body.email)).id);
  }),

  mock('POST', endpoints.sendOtpLogin, (request) => {
    const email = normalize(bodyOf<{ email: string }>(request).email);
    if (!email) return mockError(400, { status: 400, message: 'Email is required' });
    return { status: 200, message: 'Login verification code sent to your email', user_exists: accountExists(email) };
  }),

  mock('POST', endpoints.resendOtpLogin, { status: 200, message: 'Code Resent' }),

  mock('POST', endpoints.verifyOtpLogin, (request) => {
    const body = bodyOf<{ email: string; otp_code: string; first_name: string; last_name: string }>(request);
    const email = normalize(body.email);
    if (body.otp_code === MOCK_INVALID_CODE) {
      return { status: 400, message: 'Invalid or expired verification code' };
    }
    const isNewAccount = !accountExists(email);
    if (isNewAccount && (!body.first_name?.trim() || !body.last_name?.trim())) {
      return { status: 400, message: 'First name and last name are required for new accounts' };
    }
    if (isNewAccount) registeredEmails.add(email);
    const user = sessionUser(email);
    return { status: 200, message: 'Login successful', ...mockTokenFor(user.id), user, is_new_account: isNewAccount };
  }),

  mock('POST', endpoints.socialLogin, (request) => {
    const payload = bodyOf<SocialLoginPayload>(request);
    if (payload.provider === 'apple.com') {
      const email = normalize(payload.user?.email);
      if (!email) {
        return mockError(400, { error: 'Apple did not return an email. Please provide one.', code: 'apple_email_required' });
      }
      return socialSession(sessionUser(email));
    }
    return socialSession(mockOrganizer);
  }),

  mock('POST', endpoints.register, (request) => {
    const email = normalize(formValue(request, 'email'));
    if (!email) return { status: 400, message: 'Email is required' };
    if (email.endsWith('con')) return { status: 400, message: "'.con' is not valid mail domain", data: email };
    if (accountExists(email)) return { status: 400, message: 'User with this email already exists' };
    if (formValue(request, 'password').length < 8) {
      return {
        status: 400,
        message: 'Invalid data',
        errors: { password: ['This password is too short. It must contain at least 8 characters.'] },
      };
    }
    pendingRegistrations.set(email, {
      email,
      first_name: formValue(request, 'first_name'),
      last_name: formValue(request, 'last_name'),
      organization_name: formValue(request, 'organization_name'),
    });
    return { status: 200, message: 'Verify Your Email to continue' };
  }),

  mock('POST', endpoints.verifyEmail, (request) => {
    const body = bodyOf<{ email: string; otp_code: string }>(request);
    const email = normalize(body.email);
    if (body.otp_code === MOCK_INVALID_CODE || !pendingRegistrations.has(email)) {
      return { status: 400, message: 'Something wrong', data: 'Invalid otp' };
    }
    pendingRegistrations.delete(email);
    registeredEmails.add(email);
    return { status: 200, message: 'Email verified' };
  }),

  mock('POST', endpoints.resendVerifyEmail, (request) => {
    const email = normalize(bodyOf<{ email: string }>(request).email);
    if (!pendingRegistrations.has(email)) {
      return mockError(400, { status: 400, message: 'No account found with this email address' });
    }
    return { status: 200, message: 'Code Resent' };
  }),

  mock('POST', endpoints.sendResetCode, (request) => {
    const email = normalize(bodyOf<{ email: string }>(request).email);
    if (!accountExists(email)) {
      return { status: 400, message: 'Something wrong', data: 'User matching query does not exist.' };
    }
    return { status: 200, data: 'Reset Password Code Send' };
  }),

  mock('POST', endpoints.resendResetCode, (request) => {
    const email = normalize(bodyOf<{ email: string }>(request).email);
    if (!accountExists(email)) {
      return mockError(400, { status: 400, message: 'No account found with this email address' });
    }
    return { status: 200, message: 'Code Resent' };
  }),

  mock('POST', endpoints.verifyResetCode, (request) => {
    const body = bodyOf<{ email: string; otp_code: string }>(request);
    const email = normalize(body.email);
    if (body.otp_code === MOCK_INVALID_CODE || !accountExists(email)) {
      return { status: 400, message: 'Something wrong', data: 'Invalid otp' };
    }
    const token = `mock-reset-${Date.now().toString(36)}`;
    resetTokens.set(email, token);
    return { status: 200, message: 'Code is correct', reset_token: token };
  }),

  mock('POST', endpoints.resetPassword, (request) => {
    const body = bodyOf<{ email: string; reset_token: string; new_password: string; confirm_password: string }>(request);
    const email = normalize(body.email);
    if (!body.reset_token || resetTokens.get(email) !== body.reset_token) {
      return mockError(400, { detail: 'Invalid or expired reset token' });
    }
    if ((body.new_password ?? '').length < 8) {
      return mockError(400, { new_password: ['Ensure this field has at least 8 characters.'] });
    }
    if (body.new_password !== body.confirm_password) {
      return mockError(400, { detail: "Password fields didn't match." });
    }
    resetTokens.delete(email);
    return { detail: 'Password changed successfully.' };
  }),
];
