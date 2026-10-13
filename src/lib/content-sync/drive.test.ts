import { describe, expect, it } from 'vitest';
import { extractDriveFileId } from './drive';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-012';

describe('extractDriveFileId', () => {
  it.each([
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?export=download&id=${ID}`,
    ID,
  ])('reconoce %s', (value) => {
    expect(extractDriveFileId(value)).toBe(ID);
  });

  it('rechaza textos y dominios ajenos a Drive', () => {
    expect(extractDriveFileId('foto portada.jpg')).toBeNull();
    expect(extractDriveFileId(`https://example.com/file/d/${ID}`)).toBeNull();
    expect(extractDriveFileId('')).toBeNull();
  });
});
