# Pi Live Compact STEP5 长任务测评（2026-11-14）

这是 **Pi Live Compact** 的独立测评报告，不是 DSH Live Compact 报告。固定 20 个 WebUniverse 长任务、同一 fixture、同一 `verifier.py`/`rubric.json`；本报告不发布测评图。

模型是 STEP Plan `step-5-preview`，Pi 适配器为 OpenAI Chat Completions，thinking=high。原版使用 Pi stock、无扩展；插件版使用 `exp/start-20k` 实验 worktree，基线提交 `1b0a669`，只把 `URGENT_TOKENS` 从 48,000 调到 20,000，保留 3 个工具轮和 650,000 停止门槛；该 worktree 未发布。

## 汇总

| 指标 | Pi 原版 stock | Pi + Live Compact 2 万起切 |
|---|---:|---:|
| 整题通过 | 13/20（65.0%） | 14/20（70.0%） |
| Rubric | 374/391（95.7%） | 359/391（91.8%） |
| Reward | 19.1102 | 18.4242 |
| 缓存读取 token | 1,292,849,152 | 1,213,869,312 |
| 未命中输入 token | 9,782,423 | 15,816,290 |
| 缓存命中率 | 99.25% | 98.71% |
| 总耗时 | 7,222 秒 | 7,306 秒 |
| 最大观测 totalTokens | 673,483 | 590,380 |
| 真实小切 | 0 | 44 |

## 指标定义

- **整题通过**：该题所有 verifier 检查点都通过。
- **Rubric**：所有题的通过检查点数 / 检查点总数；本次总数为 391。
- **Reward**：每题 verifier 的归一化 reward 之和，20 题满分为 20；它和全局 Rubric 不是同一分母。
- **缓存命中率**：`cacheReadTokens / (cacheReadTokens + inputTokens)`。
- **最大观测 totalTokens**：runner 记录到的累计 usage 峰值，不等同于供应商上下文上限。
- **真实小切**：产生非空 context replacement 的 context edit 数量；stock 没有扩展切割。

## 客观结论

插件版把最大观测水位从 `673,483` 降到 `590,380`，并产生 `44` 次真实小切；但 Rubric 少 `15` 个检查点，Reward 低 `0.6861`。这组数据支持“2 万起切能压低水位”，同时显示 STEP5 上存在准确率代价，不能单凭这次结果称为发布完成。

逐题数据和累计 usage 在同目录的 JSON 中；原始 progress 仍保存在本机 `/tmp/pi-bench/`，未将测评图或密钥写入仓库。
