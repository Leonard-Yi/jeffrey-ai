# Jeffrey.AI E2E 测试方案

**最后更新**: 2026-04-10
**测试环境**: 独立测试数据库 (`DATABASE_URL` 指向测试库)
**测试框架**: Playwright 1.59.1

---

## 测试策略

### 环境配置

```bash
# 测试前确保：
# 1. 数据库是独立的测试库（不是生产数据）
# 2. .env 中 DATABASE_URL 指向测试库
# 3. 运行 npm run build && npm start (生产模式，更稳定)
```

### 测试隔离原则

1. **每个测试用例独立** — 不依赖其他测试的状态
2. **测试前清理** — 使用 `__test__` 前缀标记数据，测试后清理
3. **页面对象模式** — 每个页面一个 Page Object 文件，便于维护

---

## 测试用例清单

### P0 — 核心流程（必须通过）

#### 1. 录入页完整流程 (`/input`)

| 用例 ID | 描述 | 步骤 |
|---------|------|------|
| INPUT-001 | 基础文本录入 | 输入文本 → 提交 → 验证结果卡片 |
| INPUT-002 | 追问回复流程 | pending 状态 → 选择快捷回复 → 验证完整 |
| INPUT-003 | 自定义追问回复 | pending 状态 → 输入回复 → 验证完整 |
| INPUT-004 | 语音输入UI | 点击麦克风 → 验证录音状态 |

#### 2. 人脉表格 (`/members`)

| 用例 ID | 描述 | 步骤 |
|---------|------|------|
| MEMBER-001 | 表格加载 | 访问页面 → 验证表格渲染 |
| MEMBER-002 | 排序功能 | 点击列头 → 验证排序结果 |
| MEMBER-003 | 筛选功能 | 选择职业/城市筛选 → 验证结果 |
| MEMBER-004 | 详情弹窗 | 点击行 → 验证弹窗打开 |
| MEMBER-005 | 弹窗编辑 | 修改字段 → 保存 → 验证更新 |

#### 3. 手动合并 (`/members`)

| 用例 ID | 描述 | 步骤 |
|---------|------|------|
| MERGE-001 | 多选记录 | 勾选 2+ 条 → 验证合并按钮出现 |
| MERGE-002 | 合并确认 | 点击合并 → 验证确认弹窗显示 |
| MERGE-003 | 执行合并 | 确认合并 → 验证记录消失 |
| MERGE-004 | 别名显示 | 合并后验证 survivor 有正确的 aliases |

#### 4. 姓名预检

| 用例 ID | 描述 | 步骤 |
|---------|------|------|
| RESOLVE-001 | 精确匹配 | 输入已有姓名 → 验证预检提示 |
| RESOLVE-002 | 确认替换 | 点击确认 → 验证姓名替换 |
| RESOLVE-003 | 跳过预检 | 点击跳过 → 验证直接提交 |

### P1 — 重要功能

#### 5. 图谱页 (`/graph`)

| 用例 ID | 描述 | 步骤 |
|---------|------|------|
| GRAPH-001 | 图谱渲染 | 访问页面 → 验证节点显示 |
| GRAPH-002 | 节点点击 | 点击节点 → 验证详情弹窗 |
| GRAPH-003 | 筛选功能 | 选择过滤条件 → 验证边过滤 |

#### 6. 建议页 (`/suggestions`)

| 用例 ID | 描述 | 步骤 |
|---------|------|------|
| SUGGEST-001 | 页面加载 | 访问页面 → 验证三个模块显示 |
| SUGGEST-002 | 关系提醒 | 验证长时间未联系的人显示 |
| SUGGEST-003 | 待办承诺 | 验证我欠的承诺显示 |
| SUGGEST-004 | 破冰助手 | 选择联系人 → 验证 LLM 生成开场白 |

---

## 页面对象结构

