# Pi Live Compact 0.1.4 · GLM-5.3 Flash 长任务测评

本报告是 Pi 专属 release-gate 证据，不包含 DSH 数据。固定同一 20 个 WebUniverse 长任务、同一 fixture/verifier、同一题序；插件运行在 `e42782a`，小切实验起点为 20,000 token，最近 3 个工具轮保持原文。

模型：`glm-5.3-flash`；provider：`pi-glm`；API：OpenAI Chat Completions；thinking：enabled。原始 session 和 verifier 文件保留在本机 JSON 中记录的 evidence root。

## 总表

| 指标 | Pi 原版 stock | Pi + Live Compact 0.1.4 | 插件 − 原版 |
| --- | ---: | ---: | ---: |
| 整题通过 | 6/20（30.00%） | 6/20（30.00%） | +0 |
| Rubric | 292/391（74.68%） | 358/391（91.56%） | +66 checks |
| Reward | 14.8096 | 18.2301 | +3.4205 |
| 缓存读取 token | 17,389,888 | 25,163,520 | +7,773,632 |
| 未命中 input token | 259,434 | 463,621 | +204,187 |
| 缓存命中率 | 98.53% | 98.19% | -0.34 pp |
| 峰值 totalTokens | 183,886 | 175,013 | -8873（-4.83%） |
| 真实小切 | 0 | 37 | +37 |
| 总耗时 | 2,460 s | 2,257 s | -203 s |

峰值下降 8,873 token（4.83%），并且发生了 37 次真实小切；整题通过数持平，Rubric 和 Reward 上升。缓存命中率下降 0.34 个百分点，插件的未命中 input token 多 204,187，说明上下文水位下降没有自动等价为 prefill 成本全面下降。

## 逐题数据

| 题目 | stock | 插件 | stock 峰值 | 插件峰值 | 插件小切 | stock gradeRc | 插件 gradeRc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| webuniverse-11057 | 30/30 PASS | 30/30 PASS | 17,520 | 15,873 | 0 | 0 | 0 |
| webuniverse-00732 | 19/24 fail | 18/24 fail | 33,542 | 26,755 | 6 | 0 | 0 |
| webuniverse-03875 | 22/22 PASS | 22/22 PASS | 42,994 | 34,884 | 7 | 0 | 0 |
| webuniverse-09595 | 18/21 fail | 18/21 fail | 57,624 | 44,610 | 9 | 0 | 0 |
| webuniverse-11860 | 19/21 fail | 20/21 fail | 77,404 | 62,206 | 19 | 0 | 0 |
| webuniverse-04806 | 21/21 PASS | 21/21 PASS | 86,674 | 74,339 | 20 | 0 | 0 |
| webuniverse-12054 | 5/21 fail | 20/21 fail | 97,693 | 83,090 | 21 | 1 | 0 |
| webuniverse-13500 | 5/20 fail | 19/20 fail | 107,554 | 90,614 | 22 | 1 | 0 |
| webuniverse-00841 | 5/20 fail | 19/20 fail | 119,494 | 101,601 | 24 | 1 | 0 |
| webuniverse-12954 | 19/19 PASS | 19/19 PASS | 125,877 | 107,329 | 25 | 0 | 0 |
| webuniverse-11099 | 18/18 PASS | 17/18 fail | 139,106 | 119,321 | 27 | 0 | 0 |
| webuniverse-06559 | 17/18 fail | 18/18 PASS | 147,647 | 128,383 | 28 | 0 | 0 |
| webuniverse-06972 | 17/18 fail | 17/18 fail | 152,851 | 133,360 | 29 | 0 | 0 |
| webuniverse-09805 | 1/18 fail | 16/18 fail | 161,782 | 141,283 | 32 | 0 | 0 |
| webuniverse-12059 | 16/17 fail | 17/17 PASS | 169,246 | 145,651 | 32 | 0 | 0 |
| webuniverse-05683 | 17/17 PASS | 15/17 fail | 174,515 | 152,048 | 33 | 0 | 0 |
| webuniverse-14033 | 15/17 fail | 14/17 fail | 183,886 | 158,337 | 35 | 0 | 0 |
| webuniverse-10340 | 0/17 fail | 11/17 fail | 32,444 | 165,156 | 36 | 0 | 0 |
| webuniverse-08083 | 15/16 fail | 14/16 fail | 44,042 | 169,036 | 37 | 0 | 0 |
| webuniverse-00219 | 13/16 fail | 13/16 fail | 44,538 | 175,013 | 37 | 0 | 0 |

每题 Reward、耗时、cacheRead/input/output 和完整 verifier 结果在 JSON 中逐项保存；本表只把 Rubric、任务通过、峰值、小切和 gradeRc 放在可扫描列。

## 口径与异常

- **整题通过**：该题所有 verifier 检查点通过。
- **Rubric**：通过检查点数 / 总检查点数；本轮总分母为 391。
- **Reward**：20 题逐题归一化 reward 之和，满分 20。
- **缓存命中率**：`cacheReadTokens / (cacheReadTokens + inputTokens)`，使用 raw session JSONL 的每一条 assistant usage 汇总，避免把累计快照逐题相加。
- **峰值 totalTokens**：raw session 中 `usage.totalTokens` 的最大值；它是观测水位，不是供应商窗口上限。
- **真实小切**：`context_edit.replacement !== null` 的数量；本轮候选真实发生 37 次，原版为 0。
- 最终候选 20 行均为 `promptStatus=ok、clean=true、gradeRc=0`。原版有 3 行 `gradeRc=1`（12054、13500、00841），保留原值并在 JSON 标记，没有把它们改算成 clean。
- 旧的 `exp/start-20k (dirty worktree)` 报告不作为本次发布证据：它的 source 不是主干候选，且累计 counter 曾被重复求和。

## 原始证据

- 候选 commit：`e42782a4e6345f2e0ba830025aa8e36ea4931d1c`
- 原版 progress：`/tmp/pi-bench/pi-webuniverse20-stock/progress.jsonl`
- 候选 progress：`/tmp/pi-bench/pi-webuniverse20-glm53-rc2-final-20261116/progress.jsonl`
- 原版 raw session：`/tmp/pi-bench/pi-webuniverse20-stock/sessions/2026-11-13T15-31-47-382Z_01a1d589-4c36-7292-9239-b44c94a788d1.jsonl`
- 候选 raw session：`/tmp/pi-bench/pi-webuniverse20-glm53-rc2-final-20261116/sessions/2026-11-15T18-27-07-326Z_01a1e076-89be-71d2-b97e-88689340a0f0.jsonl`
- harness：`/tmp/pi-lc-host/run-pi-webuniverse20-fable.mjs`

本报告只记录数据和定义，不把 STEP5 测试作为本次发版阻断项；STEP5 将按用户要求在发版后单独跑并单独报告。
