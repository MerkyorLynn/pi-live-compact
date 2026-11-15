# Pi Live Compact 0.1.4 · STEP5 发布后非阻断测评

这是 `v0.1.4` 发布后的独立观察项，不改变发布状态，也不作为回滚门禁。固定同一 20 个 WebUniverse 长任务、同一题序和 verifier；插件使用 `step-5-preview`、thinking `high`、1M context、20,000 起切。报告不包含 DSH 数据。

## 总表

| 指标 | Pi 原版 stock 参考 | Pi + Live Compact 0.1.4 | 插件 − stock |
| --- | ---: | ---: | ---: |
| 整题通过 | 13/20（65.00%） | 14/20（70.00%） | +1 |
| Rubric | 374/391（95.65%） | 373/391（95.40%） | -1 checks |
| Reward | 19.1102 | 19.1069 | -0.0034 |
| 缓存读取 token | 156,793,088 | 256,037,120 | +99,244,032 |
| 未命中 input token | 850,464 | 1,587,281 | +736,817 |
| 缓存命中率 | 99.46% | 99.38% | -0.08 pp |
| 峰值 totalTokens | 673,483 | 650,264 | -23,219（-3.45%） |
| 真实小切 | 0 | 98 | +98 |
| 总耗时 | 7,222 s | 8,922 s | +1700 s（+23.54%） |

插件把峰值压低 23,219 token（3.45%），并发生 98 次真实小切；整题通过多 1，但 Rubric 少 1、Reward 少 0.0034。耗时多 1,700 秒（23.54%），未命中 input token 多 736,817，缓存命中率低 0.08 个百分点。

## 逐题数据

| 题目 | stock | 插件 | stock 峰值 | 插件峰值 | 插件小切 |
| --- | ---: | ---: | ---: | ---: | ---: |
| webuniverse-11057 | 30/30 PASS | 30/30 PASS | 39,192 | 40,424 | 5 |
| webuniverse-00732 | 18/24 fail | 18/24 fail | 91,182 | 107,965 | 14 |
| webuniverse-03875 | 22/22 PASS | 22/22 PASS | 123,466 | 132,766 | 18 |
| webuniverse-09595 | 19/21 fail | 21/21 PASS | 168,389 | 154,641 | 21 |
| webuniverse-11860 | 21/21 PASS | 21/21 PASS | 222,794 | 239,559 | 36 |
| webuniverse-04806 | 21/21 PASS | 15/21 fail | 262,725 | 275,811 | 39 |
| webuniverse-12054 | 21/21 PASS | 21/21 PASS | 292,632 | 306,691 | 49 |
| webuniverse-13500 | 20/20 PASS | 20/20 PASS | 325,117 | 340,200 | 55 |
| webuniverse-00841 | 20/20 PASS | 20/20 PASS | 364,189 | 384,682 | 60 |
| webuniverse-12954 | 19/19 PASS | 19/19 PASS | 392,306 | 396,791 | 62 |
| webuniverse-11099 | 18/18 PASS | 17/18 fail | 431,509 | 429,902 | 70 |
| webuniverse-06559 | 18/18 PASS | 18/18 PASS | 455,432 | 443,186 | 72 |
| webuniverse-06972 | 17/18 fail | 17/18 fail | 476,342 | 456,319 | 73 |
| webuniverse-09805 | 18/18 PASS | 18/18 PASS | 506,581 | 487,924 | 81 |
| webuniverse-12059 | 17/17 PASS | 17/17 PASS | 533,052 | 515,999 | 85 |
| webuniverse-05683 | 17/17 PASS | 17/17 PASS | 552,204 | 531,512 | 86 |
| webuniverse-14033 | 16/17 fail | 16/17 fail | 579,150 | 555,469 | 89 |
| webuniverse-10340 | 15/17 fail | 17/17 PASS | 612,086 | 599,060 | 90 |
| webuniverse-08083 | 15/16 fail | 16/16 PASS | 646,536 | 649,421 | 95 |
| webuniverse-00219 | 12/16 fail | 13/16 fail | 673,483 | 650,264 | 98 |

JSON 还保存每题 Reward、耗时、cacheRead/input/output、gradeRc 和 clean 状态。两组本轮 20/20 行均为 clean verifier。

## 定义与结论

- **整题通过**：题目所有 verifier 检查点通过。
- **Rubric**：通过检查点数 / 总检查点数；本轮分母 391。
- **Reward**：20 题逐题归一化 reward 之和，满分 20。
- **缓存命中率**：`cacheReadTokens / (cacheReadTokens + inputTokens)`，按 raw session JSONL 的 assistant usage 汇总。
- **峰值 totalTokens**：raw session 中 `usage.totalTokens` 的最大值。
- **真实小切**：`context_edit.replacement !== null` 的数量。
- 这是发布后的 non-blocking 数据：STEP5 在这组固定题上显示了较低峰值和有效小切，但时间、未命中输入和 Rubric 需要单独权衡，不能用它替代 GLM 发布门禁。

## 原始证据

- 发布版插件 progress：`/private/tmp/pi-bench/pi-webuniverse20-step5-release-20261116/progress.jsonl`
- 发布版插件 raw session：`/private/tmp/pi-bench/pi-webuniverse20-step5-release-20261116/sessions/2026-11-15T19-14-16-413Z_01a1e0a1-b4dd-713b-b6bc-88b755524fdc.jsonl`
- stock progress：`/private/tmp/pi-bench/pi-webuniverse20-step5-stock-web20/progress.jsonl`
- stock raw session：`/private/tmp/pi-bench/pi-webuniverse20-step5-stock-web20/sessions/2026-11-14T04-42-51-777Z_01a1d85d-8c01-7318-bdd7-e5d068dc870e.jsonl`
- harness：`/tmp/pi-lc-host/run-pi-webuniverse20-fable.mjs`