```
tests/
├── e2e/
│   ├── pages/
│   │   ├── InputPage.ts        # 录入页
│   │   ├── MembersPage.ts      # 人脉表格页
│   │   ├── GraphPage.ts        # 图谱页
│   │   ├── SuggestionsPage.ts  # 建议页
│   │   └── components/
│   │       ├── PersonModal.ts  # 人物详情弹窗
│   │       ├── MergeDialog.ts  # 合并确认弹窗
│   │       └── NameResolvePrompt.ts # 姓名预检弹窗
│   ├── specs/
│   │   ├── input.spec.ts
│   │   ├── members.spec.ts
│   │   ├── merge.spec.ts
│   │   ├── resolve.spec.ts
│   │   ├── graph.spec.ts
│   │   └── suggestions.spec.ts
│   ├── fixtures/
│   │   └── test-data.ts       # 测试数据
│   └── helpers/
│       ├── setup.ts            # 测试前准备
│       └── cleanup.ts          # 测试后清理
├── playwright.config.ts
└── tsconfig.json
```

---

## 运行方式

```bash
# 运行所有测试
npx playwright test

# 运行特定测试
npx playwright test tests/e2e/specs/input.spec.ts

# 有头模式（可见浏览器）
npx playwright test --headed

# 调试模式
npx playwright test --debug

# 只运行失败的测试
npx playwright test --grep @failed
```

---

## 验收标准

| 指标 | 目标 |
|------|------|
| P0 测试通过率 | 100% |
| P1 测试通过率 | > 90% |
| 测试执行时间 | < 5 分钟 |
| 测试稳定性 | 无 flaky 测试 |

---

## 调试经验总结

**最后更新**: 2026-04-20

本节记录 E2E 测试调试过程中积累的经验教训，供后续参考。

### 1. Next.js App Router 下的会话保持

**问题**: `page.goto('/members')` 导致 API 返回 500，但点击 Header 链接导航正常。

**原因**: Next.js App Router 中，点击 `<Link>` 组件进行客户端路由跳转时，session cookie 会保留。但 `page.goto()` 会发起新的 HTTP 请求，session cookie 可能未正确附加。

**解决方案**: 使用链接点击导航而非直接 `page.goto()`：

```typescript
async goto() {
  const membersLink = this.page.locator('a[href="/members"]').first();
  if (await membersLink.isVisible({ timeout: 1000 }).catch(() => false)) {
    await membersLink.click();
    await this.page.waitForURL('**/members**', { timeout: 10000 });
  } else {
    await this.page.goto(this.url);
  }
}
```

### 2. React 状态更新的条件等待

**问题**: 测试间歇性失败，有时能获取到正确的状态值，有时不能。

**原因**: Playwright 的固定 `waitForTimeout()` 无法可靠地等待 React 状态更新完成。React 状态更新是异步的，且渲染时机不确定。

**解决方案**: 使用 `waitForFunction` 进行条件等待：

```typescript
// 等待特定状态变化
await this.page.waitForFunction(
  (expectedValue) => {
    const current = getCurrentValue();
    return current !== expectedValue; // 状态已变更
  },
  initialValue,
  { timeout: 5000 }
);
```

### 3. Playwright 伪选择器与原生 DOM 查询

**问题**: 使用 `div[style*="position: fixed"]:has-text("合并")` 在 Playwright  locator 中有效，但在 `document.querySelector()` 中无效。

**原因**: `:has-text()` 是 Playwright 的 CSS 扩展，不是标准 CSS 选择器。`page.evaluate()` 执行的是原生 JavaScript，不支持 Playwright 伪选择器。

**解决方案**: 在 `page.evaluate()` 中使用原生 DOM API：

```typescript
// 错误 ❌
const dialog = document.querySelector('div:has-text("合并")');

// 正确 ✅
const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
let dialog = null;
for (const div of fixedDivs) {
  if (div.textContent?.includes('合并')) {
    dialog = div;
    break;
  }
}
```

