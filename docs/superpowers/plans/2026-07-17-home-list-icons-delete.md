# 今日训练图标与删除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为今日训练提供器械图标与动作级左滑删除。

**Architecture:** 首页以动作查找器械图标；左滑确认后循环删除该聚类中的记录。

**Tech Stack:** Vue 3、Pinia、Vant、Node test。

## Global Constraints

- 无器械图标时显示默认符号。
- 删除动作当天全部组记录。

### Task 1: 首页图标与删除

**Files:** `src/views/Home.vue`, `tests/homeLayout.test.mjs`

- [ ] Add failing static test for `getGroupEquipmentIcon`, `van-swipe-cell`, and group delete handler.
- [ ] Implement action-to-equipment icon lookup, swipe cell wrapper, confirmation dialog, and deletion of all `group.records`.
- [ ] Run `node --test tests/homeLayout.test.mjs && npm run build`.
- [ ] Run `node --test tests/*.test.mjs && npm run build`.
