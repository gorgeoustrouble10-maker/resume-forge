/**
 * 知识库灌库脚本（离线）：npm run ingest
 * 读取 data/knowledge 下全部 markdown → 切块 → 向量化 → 持久化到本地文件。
 * 幂等：每次运行会清空集合后重写。
 */
import { ragService } from '../services/rag.service.js';
import { config } from '../config/index.js';

async function main(): Promise<void> {
  console.log('[resume-forge] 开始灌库...');
  console.log(`  知识库目录: ${config.knowledgeBasePath}`);
  console.log(`  存储模式: ${config.chroma.mode}`);
  console.log(`  集合名: ${config.chroma.collectionName}`);

  const result = await ragService.ingest();

  console.log('');
  console.log('[resume-forge] 灌库完成:');
  console.log(`  文件数: ${result.files}`);
  console.log(`  总片段: ${result.chunks}`);
  for (const [category, count] of Object.entries(result.byCategory)) {
    console.log(`    ${category}: ${count} 片段`);
  }
  console.log('');
  console.log('✅ 知识库已就绪，可以启动服务并调用生成接口。');
}

main().catch((error) => {
  console.error('[resume-forge] 灌库失败:', error);
  process.exit(1);
});
