import { endpoints } from '@/lib/constants';
import type { CompanyGroup, CompanySummary } from '@/store/api/usersApi';

import { mockUsers } from './core';
import { mock, type MockHandler } from './mock';

interface MockCompany extends CompanySummary {
  cui: string;
  city: string;
}

const companyDetails: Record<number, { company_name: string; company_cui: string }> = {
  1001: { company_name: 'Sunset Events SRL', company_cui: '1019600034512' },
  1003: { company_name: 'Cluj Live Events SRL', company_cui: 'RO38291047' },
};

mockUsers.forEach((user) => Object.assign(user, companyDetails[user.id] ?? { company_name: '', company_cui: '' }));

const companies: MockCompany[] = [
  { id: 501, user_id: 1001, name: 'Sunset Events SRL', cui: '1019600034512', city: 'Chișinău', is_default: true },
  { id: 502, user_id: 1001, name: 'Sunset Catering SRL', cui: '1021600017785', city: 'Chișinău', is_default: false },
  { id: 503, user_id: 1003, name: 'Cluj Live Events SRL', cui: 'RO38291047', city: 'Cluj-Napoca', is_default: true },
];

export const handlers: MockHandler[] = [
  mock('GET', endpoints.companies, (): CompanyGroup[] =>
    mockUsers.map((user) => ({
      user_id: user.id,
      companies: companies.filter((company) => company.user_id === user.id),
    })),
  ),
];
