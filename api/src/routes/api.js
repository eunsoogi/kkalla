import express from 'express';
import controller from '../controllers/index.js';

const router = express.Router();

router.get('/v1/inference', controller.getInferenceV1);

export default router;
