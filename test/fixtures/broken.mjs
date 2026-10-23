export const template = {
  id: 'broken',
  parts: [
    {
      id: 'bad',
      render: () => {
        throw new Error('boom');
      },
    },
  ],
};
