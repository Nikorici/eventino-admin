import { resolveMock } from './index';

function patchUser(id: number, body: unknown, token = 'mock-access-1001') {
  return resolveMock({ method: 'PATCH', path: `/api/v1/users/${id}/`, query: {}, body, token });
}

describe('PATCH /api/v1/users/:id/ mock', () => {
  it('merges every form field and turns true/false strings into booleans', async () => {
    const form = new FormData();
    form.append('company_pays_tva', 'false');
    form.append('send_mail_permission', 'true');
    form.append('meta_pixel_id', '1234567890');
    const outcome = await patchUser(1001, form);
    if ('error' in outcome) throw new Error(JSON.stringify(outcome.error));
    expect(outcome.data).toMatchObject({
      id: 1001,
      company_pays_tva: false,
      send_mail_permission: true,
      meta_pixel_id: '1234567890',
    });
    const reread = await resolveMock({ method: 'GET', path: '/api/v1/users/1001/', query: {}, body: undefined, token: 'mock-access-1001' });
    expect('data' in reread && reread.data).toMatchObject({ company_pays_tva: false, send_mail_permission: true });
  });

  it('merges JSON bodies and refuses another account', async () => {
    const outcome = await patchUser(1001, { company_pays_tva: true });
    expect('data' in outcome && outcome.data).toMatchObject({ company_pays_tva: true });
    const foreign = await patchUser(1002, { meta_pixel_id: '1' });
    expect('error' in foreign && foreign.error).toMatchObject({ status: 403, data: { detail: 'You can update only your own account.' } });
  });
});
