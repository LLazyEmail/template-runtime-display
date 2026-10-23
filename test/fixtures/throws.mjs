export const template = {
  id: 'throws',
  parts: [
    {
      id: 'bad',
      render: () => {
        throw new Error('boom');
      },
    },
  ],
};
export const options = { onError: 'throw' };
