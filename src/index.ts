import cors from 'cors';
import express from 'express';

import { compileContractHandler } from './handlers/compile-contract';
import { compileExpressionHandler } from './handlers/compile-expression';
import { compileStorageHandler } from './handlers/compile-storage';
import { deployHandler } from './handlers/deploy';
import { dryRunHandler } from './handlers/dry-run';
import { evaluateValueHandler } from './handlers/evaluate-value';
import { runFunctionHandler } from './handlers/run-function';
import { shareHandler } from './handlers/share';
import { errorLoggerMiddleware, loggerMiddleware } from './logger';
require('./metrics');

const bodyParser = require('body-parser');
const prometheus = require('express-prometheus-middleware');

const app = express();
const APP_PORT = process.env.PORT;

const metrics = express();
const METRICS_PORT = 8081;

const corsOptions = {origin: '*'};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(loggerMiddleware);
app.use(
  prometheus({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    collectDefaultBuckets: true,
    requestDurationBuckets: [0.5, 0.6, 0.7, 1, 10, 20, 30, 60],
    metricsApp: metrics
  })
);


app.options('/api/share', cors(corsOptions));

app.post('/api/compile-contract', compileContractHandler);
app.post('/api/compile-expression', compileExpressionHandler);
app.post('/api/compile-storage', compileStorageHandler);
app.post('/api/dry-run', cors(corsOptions), dryRunHandler);
app.post('/api/share', cors(corsOptions), shareHandler);
app.post('/api/evaluate-value', evaluateValueHandler);
app.post('/api/run-function', runFunctionHandler);
app.post('/api/deploy', deployHandler);

app.use(errorLoggerMiddleware);

app.listen(APP_PORT, () => {
  console.log(`API listening on: ${APP_PORT}`);
});

metrics.listen(METRICS_PORT, () => {
  console.log(`Metrics listening on: ${METRICS_PORT}`);
});
