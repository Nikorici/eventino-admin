import type { FormAnswerEntry, FormQuestionStats, FormRespondent } from '@/store/api/formsApi';
import type { EventQuestion } from '@/types/api';

import { findMockEvent, type MockEvent } from './core';
import { isoDate, mock, mockError, type MockHandler } from './mock';

type StoredQuestion = EventQuestion & { description: string; conditions: unknown[] };

interface MockRespondent {
  id: number;
  name: string;
  email: string;
  answered: boolean;
  answers: Record<string, string | string[]>;
}

const RO_WEEKDAYS = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'];
const RO_MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function dayLabel(offset: number): string {
  const date = new Date(`${isoDate(offset)}T12:00:00`);
  return `${RO_WEEKDAYS[date.getDay()]}, ${date.getDate()} ${RO_MONTHS[date.getMonth()]}`;
}

const PEOPLE = [
  'Ana Popescu',
  'Ion Rusu',
  'Maria Ciobanu',
  'Andrei Lungu',
  'Elena Cojocaru',
  'Victor Munteanu',
  'Cristina Botnaru',
  'Mihai Ceban',
  'Natalia Țurcanu',
  'Alexandru Bivol',
  'Irina Grosu',
  'Dumitru Sârbu',
  'Olga Rotari',
  'Sergiu Lupu',
  'Diana Moraru',
  'Vasile Croitoru',
  'Ludmila Cebotari',
  'Radu Ionescu',
  'Tatiana Melnic',
  'Petru Gheorghiu',
  'Doina Prisacaru',
  'Nicolae Usatîi',
  'Silvia Bălan',
  'Igor Postică',
  'Carolina Darie',
  'Marin Railean',
  'Valentina Stratan',
  'Gheorghe Vrabie',
];

const NOTES = [
  'Snacks fără gluten la standurile de degustare, vă rog.',
  'Folosesc scaun cu rotile. Zona VIP Lounge este accesibilă?',
  'Venim un grup de 8 persoane din Bălți.',
  'Sunt alergică la nuci.',
  'Aș vrea să știu dacă există transfer de la Gara Feroviară.',
];

const respondentsByEvent = new Map<number, MockRespondent[]>();

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 9301 + salt * 49297) * 233280;
  return value - Math.floor(value);
}

function emailOf(name: string): string {
  return `${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .join('.')}@gmail.com`;
}

function pickWeighted(options: string[], roll: number, weights: number[]): string {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = roll * total;
  for (let index = 0; index < options.length; index += 1) {
    cursor -= weights[index] ?? 1;
    if (cursor <= 0) return options[index];
  }
  return options[options.length - 1];
}

function seedWineFestival(event: MockEvent): void {
  let noteCursor = 0;
  const existing = (event.detail?.questions_data ?? []).map((question) => ({
    ...question,
    description: 'description' in question && typeof question.description === 'string' ? question.description : '',
    conditions: 'conditions' in question && Array.isArray(question.conditions) ? question.conditions : [],
  }));
  const questions: StoredQuestion[] = [
    {
      id: 703,
      question: 'Ai peste 18 ani?',
      description: 'Degustările de vin sunt doar pentru adulți.',
      type: 'multiple_choice',
      options: ['Da', 'Nu'],
      required: true,
      conditions: [{ optionIndex: 1, action: 'end', targetQuestionIndex: null, targetQuestionId: null, message: '' }],
    },
    {
      id: 704,
      question: 'În ce zi vei participa?',
      description: '',
      type: 'multiple_choice',
      options: [dayLabel(-1), dayLabel(0), dayLabel(1)],
      required: true,
      conditions: [],
    },
    {
      id: 705,
      question: 'Ce stiluri de vin preferi?',
      description: '',
      type: 'checkboxes',
      options: ['Roșu', 'Alb', 'Rose', 'Spumant', 'Desert'],
      required: false,
      conditions: [],
    },
    ...existing,
    {
      id: 706,
      question: 'Ceva ce ar trebui să știm?',
      description: 'Alergii, nevoi de accesibilitate sau alte cereri',
      type: 'paragraph',
      options: [],
      required: false,
      conditions: [],
    },
  ];
  event.detail = { ...event.detail, questions_data: questions };

  const respondents = PEOPLE.map((name, index): MockRespondent => {
    const answered = seeded(index, 1) > 0.24;
    const answers: Record<string, string | string[]> = {};
    if (answered) {
      const adult = seeded(index, 2) > 0.04;
      answers['703'] = adult ? 'Da' : 'Nu';
      if (adult) {
        questions.forEach((question, questionIndex) => {
          const roll = seeded(index, questionIndex + 3);
          const options = question.options ?? [];
          if (question.id === 703) return;
          if (question.type === 'multiple_choice' || question.type === 'dropdown') {
            answers[String(question.id)] = pickWeighted(options, roll, [5, 4, 3, 1]);
          } else if (question.type === 'checkboxes') {
            const chosen = options.filter((_, optionIndex) => seeded(index, questionIndex * 10 + optionIndex) > 0.35 + optionIndex * 0.12);
            if (chosen.length > 0) answers[String(question.id)] = chosen;
          } else if (question.type === 'phone_number') {
            if (roll > 0.3) {
              answers[String(question.id)] = `+373 69 ${100 + Math.floor(roll * 899)} ${String(Math.floor(seeded(index, 99) * 1000)).padStart(3, '0')}`;
            }
          } else if (question.type === 'email') {
            answers[String(question.id)] = emailOf(name);
          } else if (roll > 0.72) {
            answers[String(question.id)] = NOTES[noteCursor++ % NOTES.length];
          }
        });
      }
    }
    return { id: 5100 + index, name, email: emailOf(name), answered, answers };
  });
  respondentsByEvent.set(event.id, respondents);
}

