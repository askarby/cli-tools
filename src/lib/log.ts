export const log = (message: string): void => {
  console.log(message);
};

export const fail = (message: string, code = 1): never => {
  console.error(message);
  process.exit(code);
};
