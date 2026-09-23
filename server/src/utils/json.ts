/**
 * 从 LLM 输出中稳妥地提取 JSON 对象。
 * 模型即使被要求只输出 JSON，也常包裹 ```json 代码块或附带解释文字，
 * 这里依次：去代码块围栏 → 截取最外层花括号 → JSON.parse。
 */
export function extractJsonObject(raw: string): unknown {
  let text = raw.trim();

  // 去除 ```json ... ``` 或 ``` ... ``` 围栏
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 兜底：截取第一个 { 到最后一个 } 之间的内容
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(text) as unknown;
}
