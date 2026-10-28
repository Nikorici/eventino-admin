import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { API_URL, AUTH_SCHEME, USE_MOCKS } from '@/lib/constants';
import { refreshAccessToken } from '@/store/api/baseApi';

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = (await response.clone().json()) as { error?: string; detail?: string; message?: string };
    return data.error ?? data.detail ?? data.message ?? null;
  } catch {
    return null;
  }
}

async function writeResponseToFile(response: Response, filename: string): Promise<string> {
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message ?? `HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
  return file.uri;
}

async function fetchWithAuthRetry(
  token: string,
  makeRequest: (authToken: string) => Promise<Response>,
): Promise<Response> {
  if (USE_MOCKS) return new Response('Eventino Admin demo export', { status: 200 });
  const response = await makeRequest(token);
  if (response.status !== 401) return response;
  const newToken = await refreshAccessToken();
  if (!newToken) return response;
  return makeRequest(newToken);
}

export async function downloadAuthedFile(path: string, token: string, filename: string): Promise<string> {
  const response = await fetchWithAuthRetry(token, (authToken) =>
    fetch(`${API_URL}${path}`, {
      headers: { Authorization: `${AUTH_SCHEME} ${authToken}` },
    }),
  );
  return writeResponseToFile(response, filename);
}

export async function downloadAuthedFilePost(
  path: string,
  token: string,
  body: unknown,
  filename: string,
): Promise<string> {
  const response = await fetchWithAuthRetry(token, (authToken) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `${AUTH_SCHEME} ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return writeResponseToFile(response, filename);
}

export interface ShareFileOptions {
  mimeType?: string;
  UTI?: string;
  dialogTitle?: string;
}

export async function shareFile(uri: string, options?: ShareFileOptions): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, options);
  return true;
}
