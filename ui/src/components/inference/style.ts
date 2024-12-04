export const getRateColor = (rate: number) => {
  const red = Math.round(255 * (1 - rate));
  const green = Math.round(255 * rate);

  return {
    backgroundColor: `rgb(${red}, ${green}, 64)`,
    color: 'white',
  };
};