const wineFestival = findMockEvent(4101);
if (wineFestival) seedWineFestival(wineFestival);

function currentQuestions(eventId: number): StoredQuestion[] {
  const event = findMockEvent(eventId);
  return (event?.detail?.questions_data ?? []).map((question) => ({
    ...question,
    description: 'description' in question && typeof question.description === 'string' ? question.description : '',
    conditions: 'conditions' in question && Array.isArray(question.conditions) ? question.conditions : [],
  }));
}

function responsesOf(eventId: number) {
  const questions = currentQuestions(eventId);
  const respondents = respondentsByEvent.get(eventId) ?? [];
  const data: FormRespondent[] = respondents.map((respondent) => {
    const responses: Record<string, FormAnswerEntry> = {};
    if (respondent.answered) {
      questions.forEach((question) => {
        const key = String(question.id);
        responses[key] = {
          id: key,
          question: question.question,
          type: question.type,
          required: question.required,
          answer: respondent.answers[key] ?? null,
        };
      });
    }
    return {
      user: { id: respondent.id, name: respondent.name, email: respondent.email, profile_image: null },
      responses,
      has_answered: respondent.answered,
    };
  });
  const answered = respondents.filter((respondent) => respondent.answered).length;
  return {
    total_buyers: respondents.length,
    total_responses: answered,
    missing_responses: respondents.length - answered,
    data,
  };
}

function statisticsOf(eventId: number) {
  const questions = currentQuestions(eventId);
  const respondents = respondentsByEvent.get(eventId) ?? [];
  const answered = respondents.filter((respondent) => respondent.answered);
  const questionStats: Record<string, FormQuestionStats> = {};
  questions.forEach((question) => {
    const key = String(question.id);
    const values = answered
      .map((respondent) => respondent.answers[key])
      .filter((value): value is string | string[] => value !== undefined);
    if (question.type === 'multiple_choice' || question.type === 'dropdown' || question.type === 'checkboxes') {
      const counts: Record<string, number> = {};
      (question.options ?? []).forEach((option) => {
        counts[option] = 0;
      });
      values.flat().forEach((value) => {
        counts[value] = (counts[value] ?? 0) + 1;
      });
      questionStats[key] = { type: question.type, question: question.question, answers: counts, totalAnswers: values.length };
    } else {
      questionStats[key] = { type: question.type, question: question.question, textAnswers: values, totalAnswers: values.length };
    }
  });
  return {
    totalParticipants: respondents.length,
    totalResponses: answered.length,
    completionRate: respondents.length > 0 ? Math.round((answered.length / respondents.length) * 100) : 0,
    questionStats,
  };
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/events/:id/questions-responses/', ({ params }) => {
    const event = findMockEvent(params.id);
    if (!event) return mockError(404, { detail: 'Not found.' });
    return responsesOf(event.id);
  }),
  mock('GET', '/api/v1/events/:id/questions-statistics/', ({ params }) => {
    const event = findMockEvent(params.id);
    if (!event) return mockError(404, { detail: 'Not found.' });
    return statisticsOf(event.id);
  }),
];
