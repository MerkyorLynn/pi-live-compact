# Pi Live Compact GLM-5.3 Flash 长任务测评（2026-11-14）

这是 **Pi Live Compact** 的独立报告，不是 DSH Live Compact 报告。固定 20 个 WebUniverse 长任务、同一 fixture 和 verifier；本报告不发布测评图。

模型：`glm-5.3-flash`；provider：`pi-glm`；API：OpenAI Chat Completions；thinking：`enabled`。stock 是 Pi 原版无扩展；插件版是 `exp/start-20k` 实验 worktree，基线 `1b0a669`，未发布。

## Pi 结果

| 指标 | Pi 原版 stock | Pi + Live Compact 2 万起切 |
|---|---:|---:|
| 整题通过 | 6/20（30.0%） | 8/20（40.0%） |
| Rubric | 292/391（74.7%） | 332/391（84.9%） |
| Reward | 14.8096 | 16.9395 |
| must-pass 失败题 | 3 | 2 |
| 缓存命中率 | 98.39% | 95.50% |
| 总耗时 | 2,460 秒 | 2,152 秒 |
| 最大观测 totalTokens | 183,886 | 145,944 |
| 真实小切 | 0 | 24 |

## 指标定义

- **整题通过**：该题所有 verifier 检查点通过。
- **Rubric**：所有题通过检查点数 / 检查点总数。
- **Reward**：每题归一化 verifier reward 之和，20 题满分为 20。
- **must-pass 失败题**：verifier `clean=false` 的题，表示至少一个硬性检查未通过。
- **缓存命中率**：`cacheReadTokens / (cacheReadTokens + inputTokens)`。
- **最大观测 totalTokens**：runner 记录的累计 usage 峰值，不等同于供应商上下文上限。
- **真实小切**：context edit 的 replacement 非空。

逐题结果、累计 usage 和所有失败状态在同目录 JSON 中；原始 progress 保留在本机 `/tmp/pi-bench/`。
