export const getRateColor = (rate: number) => {
  // rate를 0~1 범위로 정규화
  const normalizedRate = (rate + 1) / 2;
  
  const red = Math.round(255 * (1 - normalizedRate));
  const green = Math.round(255 * normalizedRate);

  return {
    backgroundColor: `rgb(${red}, ${green}, 64)`,
    color: 'white',
  };
};
