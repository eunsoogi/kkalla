import process from 'process';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import db from './src/models/index.js';
import apiRouter from './src/routes/api.js';

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', apiRouter);

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message;

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
};

app.use(errorHandler);

await db.initialize();

export default app;
