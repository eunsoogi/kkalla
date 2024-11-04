export const decrypt = (key: string) => {
  return Buffer.from(key, 'utf8').toString('hex');
};
