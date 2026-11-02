import type { FormQuestionPayload } from '@/store/api/formsApi';
import type { EventDetail, QuestionType } from '@/types/api';

export type ConditionAction = 'continue' | 'skip' | 'end' | 'show_message';

export interface FormCondition {
  optionIndex: number | null;
  action: ConditionAction;
  targetQuestionIndex: number | null;
  targetQuestionId: string | null;
  message: string;
}

export interface FormQuestion {
  id: string;
  question: string;
  description: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  conditions: FormCondition[];
  is_terminal: boolean;
}

export const QUESTION_TYPES: { value: QuestionType; label: string; color: string }[] = [
  { value: 'short_answer', label: 'Short Answer', color: '#4062d1' },
  { value: 'paragraph', label: 'Paragraph', color: '#7c3aed' },
  { value: 'email', label: 'Email', color: '#0ea5e9' },
  { value: 'phone_number', label: 'Phone Number', color: '#14b8a6' },
  { value: 'multiple_choice', label: 'Multiple Choice', color: '#16a34a' },
  { value: 'checkboxes', label: 'Checkboxes', color: '#d97706' },
  { value: 'dropdown', label: 'Dropdown', color: '#dc2626' },
];

export const CONDITION_ACTIONS: { value: ConditionAction; label: string }[] = [
  { value: 'continue', label: 'Continue to next question' },
  { value: 'skip', label: 'Skip to question' },
  { value: 'end', label: 'End form submission' },
  { value: 'show_message', label: 'Show message and continue' },
];

const CHOICE_TYPES: QuestionType[] = ['multiple_choice', 'checkboxes', 'dropdown'];

export const EMPTY_QUESTION: FormQuestion = {
  id: '',
  question: '',
  description: '',
  type: 'short_answer',
  options: [],
  required: false,
  conditions: [],
  is_terminal: false,
};

export function isChoiceType(type: QuestionType): boolean {
  return CHOICE_TYPES.includes(type);
}

export function questionTypeOf(type: string) {
  return QUESTION_TYPES.find((entry) => entry.value === type) ?? QUESTION_TYPES[0];
}

export function isQuestionLevel(condition: FormCondition): boolean {
  return condition.optionIndex == null;
}

export function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyCondition(optionIndex: number | null): FormCondition {
  return { optionIndex, action: 'continue', targetQuestionIndex: null, targetQuestionId: null, message: '' };
}

function readIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readAction(value: unknown): ConditionAction {
  return CONDITION_ACTIONS.find((entry) => entry.value === value)?.value ?? 'continue';
}

function parseConditions(raw: unknown): FormCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const targetId = 'targetQuestionId' in entry ? entry.targetQuestionId : null;
    return [
      {
        optionIndex: readIndex('optionIndex' in entry ? entry.optionIndex : null),
        action: readAction('action' in entry ? entry.action : null),
        targetQuestionIndex: readIndex('targetQuestionIndex' in entry ? entry.targetQuestionIndex : null),
        targetQuestionId: typeof targetId === 'number' || typeof targetId === 'string' ? String(targetId) : null,
        message: 'message' in entry && typeof entry.message === 'string' ? entry.message : '',
      },
    ];
  });
}

function terminalFromConditions(conditions: FormCondition[]): boolean {
  return conditions.some((condition) => isQuestionLevel(condition) && condition.action === 'end');
}

export function toFormQuestions(raw: EventDetail['questions_data']): FormQuestion[] {
  const questions: FormQuestion[] = (raw ?? []).map((question) => {
    const conditions = parseConditions('conditions' in question ? question.conditions : []);
    const terminal = 'is_terminal' in question && typeof question.is_terminal === 'boolean' ? question.is_terminal : null;
    return {
      id: String(question.id),
      question: question.question,
      description: 'description' in question && typeof question.description === 'string' ? question.description : '',
      type: question.type,
      options: Array.isArray(question.options) ? question.options : [],
      required: question.required === true,
      conditions,
      is_terminal: terminal ?? terminalFromConditions(conditions),
    };
  });
  return questions.map((question) => ({
    ...question,
    conditions: question.conditions.map((condition) => {
      const known = questions.some((candidate) => candidate.id === condition.targetQuestionId);
      if (!known && condition.targetQuestionIndex != null) {
        return { ...condition, targetQuestionId: questions[condition.targetQuestionIndex]?.id ?? null };
      }
      return condition;
    }),
  }));
}

export function finalizeQuestion(draft: FormQuestion): FormQuestion {
  const isChoice = isChoiceType(draft.type);
  const terminal = draft.is_terminal || draft.conditions.some((c) => isQuestionLevel(c) && c.action === 'end');
  let conditions = isChoice ? draft.conditions : draft.conditions.filter(isQuestionLevel);
  if (terminal) {
    conditions = conditions.filter((condition) => condition.action !== 'skip');
    if (!terminalFromConditions(conditions)) conditions = [...conditions, { ...emptyCondition(null), action: 'end' }];
  }
  return { ...draft, options: isChoice ? draft.options : [], conditions, is_terminal: terminal };
}

export function validateQuestion(draft: FormQuestion): { question?: string; options?: string } {
  const errors: { question?: string; options?: string } = {};
  if (!draft.question.trim()) errors.question = 'Question text is required';
  if (isChoiceType(draft.type) && draft.options.length < 2) errors.options = 'At least 2 options are required';
  return errors;
}

