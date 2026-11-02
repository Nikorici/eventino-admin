import {
  buildCanvasEdges,
  connectQuestions,
  deleteQuestion,
  EMPTY_QUESTION,
  finalizeQuestion,
  removeConditionEdge,
  toFormQuestions,
  toQuestionsPayload,
  type FormQuestion,
} from './formQuestions';

const choice: FormQuestion = { ...EMPTY_QUESTION, id: '1', question: 'Age?', type: 'multiple_choice', options: ['Yes', 'No'] };
const text: FormQuestion = { ...EMPTY_QUESTION, id: '2', question: 'Name?' };
const fresh: FormQuestion = { ...EMPTY_QUESTION, id: 'q_new', question: 'Notes?', type: 'paragraph' };

describe('form questions', () => {
  it('connects an option to a question and draws a labelled condition edge', () => {
    const connected = connectQuestions([choice, text, fresh], '1', 0, 'q_new');
    const edges = buildCanvasEdges(connected);
    expect(edges.find((edge) => edge.kind === 'condition')).toMatchObject({ sourceId: '1', targetId: 'q_new', optionLabel: 'Yes' });
    expect(edges.filter((edge) => edge.kind === 'sequential').map((edge) => edge.sourceId)).toEqual(['1', '2']);
    const removed = removeConditionEdge(connected, edges[0]);
    expect(removed[0].conditions).toEqual([]);
  });

  it('ignores self connections and connections from terminal questions', () => {
    expect(connectQuestions([choice, text], '1', 0, '1')).toEqual([choice, text]);
    const terminal = { ...text, is_terminal: true };
    expect(connectQuestions([terminal, choice], '2', null, '1')).toEqual([terminal, choice]);
  });

  it('marks a terminal question with a question-level end condition and drops skips', () => {
    const draft = { ...choice, is_terminal: true, conditions: [{ optionIndex: 0, action: 'skip' as const, targetQuestionIndex: 1, targetQuestionId: '2', message: '' }] };
    const saved = finalizeQuestion(draft);
    expect(saved.conditions).toEqual([{ optionIndex: null, action: 'end', targetQuestionIndex: null, targetQuestionId: null, message: '' }]);
    expect(buildCanvasEdges([saved, text])).toEqual([]);
  });

  it('cleans skip conditions pointing at a deleted question', () => {
    const connected = connectQuestions([choice, text, fresh], '1', 1, 'q_new');
    expect(deleteQuestion(connected, 'q_new')[0].conditions).toEqual([]);
  });

  it('sends numeric ids as numbers and recomputes target indexes', () => {
    const connected = connectQuestions([choice, text, fresh], '2', null, 'q_new');
    const payload = toQuestionsPayload([fresh, ...connected.slice(0, 2)]);
    expect(payload.map((question) => question.id)).toEqual(['q_new', 1, 2]);
    expect(payload[2].conditions[0]).toMatchObject({ targetQuestionId: 'q_new', targetQuestionIndex: 0 });
  });

  it('resolves a stale target id through the saved index', () => {
    const raw = [
      {
        id: 10,
        question: 'A',
        type: 'short_answer' as const,
        required: false,
        conditions: [{ optionIndex: null, action: 'skip', targetQuestionIndex: 1, targetQuestionId: 'q_gone' }],
      },
      { id: 11, question: 'B', type: 'short_answer' as const, required: false },
    ];
    const parsed = toFormQuestions(raw);
    expect(parsed[0].conditions[0].targetQuestionId).toBe('11');
  });
});
