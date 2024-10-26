import service from '../services/inference.js';

export const getInferenceV1 = async (req, res, next) => {
  try {
    const result = await service.inferenceV1();
    return res.status(200).json(result);
  }
  catch (err) {
    next(err);
  }
}

export default {
  getInferenceV1,
}
