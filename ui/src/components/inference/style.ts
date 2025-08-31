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

export const getWeightColor = (weight: number) => {
  if (weight > 0.7) return { backgroundColor: '#7E22CE', color: 'white' }; // purple-700
  if (weight > 0.4) return { backgroundColor: '#9333EA', color: 'white' }; // purple-600
  return { backgroundColor: '#A855F7', color: 'white' }; // purple-500
};

export const getConfidenceColor = (confidence: number) => {
  if (confidence > 0.7) return { backgroundColor: '#312E81', color: 'white' }; // indigo-900
  if (confidence > 0.4) return { backgroundColor: '#4338CA', color: 'white' }; // indigo-700
  return { backgroundColor: '#4F46E5', color: 'white' }; // indigo-600
};