export function moveQuestion(questions: FormQuestion[], index: number, direction: -1 | 1): FormQuestion[] {
  const target = index + direction;
  if (target < 0 || target >= questions.length) return questions;
  const next = [...questions];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function deleteQuestion(questions: FormQuestion[], id: string): FormQuestion[] {
  return questions
    .filter((question) => question.id !== id)
    .map((question) => ({
      ...question,
      conditions: question.conditions.filter(
        (condition) => !(condition.action === 'skip' && condition.targetQuestionId === id),
      ),
    }));
}

export function duplicateQuestion(questions: FormQuestion[], index: number, copyLabel: string): FormQuestion[] {
  const source = questions[index];
  if (!source) return questions;
  return [...questions, { ...source, id: generateQuestionId(), question: `${source.question} (${copyLabel})` }];
}

export function upsertQuestion(questions: FormQuestion[], saved: FormQuestion, afterId: string | null): FormQuestion[] {
  if (questions.some((question) => question.id === saved.id)) {
    return questions.map((question) => (question.id === saved.id ? saved : question));
  }
  const afterIndex = afterId ? questions.findIndex((question) => question.id === afterId) : -1;
  if (afterIndex < 0) return [...questions, saved];
  return [...questions.slice(0, afterIndex + 1), saved, ...questions.slice(afterIndex + 1)];
}

export function connectQuestions(
  questions: FormQuestion[],
  sourceId: string,
  optionIndex: number | null,
  targetId: string,
): FormQuestion[] {
  const source = questions.find((question) => question.id === sourceId);
  const targetIndex = questions.findIndex((question) => question.id === targetId);
  if (!source || targetIndex < 0 || sourceId === targetId || source.is_terminal) return questions;
  const sameSlot = (condition: FormCondition) =>
    optionIndex != null ? condition.optionIndex === optionIndex : isQuestionLevel(condition);
  if (source.conditions.some((c) => sameSlot(c) && c.action === 'skip' && c.targetQuestionId === targetId)) {
    return questions;
  }
  const created: FormCondition = {
    optionIndex,
    action: 'skip',
    targetQuestionIndex: targetIndex,
    targetQuestionId: targetId,
    message: '',
  };
  const conditions = [...source.conditions.filter((condition) => !sameSlot(condition)), created];
  return questions.map((question) => (question.id === sourceId ? { ...question, conditions } : question));
}

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  optionIndex: number | null;
  kind: 'sequential' | 'condition';
  optionLabel: string | null;
  showNext: boolean;
}

export function buildCanvasEdges(questions: FormQuestion[]): CanvasEdge[] {
  const ids = new Set(questions.map((question) => question.id));
  const edges: CanvasEdge[] = [];
  questions.forEach((question, index) => {
    if (question.is_terminal) return;
    const isChoice = isChoiceType(question.type);
    question.conditions.forEach((condition, conditionIndex) => {
      if (condition.action !== 'skip' || !condition.targetQuestionId || !ids.has(condition.targetQuestionId)) return;
      const optionLevel = condition.optionIndex != null;
      edges.push({
        id: `cond_${question.id}_${conditionIndex}`,
        sourceId: question.id,
        targetId: condition.targetQuestionId,
        optionIndex: condition.optionIndex,
        kind: 'condition',
        optionLabel:
          optionLevel && isChoice && condition.optionIndex != null
            ? (question.options[condition.optionIndex] ?? `Option ${condition.optionIndex + 1}`)
            : null,
        showNext: false,
      });
    });
    const next = questions[index + 1];
    if (!next) return;
    const routes = (condition: FormCondition) => condition.action === 'skip' || condition.action === 'end';
    const hasDefaultRoute = question.conditions.some((c) => isQuestionLevel(c) && routes(c));
    const covered = new Set(
      question.conditions.filter((c) => !isQuestionLevel(c) && routes(c)).map((c) => c.optionIndex),
    );
    const allCovered = isChoice && question.options.length > 0 && question.options.every((_, i) => covered.has(i));
    if (hasDefaultRoute || allCovered) return;
    edges.push({
      id: `seq_${question.id}`,
      sourceId: question.id,
      targetId: next.id,
      optionIndex: null,
      kind: 'sequential',
      optionLabel: null,
      showNext: isChoice,
    });
  });
  return edges;
}

export function removeConditionEdge(questions: FormQuestion[], edge: CanvasEdge): FormQuestion[] {
  if (edge.kind !== 'condition') return questions;
  return questions.map((question) => {
    if (question.id !== edge.sourceId) return question;
    return {
      ...question,
      conditions: question.conditions.filter(
        (condition) =>
          !(
            condition.action === 'skip' &&
            condition.targetQuestionId === edge.targetId &&
            condition.optionIndex === edge.optionIndex
          ),
      ),
    };
  });
}

function apiId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

export function toQuestionsPayload(questions: FormQuestion[]): FormQuestionPayload[] {
  return questions.map((question) => ({
    question: question.question,
    type: question.type,
    options: question.options,
    required: question.required,
    id: question.id ? apiId(question.id) : undefined,
    conditions: question.conditions.map((condition) => {
      const targetIndex = condition.targetQuestionId
        ? questions.findIndex((candidate) => candidate.id === condition.targetQuestionId)
        : -1;
      return {
        ...condition,
        targetQuestionIndex: targetIndex >= 0 ? targetIndex : condition.targetQuestionIndex,
        targetQuestionId: condition.targetQuestionId ? apiId(condition.targetQuestionId) : null,
      };
    }),
    description: question.description,
  }));
}
