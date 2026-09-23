import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';

/**
 * Express 应用入口。
 * 中间件顺序：CORS → JSON 解析 → 路由 → 404 → 错误处理。
 */
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[resume-forge] API server listening on http://localhost:${config.port}`);
});

export default app;
