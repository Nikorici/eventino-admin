import { resolveMock, type MockCall } from './index';

function call(method: MockCall['method'], path: string, body: unknown = undefined, token = 'mock-access-1001'): MockCall {
  return { method, path, query: {}, body, token };
}

async function linkedEmails(token = 'mock-access-1001'): Promise<string[]> {
  const outcome = await resolveMock(call('GET', '/api/v1/linked-accounts/', undefined, token));
  if (!('data' in outcome) || !Array.isArray(outcome.data)) throw new Error('no linked accounts');
  return outcome.data.map((account: { email: string }) => account.email);
}

function statusOf(outcome: Awaited<ReturnType<typeof resolveMock>>): number | undefined {
  return 'error' in outcome && typeof outcome.error.status === 'number' ? outcome.error.status : undefined;
}

describe('linked organizer mocks', () => {
  it('links existing accounts like the backend, then unlinks one pair', async () => {
    expect(await linkedEmails()).toEqual(['office@jazzinchisinau.md', 'contact@clujlive.ro']);

    const link = (email: string, otp_code: string) =>
      resolveMock(call('POST', '/api/v1/linked-accounts/link-otp/', { email, otp_code, nickname: 'Agenție' }));
    expect(statusOf(await link('nobody@example.com', '123456'))).toBe(404);
    expect(statusOf(await link('maria.popescu@agentiaevent.ro', '000000'))).toBe(400);
    expect(statusOf(await link('andrei.ciobanu@sunsetevents.md', '123456'))).toBe(400);

    const linked = await link('maria.popescu@agentiaevent.ro', '123456');
    expect('data' in linked && linked.data).toMatchObject({ first_name: 'Maria', last_name: 'Popescu', nickname: 'Agenție' });
    expect(await linkedEmails()).toContain('maria.popescu@agentiaevent.ro');
    expect(await linkedEmails('mock-access-1002')).toContain('maria.popescu@agentiaevent.ro');

    const google = await resolveMock(call('POST', '/api/v1/linked-accounts/link-google/', { access_token: 'mock' }));
    expect('data' in google && google.data).toMatchObject({ email: 'victor.ceban@gmail.com' });

    await resolveMock(call('DELETE', '/api/v1/linked-accounts/1003/'));
    expect(await linkedEmails()).not.toContain('contact@clujlive.ro');
    expect(await linkedEmails('mock-access-1002')).toContain('contact@clujlive.ro');
  });
});
