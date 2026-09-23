import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { ragService } from './services/rag.service.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';

/**
 * Express 应用入口。
 * 中间件顺序：CORS → JSON 解析 → 路由 → 404 → 错误处理。
 *
 * CORS 默认允许所有来源（部署到 Render 时 Vercel 域名直连）；
 * 生产环境可通过 CORS_ORIGIN 环境变量限定白名单（逗号分隔）。
 */
const app = express();

const corsOrigin = config.corsOrigin;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((s) => s.trim()) } : {}));
app.use(express.json({ limit: '2mb' }));

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[resume-forge] API server listening on port ${config.port}`);
});

/**
 * 启动时自动检测并灌库：
 * Render 免费层文件系统是 ephemeral，重启会丢失 Chroma 本地数据；
 * 这里检测集合是否为空，为空则自动从 data/knowledge 重建。
 * 首次启动会有 ~30s 延迟，之后访问正常。
 */
async function autoIngestIfNeeded(): Promise<void> {
  try {
    const status = await ragService.status();
    if (status.count === 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[resume-forge] 知识库为空（${status.storagePath}），开始自动灌库...`,
      );
      const result = await ragService.ingest();
      // eslint-disable-next-line no-console
      console.log(`[resume-forge] 灌库完成：${result.chunks} 个片段已落盘`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[resume-forge] 知识库已就绪：${status.count} 个片段`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[resume-forge] 启动自动灌库失败：', err);
  }
}

// 异步执行，不阻塞服务启动；灌库期间 LLM 接口会因知识库为空返回 KNOWLEDGE_EMPTY 错误
void autoIngestIfNeeded();

export default app;
