# 介绍人选择器设计

## Context

PersonModal 中"介绍人"字段最初只读，后来改为单选下拉，最终实现为**多选复选框**。

## 设计迭代

### v1: 单选下拉 (已实现)
- 点击字段展开下拉 → 搜索 → 选择 → PATCH 保存
- 问题是只能选一个人

### v2: 多选复选框 ✅ (最终实现)
- 保持下拉交互，但改为复选框 UI
- 支持同时选择多介绍人、可清除
- 点击名字可导航到该人弹窗（← 返回按钮支持多层跳转）

## 最终设计

### 交互流程

1. **非编辑状态**：显示已选人姓名（用顿号分隔）+ ✎ 图标；无介绍人时显示"点击选择介绍人"（橙色斜体）
2. **点击 ✎**：展开下拉框（复选框列表 + 搜索框 + 清除全部选项）
3. **下拉列表**：显示所有人，按关系分从高到低排序；可输入过滤
4. **选择/取消**：点击复选框 → 乐观更新本地状态 → PATCH 保存
5. **清除全部**：下拉内"清除全部"按钮
6. **收起**：ESC / 点击别处 → 下拉收起
7. **导航**：点击已选人的姓名 → 跳转到该人弹窗，左上角出现「← 返回」按钮

### 后端

`src/app/api/members/[id]/route.ts`：
- `EDITABLE_FIELDS` 新增 `introducedById` 和 `introducedByIds`
- PATCH 验证：每个 ID 对应的人必须存在；禁止选自己

### 前端

`src/components/PersonModal.tsx`：
- `MultiIntroducerSelector` 组件（替代原 `PersonSelector`）
- Props: `values: string[]`, `allPersons`, `onNavigate`, `onChange`
- `allPersons` 由 Modal 预加载（`/api/members/table`），确保名字随时可解析

### 数据流

```
Modal open → preload allPersons →
User clicks ✎ → dropdown opens (loads persons list) →
User toggles checkbox → optimistic update local state →
PATCH /api/members/:id { field: "introducedByIds", value: [id1, id2] } →
User clicks name → handleNavigateToPerson(id) →
fetch /api/members/:id → display new person modal
```

## Verification

1. 打开 /members，点击任意一行
2. 滚动到介绍人字段：无介绍人显示"点击选择介绍人"；有介绍人显示多人姓名
3. 点击 ✎ → 下拉展开 → 勾选/取消 → 保存成功
4. 点击名字 → 跳转到该人弹窗，左上角有「← 返回」
5. 点击清除全部 → 介绍人清空
6. ESC / 点击别处 → 下拉收起
