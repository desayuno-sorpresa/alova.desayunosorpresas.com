// Autenticación de cuenta de servicio de Google (OAuth 2.0 JWT bearer) sin dependencias.
import { createSign } from 'node:crypto';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
}

/** Lee el JSON de la llave; solo se usan el correo y la llave privada. */
export function parseServiceAccount(json: string): ServiceAccount {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido.');
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    !('client_email' in data) ||
    !('private_key' in data) ||
    typeof data.client_email !== 'string' ||
    typeof data.private_key !== 'string'
  ) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene client_email y private_key.');
  }
  return { clientEmail: data.client_email, privateKey: data.private_key };
}

/** Aserción JWT firmada con RS256 (válida 1 hora). */
export function buildJwtAssertion(
  account: ServiceAccount,
  scopes: readonly string[],
  nowSeconds: number,
): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const claims = encode({
    iss: account.clientEmail,
    scope: scopes.join(' '),
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  });
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(account.privateKey, 'base64url');
  return `${header}.${claims}.${signature}`;
}

export async function getAccessToken(
  account: ServiceAccount,
  scopes: readonly string[],
): Promise<string> {
  const assertion = buildJwtAssertion(account, scopes, Math.floor(Date.now() / 1000));
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    typeof body !== 'object' ||
    body === null ||
    !('access_token' in body) ||
    typeof body.access_token !== 'string'
  ) {
    throw new Error(
      `Google rechazó la autenticación (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body.access_token;
}
