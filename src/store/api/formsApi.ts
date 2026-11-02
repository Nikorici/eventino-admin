import { eventEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

const formsEndpoints = {
  responses: (eventId: number) => `/api/v1/events/${eventId}/questions-responses/`,
  statistics: (eventId: number) => `/api/v1/events/${eventId}/questions-statistics/`,
} as const;

const CHOICE_QUESTION_TYPES: readonly string[] = ['multiple_choice', 'dropdown', 'checkboxes'];

export function isChoiceQuestionType(type: string): boolean {
  return CHOICE_QUESTION_TYPES.includes(type);
}

export interface FormRespondentUser {
  id: number | string;
  name: string;
  email: string;
  profile_image: string | null;
}

export interface FormAnswerEntry {
  id: string;
  question: string;
  type: string;
  required: boolean;
  answer: string | string[] | null;
}

export interface FormRespondent {
  user: FormRespondentUser;
  responses: Record<string, FormAnswerEntry>;
  has_answered: boolean;
}

export interface FormResponsesResponse {
  total_buyers: number;
  total_responses: number;
  missing_responses: number;
  data: FormRespondent[];
}

export interface FormQuestionStats {
  type: string;
  question: string;
  answers?: Record<string, number>;
  textAnswers?: (string | string[])[];
  totalAnswers: number;
}

export interface FormStatisticsResponse {
  totalParticipants: number;
  totalResponses: number;
  completionRate: number;
  questionStats: Record<string, FormQuestionStats>;
}

export interface FormQuestionConditionPayload {
  optionIndex: number | null;
  action: string;
  targetQuestionIndex: number | null;
  targetQuestionId: string | number | null;
  message: string;
}

export interface FormQuestionPayload {
  question: string;
  type: string;
  options: string[];
  required: boolean;
  id?: string | number;
  conditions: FormQuestionConditionPayload[];
  description: string;
}

export const formsApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['FormResponses', 'FormStatistics'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getEventFormResponses: builder.query<FormResponsesResponse, number>({
        query: (eventId) => formsEndpoints.responses(eventId),
        providesTags: (_result, _error, eventId) => [{ type: 'FormResponses', id: eventId }],
      }),
      getEventFormStatistics: builder.query<FormStatisticsResponse, number>({
        query: (eventId) => formsEndpoints.statistics(eventId),
        providesTags: (_result, _error, eventId) => [{ type: 'FormStatistics', id: eventId }],
      }),
      updateEventQuestions: builder.mutation<unknown, { eventId: number; questions: FormQuestionPayload[] }>({
        query: ({ eventId, questions }) => {
          const body = new FormData();
          body.append('questions', JSON.stringify(questions));
          return { url: eventEndpoint.detail(eventId), method: 'PATCH', body };
        },
        invalidatesTags: (_result, _error, { eventId }) => [
          { type: 'EventDetail', id: eventId },
          { type: 'FormResponses', id: eventId },
          { type: 'FormStatistics', id: eventId },
        ],
      }),
    }),
  });

export const { useGetEventFormResponsesQuery, useGetEventFormStatisticsQuery, useUpdateEventQuestionsMutation } =
  formsApi;
