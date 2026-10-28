import { endpoints } from '@/lib/constants';
import type { SocialLoginPayload } from '@/lib/social-auth';
import type { SendOtpResponse, User, VerifyOtpResponse } from '@/types/api';

import { baseApi } from './baseApi';

export interface PasswordLoginResponse {
  access?: string;
  refresh?: string;
  detail?: string;
}

export interface SocialLoginResponse {
  access_token?: string;
  refresh_token?: string;
  access?: string;
  refresh?: string;
  user?: User;
  code?: string;
}

export interface VerificationResponse {
  status?: number;
  message?: string;
  data?: unknown;
  errors?: Record<string, string[]>;
  reset_token?: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    passwordLogin: builder.mutation<PasswordLoginResponse, { email: string; password: string }>({
      query: (body) => ({ url: endpoints.passwordLogin, method: 'POST', body }),
    }),
    sendOtp: builder.mutation<SendOtpResponse, { email: string }>({
      query: (body) => ({ url: endpoints.sendOtpLogin, method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<
      VerifyOtpResponse,
      { email: string; otp_code: string; first_name?: string; last_name?: string }
    >({
      query: (body) => ({ url: endpoints.verifyOtpLogin, method: 'POST', body }),
    }),
    resendOtp: builder.mutation<{ message?: string }, { email: string }>({
      query: (body) => ({ url: endpoints.resendOtpLogin, method: 'POST', body }),
    }),
    socialLogin: builder.mutation<SocialLoginResponse, SocialLoginPayload>({
      query: (body) => ({ url: endpoints.socialLogin, method: 'POST', body }),
    }),
    register: builder.mutation<VerificationResponse, FormData>({
      query: (formData) => ({ url: endpoints.register, method: 'POST', body: formData }),
    }),
    verifyEmail: builder.mutation<VerificationResponse, { email: string; otp_code: string }>({
      query: (body) => ({ url: endpoints.verifyEmail, method: 'POST', body }),
    }),
    resendVerifyEmail: builder.mutation<VerificationResponse, { email: string }>({
      query: (body) => ({ url: endpoints.resendVerifyEmail, method: 'POST', body }),
    }),
    fetchCurrentUser: builder.mutation<User, { email: string }>({
      query: (body) => ({ url: endpoints.userLogin, method: 'POST', body }),
    }),
    sendResetCode: builder.mutation<
      VerificationResponse,
      { email: string; device: string; location: string; date: string }
    >({
      query: (body) => ({ url: endpoints.sendResetCode, method: 'POST', body }),
    }),
    resendResetCode: builder.mutation<
      VerificationResponse,
      { email: string; device: string; location: string; date: string }
    >({
      query: (body) => ({ url: endpoints.resendResetCode, method: 'POST', body }),
    }),
    verifyResetCode: builder.mutation<VerificationResponse, { email: string; otp_code: string }>({
      query: (body) => ({ url: endpoints.verifyResetCode, method: 'POST', body }),
    }),
    resetPassword: builder.mutation<
      { status?: number },
      { email: string; reset_token: string; new_password: string; confirm_password: string }
    >({
      query: (body) => ({ url: endpoints.resetPassword, method: 'POST', body }),
    }),
    changePassword: builder.mutation<
      { status?: number; detail?: string; access?: string; refresh?: string },
      { old_password: string; new_password: string; confirm_password: string }
    >({
      query: (body) => ({ url: endpoints.changePassword, method: 'POST', body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  usePasswordLoginMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useSocialLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerifyEmailMutation,
  useFetchCurrentUserMutation,
  useSendResetCodeMutation,
  useResendResetCodeMutation,
  useVerifyResetCodeMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
} = authApi;
