import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildJwtAssertion, parseServiceAccount, TOKEN_URL } from './auth';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

describe('parseServiceAccount', () => {
  it('extrae correo y llave', () => {
    const json = JSON.stringify({
      client_email: 'bot@x.iam.gserviceaccount.com',
      private_key: pem,
    });
    expect(parseServiceAccount(json)).toEqual({
      clientEmail: 'bot@x.iam.gserviceaccount.com',
      privateKey: pem,
    });
  });

  it('rechaza JSON inválido o incompleto sin mostrar su contenido', () => {
    expect(() => parseServiceAccount('no-json')).toThrow('no es un JSON válido');
    expect(() => parseServiceAccount('{"client_email":"a"}')).toThrow('no contiene');
  });
});

describe('buildJwtAssertion', () => {
  it('firma con RS256 y declara los alcances', () => {
    const jwt = buildJwtAssertion(
      { clientEmail: 'bot@x.iam.gserviceaccount.com', privateKey: pem },
      ['scope-a', 'scope-b'],
      1_000,
    );
    const [header = '', claims = '', signature = ''] = jwt.split('.');
    const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(claims)).toEqual({
      iss: 'bot@x.iam.gserviceaccount.com',
      scope: 'scope-a scope-b',
      aud: TOKEN_URL,
      iat: 1_000,
      exp: 4_600,
    });
    const valid = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, signature, 'base64url');
    expect(valid).toBe(true);
  });
});