### 4. 测试数据隔离

**问题**: 合并测试执行后，被合并的记录被软删除。后续测试因找不到足够的数据而 skip。

**原因**: 测试之间共享数据库状态，合并操作会影响后续测试的数据可用性。

**解决方案**:
- 每个测试序列前重置测试数据
- 使用唯一的测试用户
- 测试后清理或使用事务回滚

```typescript
beforeEach(async () => {
  await resetTestData(); // 删除并重建测试数据
});
```

### 5. Dialog 中元素顺序与 Selection 顺序

**问题**: 测试期望点击 index 1 切换 survivor，但调试发现 dialog 中元素顺序与 table selection 顺序可能不同。

**原因**: Dialog 中的元素顺序由 `allPersons.map()` 决定，可能按 ID 或其他字段排序，而非 selection 顺序。

**解决方案**: 始终通过调试确认元素的实际索引位置：

```typescript
// 调试时打印 dialog 中所有元素的顺序
const order = await page.evaluate(() => {
  const radios = document.querySelectorAll('input[type="radio"]');
  return Array.from(radios).map((r, i) => ({
    index: i,
    checked: r.checked,
    name: r.closest('div')?.textContent?.slice(0, 20)
  }));
});
```

### 6. CSS Selector 的脆弱性

**问题**: 使用内联 `style` 属性构建选择器（如 `div[style*="border-radius: 10px"]`）非常脆弱，样式微小变化会导致选择器失效。

**解决方案**:
- 优先使用语义化的选择器（`role`, `data-testid`）
- 使用 `page.evaluate()` 直接查询 DOM，通过 JavaScript 逻辑提取数据
- 为关键元素添加 `data-testid` 属性

### 7. Flaky 测试的识别

**特征**:
- 单独运行通过，组合运行失败
- 有时通过有时失败
- 错误信息显示 "timeout" 或 "strict mode violation"

**排查步骤**:
1. 单独运行失败的测试，确认是否是确定性问题
2. 检查测试之间的数据是否有残留
3. 添加详细的调试日志定位问题
4. 使用 `waitForFunction` 替代固定 timeout

### 8. Playwright locator vs ElementHandle

**经验**: Locator 是 Playwright 推荐的方式，支持链式调用和自动重试。ElementHandle 是低级别 API，容易出现 "stale element" 问题。

**优先使用**:
```typescript
// 推荐 ✅
await this.page.locator('button:has-text("提交")').click();

// 避免 ❌
const button = await this.page.$('button');
await button.click(); // 容易出现 stale element
```

### 9. 合并对话框单选按钮切换主条目

**问题**: MERGE-005 测试 flaky，期望 survivor 变更但 DOM 状态未更新。

**原因**: Dialog 中元素顺序与 table selection 顺序不一定一致。默认 survivor 是关系分最高的，但对话框中可能排在其他位置。点击 index 1 切换时，可能点到了原本就是 survivor 的那个。

**解决方案**: 使用 `waitForFunction` 等待 survivor 名称变更后再验证：

```typescript
await mergeDialog.page.waitForFunction(
  (initialName) => {
    const dialog = document.querySelector('div[style*="position: fixed"]');
    if (!dialog) return false;
    const checkedRadio = dialog.querySelector('input[type="radio"]:checked');
    if (!checkedRadio) return false;
    const card = checkedRadio.closest('div[style*="border-radius: 10px"]');
    if (!card) return false;
    const spans = card.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent?.trim() || '';
      if (/[\u4e00-\u9fa5]/.test(text) && text.length < 10 &&
          !text.includes('关系') && !text.includes('主条目') && !text.includes('合并')) {
        return text !== initialName;
      }
    }
    return false;
  },
  initialSurvivor,
  { timeout: 5000 }
);
```

**经验**: 始终验证"变更后状态"而非仅验证"点击了某个元素"。
