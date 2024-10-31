export const decrypt = (key: string) => {
  return Buffer.from(key, 'base64').toString('hex');
};
