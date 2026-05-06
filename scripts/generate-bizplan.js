const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, TableOfContents,
} = require("docx");
const fs = require("fs");

// ─── Design Constants ───
const PRIMARY = "1B3A5C";      // 深蓝
const ACCENT = "C8A96E";       // 金
const BG_LIGHT = "F5F3EF";     // 奶油
const BG_TABLE_HEADER = "1B3A5C";
const TEXT_DARK = "2D2A1E";
const TEXT_BODY = "333333";
const FONT = "KaiTi";
const FONT_SIZE_BODY = 22;     // 11pt (half-points)
const FONT_SIZE_SMALL = 20;    // 10pt
const FONT_SIZE_H1 = 40;       // 20pt
const FONT_SIZE_H2 = 32;       // 16pt
const FONT_SIZE_H3 = 26;       // 13pt
const FONT_SIZE_TITLE = 56;    // 28pt
const FONT_SIZE_SUBTITLE = 28; // 14pt
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1440;           // 1 inch
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9026

// ─── Helpers ───
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const tableBorders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    indent: opts.noIndent ? undefined : { firstLine: 440 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    ...opts.paragraphOpts,
    children: [new TextRun({ text, font: FONT, size: opts.size || FONT_SIZE_BODY, color: opts.color || TEXT_BODY, bold: opts.bold || false })],
  });
}

function heading(text, level, opts = {}) {
  const sizes = { 1: FONT_SIZE_H1, 2: FONT_SIZE_H2, 3: FONT_SIZE_H3 };
  const lvls = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
  return new Paragraph({
    heading: lvls[level],
    spacing: { before: level === 1 ? 480 : 300, after: 200, line: 360 },
    children: [new TextRun({ text, font: FONT, size: sizes[level], color: PRIMARY, bold: true })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80, line: 340 },
    children: [new TextRun({ text, font: FONT, size: FONT_SIZE_BODY, color: TEXT_BODY })],
  });
}

function numberedItem(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { after: 80, line: 340 },
    children: [new TextRun({ text, font: FONT, size: FONT_SIZE_BODY, color: TEXT_BODY })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
    children: [],
  });
}

function tableCell(text, opts = {}) {
  const isHeader = opts.header || false;
  return new TableCell({
    borders: tableBorders,
    width: { size: opts.width || 2000, type: WidthType.DXA },
    shading: isHeader ? { fill: BG_TABLE_HEADER, type: ShadingType.CLEAR } : (opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined),
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: "center",
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: { after: 0, line: 300 },
        children: [new TextRun({ text, font: FONT, size: opts.size || FONT_SIZE_SMALL, color: isHeader ? "FFFFFF" : TEXT_BODY, bold: isHeader || (opts.bold || false) })],
      }),
    ],
  });
}

function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => tableCell(h, { header: true, width: colWidths[i] })) }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((cell, ci) => tableCell(cell, { width: colWidths[ci], shading: ri % 2 === 1 ? "F7F6F3" : undefined })),
        })
      ),
    ],
  });
}

// ─── Cover Page ───
function coverPage() {
  return [
    emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80, line: 400 },
      children: [new TextRun({ text: "Jeffrey.AI", font: FONT, size: 72, color: PRIMARY, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60, line: 360 },
      children: [new TextRun({ text: "AI 驱动的第二大脑社交管理系统", font: FONT, size: 36, color: ACCENT, bold: false })],
    }),
    emptyLine(),
    divider(),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: 380 },
      children: [new TextRun({ text: "商 业 计 划 书", font: FONT, size: 48, color: PRIMARY, bold: true })],
    }),
    emptyLine(), emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: 340 },
      children: [new TextRun({ text: "2026年5月", font: FONT, size: FONT_SIZE_SUBTITLE, color: TEXT_BODY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: 340 },
      children: [new TextRun({ text: "版本 1.0 — 寻找技术合伙人", font: FONT, size: FONT_SIZE_SUBTITLE, color: TEXT_BODY })],
    }),
    emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: 340 },
      children: [new TextRun({ text: "机密文件 · 仅限内部传阅", font: FONT, size: FONT_SIZE_SMALL, color: "999999" })],
    }),
  ];
}

// ─── Build Document ───
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: FONT_SIZE_BODY, color: TEXT_BODY } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: FONT_SIZE_H1, bold: true, font: FONT, color: PRIMARY },
        paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: FONT_SIZE_H2, bold: true, font: FONT, color: PRIMARY },
        paragraph: { spacing: { before: 300, after: 180 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: FONT_SIZE_H3, bold: true, font: FONT, color: PRIMARY },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [
    // ─── Section 1: Cover Page ───
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: coverPage(),
    },

    // ─── Section 2: TOC + Content ───
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 0 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
              children: [new TextRun({ text: "Jeffrey.AI 商业计划书", font: FONT, size: FONT_SIZE_SMALL, color: "999999", italics: true })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0 },
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
              children: [
                new TextRun({ text: "第 ", font: FONT, size: FONT_SIZE_SMALL, color: "999999" }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: FONT_SIZE_SMALL, color: "999999" }),
                new TextRun({ text: " 页", font: FONT, size: FONT_SIZE_SMALL, color: "999999" }),
              ],
            }),
          ],
        }),
      },
      children: [
        // TOC
        heading("目录", 1),
        new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第一章 ═══════════════════
        heading("一、项目概述", 1),

        heading("1.1 我们是谁", 2),
        p("Jeffrey.AI 是一个 AI 驱动的关系智能管理系统——或者说，一个\"第二大脑\"式的社交助手。它从用户非结构化的中文社交记录中自动提取结构化的人际关系数据，构建可查询、可可视化的社交知识图谱，并提供切实可行的社交行动建议。"),
        p("项目的灵感来源于一个朴素的痛点：我们每天在各种场合与人交往——微信、咖啡厅、饭局、电话——但这些宝贵的社交信息散落在聊天记录、日程和记忆中，从未被系统性地整理和利用。Jeffrey.AI 的目标就是用 AI 技术解决这个问题，让每个职场人士都能拥有一个永不遗忘的社交助理。"),

        heading("1.2 核心价值主张", 2),
        p("一句话：把碎片化的社交记忆，变成可量化、可检索、可行动的人脉资产。"),
        p("与传统 CRM 不同，Jeffrey.AI 不是让你填表单的\"人脉数据库\"，而是你自然社交后的智能秘书——你说一段中文，它帮你理清谁是谁、你们聊了什么、下次见面该说什么。"),

        heading("1.3 要解决的问题", 2),
        makeTable(
          ["痛点", "现状", "Jeffrey 的方案"],
          [
            ["社交数据碎片化", "记录散落在微信、日程、笔记中", "统一入口，AI 自动结构化提取"],
            ["人脉管理低效", "难以追踪关系变化、共同点、承诺", "知识图谱可视化 + 社交债务追踪"],
            ["信息检索困难", "无法回答\"我认识哪些做投行的人\"", "语义搜索 + 标签聚类 + 向量匹配"],
            ["关系维护被动", "想起来才联系，缺乏系统提醒", "AI 主动建议：该联系谁、聊什么话题"],
            ["同一人重复记录", "用不同称呼指代同一人", "向量相似度自动预检 + 手动合并"],
          ],
          [2500, 3263, 3263]
        ),

        emptyLine(),
        heading("1.4 产品定位", 2),
        bullet("中文优先 — 系统提示词、测试数据、标签均为中文，而非英文产品的中文翻译版"),
        bullet("LLM 驱动 — 利用大语言模型理解非结构化中文文本，而非基于规则的关键词匹配"),
        bullet("互动为核心 — 以\"Interaction\"（社交事件）为基本记录单元，而非以\"联系人\"为中心"),
        bullet("量化关系 — 0-100 分关系强度评分 + 加权标签权重，让关系可度量"),
        bullet("人格化 AI — \"Jeffrey\"黑色幽默管家风格，有态度、有温度的交互体验"),
        bullet("多元视图 — 知识图谱（直观）+ 表格（高效）双模式，互补而非替代"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第二章 ═══════════════════
        heading("二、市场分析", 1),

        heading("2.1 市场规模与增长趋势", 2),
        p("全球个人 CRM 市场在 2025 年已达到约 148 亿美元的规模，预计到 2035 年将增长至 460 亿美元，年复合增长率（CAGR）约为 12%。其中，AI 与自动化是这个市场最核心的增长引擎。"),
        p("在更广泛的 AI 关系智能市场，2025 年整体规模约为 184 亿美元，预计到 2030 年将突破 700 亿美元，年复合增长率超过 31%。这个市场的爆发式增长主要受大语言模型技术成熟、心理健康需求激增以及个性化数字体验需求增长三大因素驱动。"),
        p("中国 CRM 市场在 2025 年已达到约 500 亿元人民币的规模，其中国产替代（信创）政策持续推动本土 SaaS 产品发展。但值得注意的是，中国市场目前以企业级 CRM 为主（纷享销客、销售易等），针对个人用户的关系智能管理几乎是一片空白——这正是 Jeffrey.AI 的机会窗口。"),

        heading("2.2 目标用户画像", 2),
        p("Jeffrey.AI 面向的是具有高社交频率、高关系价值的职场专业人士，主要包括："),
        bullet("投资人与 VC — 需要管理大量创始人、LP、同行的人脉关系网络"),
        bullet("企业高管与创业者 — 高频社交，需要追踪承诺和后续行动"),
        bullet("销售与商务人士 — 维护客户关系，了解关键决策者的动态"),
        bullet("律师与咨询顾问 — 需要精确记录客户沟通细节和待办事项"),
        bullet("自由职业者 — 独立管理客户和合作伙伴网络"),
        p("这些用户的共同特征：社交活动频繁、人脉价值高、对\"关系维护\"有明确需求、愿意为效率工具付费。"),

        heading("2.3 竞品格局", 2),
        p("目前个人 CRM 市场主要有以下几类产品："),
        makeTable(
          ["类别", "代表产品", "月费", "核心功能", "与 Jeffrey 的差异"],
          [
            ["关系智能", "Dex / Mesh(原Clay)", "$10-12", "自动联系人充实 + 关系提醒", "仅英文，无中文社交理解"],
            ["开源自托管", "Monica", "免费/$9", "隐私优先，自建数据库", "无 AI 提取，需手动录入"],
            ["移动优先", "Covve", "$10", "手机通讯录扫描 + 职位变动提醒", "无知识图谱，无中文支持"],
            ["团队协作", "Folk / Regards", "$18-25", "小型团队共享联系人", "无 LLM 提取，需手动维护"],
            ["DIY 方案", "Notion / Airtable", "免费/$20", "高度自定义", "无 AI，需自行搭建和维护"],
          ],
          [1400, 1680, 1000, 2400, 2546]
        ),
        emptyLine(),
        p("这些产品的共同特点：都面向英文用户，都依赖手动录入或通讯录同步，没有一款能理解中文社交语境。中文\"人脉管理\"领域存在明显的供给侧空白。"),
        p("在国内，脉脉、钉钉、企业微信等产品侧重于招聘或企业内部协作，而非个人社交关系管理。\"AI + 中文人脉\"的交叉地带，目前没有强有力的竞争者。"),

        heading("2.4 竞争壁垒", 2),
        bullet("中文 NLP 深度 — 系统级的中文社交理解（日期解析、称呼识别、语境推断），非英文产品的简单翻译可比"),
        bullet("LLM 提取管道 — 自研的 Tool Calling + Zod Schema 双重约束管道，确保结构化输出的可靠性"),
        bullet("知识图谱引擎 — 7 种关系边类型 + 加权标签权重 + 语义搜索，构成差异化的数据护城河"),
        bullet("数据网络效应 — 用户越多，同一人识别越准确，社交图谱越完整"),
        bullet("Jeffrey 人格 — 黑色幽默 + 中式社交智慧的 AI 人格，形成情感粘性"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第三章 ═══════════════════
        heading("三、产品与解决方案", 1),

        heading("3.1 产品架构", 2),
        p("Jeffrey.AI 由四大核心模块组成，覆盖人脉管理的完整生命周期："),

        heading("模块一：智能录入", 3),
        p("用户只需用中文自然描述一次社交互动——比如\"今天下午和老王在国贸的星巴克喝咖啡，聊了他新做的 AI 项目，他说下周介绍他合伙人给我认识\"——系统自动完成以下工作："),
        bullet("LLM 提取：识别参与者（老王）、地点（国贸星巴克）、场景（咖啡）、情感氛围（轻松/正式）、核心记忆点和待办承诺"),
        bullet("标签生成：自动为\"老王\"添加/更新职业标签（AI 创业）和兴趣标签"),
        bullet("同一人检测：提交前通过向量相似度匹配，自动识别\"老王\"是否与已有\"王总\"是同一人"),
        bullet("追问闭环：如果信息不完整（缺少时间、场景等），Jeffrey 会以管家口吻追问，而非静默失败"),
        p("技术亮点：传统 CRM 需要用户填写 10+ 个字段来记录一次会面。Jeffrey.AI 只需一段自然语言，其余由 AI 完成。"),

        heading("模块二：知识图谱", 3),
        p("所有录入的社交数据自动构建为可交互的关系网络图。图中的每个节点是一个人，每条边代表一种关系连接："),
        bullet("互动关系 — 共同参与过社交事件的人之间自动建立连接"),
        bullet("介绍人关系 — 谁把谁介绍给了谁"),
        bullet("共同职业 — 相同或相近行业的人自动聚类"),
        bullet("共同兴趣 — 发现潜在的话题交集"),
        bullet("同城 — 地理维度的人脉发现"),
        bullet("共同地点 — 常去同一场所的人"),
        bullet("性格相似 — 基于 vibe 标签的性格匹配"),
        p("用户可按连接类型、群组、强度进行多维筛选，点击任意节点查看该人的完整档案和互动历史。"),

        heading("模块三：智能建议", 3),
        p("Jeffrey 不仅是记录工具，更是主动的关系维护助手。三大建议模块："),
        bullet("关系维护提醒 — 自动检测超过 30 天未联系的人，按重要性排序，提醒用户\"该联系老王了\""),
        bullet("社交债务追踪 — 自动追踪互动中产生的承诺（\"我答应帮他介绍一个人\"），按归属分类（我欠/对方欠/互欠）"),
        bullet("破冰助手 — 用户选中某人后，LLM 基于双方的互动历史和共同点生成个性化开场白和话题建议"),

        heading("模块四：人脉搜索与合并", 3),
        bullet("语义搜索 — 支持自然语言查询（\"我认识哪些做 AI 创业的人？\"），结合向量相似度与标签匹配"),
        bullet("动态表格 — 所有联系人以结构化表格展示，支持排序、筛选、左右滑动查看全字段"),
        bullet("同人合并 — 自动检测潜在重复条目 + 手动多选合并，合并后保留完整历史、别名和标签"),

        heading("3.2 用户旅程", 2),
        p("一个典型用户的使用流程："),
        numberedItem("打开 Jeffrey.AI，在录入页面用中文描述一次社交互动（30 秒）"),
        numberedItem("AI 自动提取结构化数据并存储（2-3 秒）"),
        numberedItem("在图谱页面查看自己的人脉网络全景"),
        numberedItem("在建议页面收到关系维护提醒和破冰建议"),
        numberedItem("下次见面前，搜索该人的完整互动历史和 AI 生成的话题建议"),
        p("这套流程将传统 CRM 中\"手动记录—整理—查找\"的被动模式，转变为\"自然输入—自动整理—主动建议\"的智能模式。"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第四章 ═══════════════════
        heading("四、技术架构", 1),
        p("这一章节专门写给未来的技术合伙人——这是我们已有的技术资产，也是你来之后需要进一步打造的技术壁垒。"),

        heading("4.1 技术栈全景", 2),
        makeTable(
          ["层次", "技术选型", "说明"],
          [
            ["前端框架", "Next.js 16 + React 19", "App Router，Server/Client Component 分离"],
            ["语言", "TypeScript 5.4+", "全栈类型安全"],
            ["样式", "Tailwind CSS 3.4", "设计令牌系统（无裸色值），统一的视觉语言"],
            ["数据库", "PostgreSQL 15 + Prisma 7.6 ORM", "JSONB 标签 + text[] 数组 + pgvector 扩展"],
            ["LLM 服务", "MiniMax M2.7（主）/ Qwen3.5（备）", "Anthropic 兼容 API + Tool Calling 强制结构化输出"],
            ["向量搜索", "MiniMax embe-01 Embedding", "语义相似度匹配 + 同人识别"],
            ["图谱可视化", "d3-force（自建 Canvas 引擎）", "替换 react-force-graph-2d，更精细的力导向控制"],
            ["认证", "NextAuth.js v5 + JWT", "邮箱密码 + SMTP 验证邮件"],
            ["部署", "Vercel + Supabase", "稳定运行中（https://jeffrey-ai.vercel.app）"],
            ["测试", "Playwright E2E + Jest", "端到端测试覆盖核心流程"],
          ],
          [1600, 3000, 4426]
        ),

        heading("4.2 系统架构", 2),
        p("系统采用经典的三层架构，但每一层都针对 AI 原生场景做了专门设计："),
        p("提取层（Extraction Layer）：LLM + Tool Calling + Zod 双重校验。系统提示词将 Zod Schema 转换为 JSON Schema 传给 LLM 作为工具定义，LLM 调用 save_extraction 工具返回结构化数据，后端通过 nullToUndefined 归一化 + safeParse 二次验证确保数据质量。完备性双重检查（LLM 判断 + 确定性规则）保证不完整数据不会脏写入库。"),
        p("持久化层（Persistence Layer）：Prisma ORM + PostgreSQL。核心创新在于标签权重合并算法——new_weight = prev_weight × 0.7 + incoming_weight × 0.3，确保历史积累有惯性，单次观察不颠覆用户画像。PersonTag 平铺索引表解决了 JSONB 不适合聚类查询的性能问题。"),
        p("服务层（Service Layer）：知识图谱服务将关系数据库数据实时转换为图结构（7 种边类型 + 去重 + 多维过滤），向量搜索服务支持自然语言查询人脉。所有 API 路由均实现 Zod 输入校验 + 通用错误响应（不暴露内部细节）。"),

        heading("4.3 核心数据模型", 2),
        p("Person（人脉节点）— 姓名、加权职业标签、加权兴趣标签、性格标签、所在城市、常去地点、关系评分（0-100）、最后联系日期、介绍人关系、别名列表、搜索文本、嵌入向量"),
        p("Interaction（社交事件）— 日期、地点、场景类型、情感氛围、待办事项列表（含归属人和完成状态）、核心记忆点"),
        p("InteractionPerson（多对多连接）— 人物与互动之间的关联表"),
        p("PersonTag（扁平索引）— 按类别（职业/兴趣/性格）和名称的独立索引行，支持快速聚类查询"),
        p("User（多用户隔离）— 每个用户拥有独立的社交图谱，所有数据通过 userId 外键隔离"),

        heading("4.4 已有技术资产", 2),
        p("这可能是最吸引技术合伙人的部分——我们不是一个\"想法\"，而是已经完整实现、部署上线、可演示的产品。当前代码库包含："),
        bullet("22 个 API 路由 — 覆盖分析、图谱、搜索、建议、合并、认证等全部核心功能"),
        bullet("完整认证系统 — 注册、登录、邮箱验证（SMTP）、密码重置、会话管理"),
        bullet("LLM 提取管道 — MiniMax Anthropic 兼容端点 + Tool Calling + 日期正则预处理 + null 归一化"),
        bullet("知识图谱引擎 — d3-force Canvas 自绘 + 7 种连接类型 + 去重 + 多维过滤"),
        bullet("前端页面矩阵 — 录入页、图谱页、人脉表格页、建议页，全部通过 Playwright E2E 测试"),
        bullet("同人识别系统 — 向量嵌入匹配 + 手动多选合并 + 软删除 + 标签迁移"),
        bullet("设计令牌系统 — 60+ 设计令牌变量，组件引用令牌而非裸色值"),
        bullet("代码库整洁度 — 共享 Prisma 单例、统一工具函数、TypeScript 类型安全、无遗留调试代码"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第五章 ═══════════════════
        heading("五、商业模式", 1),

        heading("5.1 收入模型", 2),
        p("Jeffrey.AI 采用 Freemium + 订阅制模型，兼顾用户增长与收入转化："),

        makeTable(
          ["层级", "月费", "核心权益", "目标用户"],
          [
            ["免费版", "免费", "最多 50 个联系人、基础录入与分析、图谱查看", "轻度用户 / 试用"],
            ["专业版", "¥29/月", "无限联系人、完整 AI 建议、语义搜索、数据导出", "职场专业人士"],
            ["团队版", "¥79/人/月", "团队共享人脉、协作文档、权限管理", "VC/咨询/律所团队"],
            ["企业版", "定制报价", "私有部署、SSO、API 接入、专属模型微调", "大型企业"],
          ],
          [1400, 1600, 3200, 2826]
        ),

        heading("5.2 定价对标", 2),
        p("国际竞品的定价为我们提供了参考锚点：Dex 和 Mesh（原 Clay）定价在 $10-12/月，Folk 在 $17.50-25/月。Jeffrey.AI 的专业版定价 ¥29/月（约 $4/月）显著低于国际竞品，一方面是中文市场的支付意愿差异，另一方面也为未来提价留有充足空间。"),
        p("中国 SaaS 市场数据显示，个人用户的月均 SaaS 支出意愿在 ¥15-50 区间，专业版 ¥29 正好处于这个\"甜点区\"。团队版 ¥79/人/月对标飞书/钉钉专业版，具有心理锚定效应。"),

        heading("5.3 增长路径", 2),
        p("阶段一：种子用户（0-6 个月）"),
        bullet("通过 Product Hunt、少数派、V2EX 等社区获取早期用户"),
        bullet("邀请投资圈、创业圈的意见领袖作为种子用户"),
        bullet("免费版作为获客入口，通过产品力转化付费"),
        emptyLine(),
        p("阶段二：口碑增长（6-18 个月）"),
        bullet("产品内建分享机制（\"看看你和谁有哪些共同联系人\"）"),
        bullet("内容营销：AI + 人脉管理案例分享，建立品类心智"),
        bullet("与 WeChat/飞书/钉钉的集成，降低数据导入门槛"),
        emptyLine(),
        p("阶段三：平台化（18-36 个月）"),
        bullet("开放 API，允许第三方构建基于社交图谱的应用"),
        bullet("企业版推动 B2B 销售（VC 投后管理、律所客户关系、咨询公司专家网络）"),
        bullet("数据网络效应形成后，单位获客成本持续下降"),

        heading("5.4 财务测算要点", 2),
        p("基于 SaaS 行业的基准数据，我们做出以下保守假设："),
        bullet("免费到付费转化率：3%（行业平均 2-5%）"),
        bullet("月均用户增长率：首年 15%，次年 10%"),
        bullet("月度用户流失率：3%（行业平均 3-5%，AI 粘性预期可降低流失）"),
        bullet("客户获取成本（CAC）：¥15（主要通过内容和社区，非付费广告）"),
        bullet("客户生命周期价值（LTV）：¥29 × (1/0.03) = ¥967"),
        bullet("LTV/CAC 比率：967/15 = 64:1（远超 3:1 的健康基线）"),
        p("AI API 调用成本是主要可变成本。MiniMax M2.7 的 Token 定价约为 ¥0.5/百万 Token，单次分析约消耗 2000 Token，成本约 ¥0.001。即使每个用户每天录入 3 次，月成本仅 ¥0.09。"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第六章 ═══════════════════
        heading("六、项目现状与路线图", 1),

        heading("6.1 当前进度", 2),
        p("截至 2026 年 5 月，所有核心功能已完成开发、测试和部署。产品处于功能完整的 MVP 阶段，正在积累早期用户反馈。"),

        makeTable(
          ["功能模块", "状态", "关键能力"],
          [
            ["数据库 Schema", "已完成", "6 个模型（含 User 认证），完整索引，JSONB + text[] 支持"],
            ["LLM 提取管道", "已完成", "MiniMax M2.7 + Tool Calling + Zod 校验 + 日期预处理"],
            ["用户认证系统", "已完成", "注册/登录/邮箱验证/密码重置/多用户数据隔离"],
            ["录入页面", "已完成", "文本/语音输入 + 追问闭环 + Jeffrey 人格交互"],
            ["知识图谱", "已完成", "d3-force Canvas 引擎 + 7 种连接 + 多维过滤 + 节点详情"],
            ["人脉表格", "已完成", "动态列 + 排序/筛选 + 左右滑动 + 行点击弹窗"],
            ["智能建议", "已完成", "关系维护提醒 + 社交债务追踪 + LLM 破冰助手"],
            ["语义搜索", "已完成", "向量嵌入匹配 + 混合搜索（嵌入 + 标签）"],
            ["同人识别与合并", "已完成", "自动向量预检 + 手动多选合并 + 软删除"],
            ["Vercel 部署", "已完成", "https://jeffrey-ai.vercel.app + Supabase Postgres"],
            ["E2E 测试", "已完成", "Playwright 核心流程测试（录入/图谱/合并）"],
          ],
          [1800, 1400, 5826]
        ),

        heading("6.2 发展路线图", 2),

        heading("近期（1-3 个月）：打磨与验证", 3),
        bullet("收集早期用户反馈，优化交互体验"),
        bullet("提升 LLM 提取准确率（优化 Prompt、增加 few-shot 示例、针对边缘场景微调）"),
        bullet("移动端适配（PWA 或 React Native）"),
        bullet("与微信/企业微信的集成（聊天记录导入）"),
        bullet("SEO 与内容营销启动"),

        heading("中期（3-12 个月）：增长与商业化", 3),
        bullet("付费订阅系统上线（Stripe/支付宝/微信支付）"),
        bullet("团队版功能开发（共享人脉、协作编辑）"),
        bullet("API 开放平台（允许第三方集成）"),
        bullet("数据仪表盘（社交网络健康度分析、关系维护覆盖率）"),
        bullet("多语言支持（英文版，进入国际市场）"),

        heading("长期（12-36 个月）：平台化与生态", 3),
        bullet("AI Agent 自动维护关系（自动发送生日祝福、节日问候、定期 check-in）"),
        bullet("行业垂直解决方案（VC 投后管理、律所客户关系、猎头人才网络）"),
        bullet("社交图谱数据分析增值服务（人脉价值评估、影响力分析）"),
        bullet("成为中文职场人士的关系管理基础设施"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第七章 ═══════════════════
        heading("七、团队与合作", 1),

        heading("7.1 当前状态", 2),
        p("项目目前由创始人独立开发和运营，从 2026 年 3 月启动至今，在约 60 天内完成了从零到完整 MVP 的构建和部署。技术栈覆盖前端、后端、数据库、LLM 集成、DevOps 全链路。"),
        p("创始人背景：具备全栈开发能力、产品设计和 AI 工程化经验。项目的架构设计和代码质量可以说明这一点——22 个 API 路由全部通过安全审计，代码库整洁有序，设计令牌系统保证了视觉一致性。"),

        heading("7.2 寻找什么样的技术合伙人", 2),
        p("我们需要一位能独当一面的全栈工程师 / 未来 CTO，具体来说："),

        bullet("技术能力 — 精通 React/Next.js 和 Node.js/TypeScript 生态，有 PostgreSQL 和数据建模经验。如果你还熟悉 LLM 应用开发（Prompt Engineering、Tool Calling、向量搜索），那是巨大的加分项"),
        bullet("产品意识 — 不只是\"实现需求\"，而是能理解用户场景、质疑产品决策、提出更好的方案。我们希望你是产品的共同 Owner，而非被动执行者"),
        bullet("创业心态 — 愿意在早期阶段投入时间和精力，认同\"先做对的事，再想赚钱\"的理念。我们寻找的是合伙人，不是雇员"),
        bullet("加分项 — 有 AI/ML 背景，有 SaaS 产品经验，有移动端开发能力，对中文 NLP 有兴趣"),

        heading("7.3 合作方式", 2),
        p("我们提供灵活的合作方案，根据技术合伙人的投入程度和风险偏好选择："),
        bullet("方案 A（全职合伙人）— 联合创始人身份 + 显著股权比例（具体面议）。适合愿意全职投入、共担风险的伙伴"),
        bullet("方案 B（兼职合伙人）— 固定时间投入（每周 15-20 小时）+ 股权 + 未来全职转化机制。适合目前有全职工作但想参与创业的伙伴"),
        bullet("方案 C（项目制合作）— 按里程碑支付报酬 + 少量期权。适合想先试水再做长期决定的伙伴"),
        p("无论哪种方案，我们坚持以下原则：股权兑现采用 4 年 vesting + 1 年 cliff（行业标准），决策权与贡献对等，所有核心条款书面记录。"),

        heading("7.4 为什么加入这个项目", 2),
        bullet("时机正好 — AI 应用层正在爆发，关系智能是少有的\"需求真实存在 + AI 能显著提升体验 + 巨头尚未覆盖\"的赛道"),
        bullet("不是从零开始 — 产品已上线、代码已就绪、架构已稳定。你不需要花 3 个月搭建基础设施，可以直接在已有基座上加速"),
        bullet("技术挑战有趣 — LLM 结构化提取、知识图谱、向量搜索、同人识别……这些不是 CRUD，是真正有技术深度的问题"),
        bullet("中文 NLP 蓝海 — 所有竞品都在做英文，中文人脉管理是明确的差异化优势"),
        bullet("轻资产高杠杆 — SaaS 模式的边际成本极低，3 人团队就有可能做到百万级 ARR"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第八章 ═══════════════════
        heading("八、财务预测", 1),

        heading("8.1 三年财务模型（保守估计）", 2),
        makeTable(
          ["指标", "第 1 年", "第 2 年", "第 3 年"],
          [
            ["累计注册用户", "5,000", "20,000", "80,000"],
            ["付费用户数（3% 转化）", "150", "600", "2,400"],
            ["月经常性收入（MRR）", "¥4,350", "¥17,400", "¥69,600"],
            ["年经常性收入（ARR）", "¥52,200", "¥208,800", "¥835,200"],
            ["AI API 成本（年）", "¥165", "¥660", "¥2,640"],
            ["基础设施（Vercel + Supabase）", "¥0（免费层）", "¥7,200", "¥30,000"],
            ["毛利", "¥52,035", "¥200,940", "¥802,560"],
            ["毛利率", "99.7%", "96.3%", "96.1%"],
          ],
          [2200, 1800, 1800, 2212]
        ),

        heading("8.2 关键假设与敏感性", 2),
        p("以上预测基于保守的转化率和增长假设。实际表现可能因以下因素显著优于保守估计："),
        bullet("转化率：若达到行业优秀的 5%（而非保守的 3%），第三年 ARR 可达 ¥1,392,000"),
        bullet("定价：若专业版提价至 ¥49/月（仍远低于国际竞品），ARR 相应增长 69%"),
        bullet("团队版：每获取一个 5 人团队客户，相当于增加 5 个付费用户"),
        bullet("企业版：单个企业合同（¥50,000-200,000/年）可大幅改变财务曲线"),
        p("即使在最保守的假设下，项目的可变成本（AI API + 基础设施）占收入的比例极低，SaaS 的高毛利特性保证了健康的财务模型。"),

        divider(),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════ 第九章 ═══════════════════
        heading("九、风险与应对", 1),

        heading("9.1 技术风险", 2),
        p("LLM 依赖风险：产品核心依赖第三方 LLM API（MiniMax）。应对：架构设计中已预留模型切换能力（Anthropic 兼容 API 格式），支持快速迁移到其他模型。同时 Qwen3.5 已作为备用模型集成。"),
        p("数据安全风险：用户社交数据具有高度敏感性。应对：已实施多用户数据隔离（userId 外键），传输加密，后续可增加端到端加密和数据本地化存储选项。"),

        heading("9.2 市场风险", 2),
        p("用户教育成本：\"人脉管理\"在中文市场尚未形成成熟的品类认知。应对：通过内容营销建立品类心智，强调\"AI 自动记录\"而非\"手动 CRM\"的差异化，利用 Jeffery 人格降低用户心理门槛。"),
        p("巨头入场：腾讯、字节等可能入局 AI 社交助手。应对：深耕中文社交 Niche，建立数据网络效应和品牌情感连接（Jeffrey 人格），这些是大厂难以复制的。"),

        heading("9.3 竞争风险", 2),
        p("国际竞品中文化：Dex 或 Mesh 可能推出中文版。应对：它们的核心架构是为英文社交场景设计的（LinkedIn、Gmail、iMessage 集成），中国市场的微信生态、中文 NLP 需求构成了天然壁垒。"),
        p("国内模仿者：可能出现类似产品。应对：先发优势 + 技术积累 + Jeffrey 人格 IP + 数据网络效应。同时保持快速迭代，不做\"大而全\"，聚焦\"AI 提取 + 图谱 + 建议\"的核心闭环。"),

        heading("9.4 监管风险", 2),
        p("数据合规：中国《个人信息保护法》对用户数据的收集、存储、处理有明确要求。应对：当前架构已支持数据隔离，后续需完成网络安全等级保护备案（等保）、制定隐私政策、提供数据导出和删除功能。"),
        p("AI 监管：中国于 2026 年 4 月发布了《拟人化 AI 交互服务管理办法》（7 月生效），要求 AI 必须标注身份、对未成年人保护、成瘾管理等。Jeffrey 作为\"社交助手\"定位（而非\"AI 伴侣\"），在合规层面风险较低，但仍需提前准备合规文件。"),

        divider(),
        emptyLine(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200, line: 400 },
          children: [new TextRun({ text: "了解，先生。", font: FONT, size: 32, color: ACCENT, italics: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400, line: 340 },
          children: [new TextRun({ text: "—— Jeffrey", font: FONT, size: FONT_SIZE_BODY, color: TEXT_BODY })],
        }),
        emptyLine(),
        divider(),
        emptyLine(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200, line: 360 },
          children: [new TextRun({ text: "联系我们", font: FONT, size: FONT_SIZE_H2, color: PRIMARY, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60, line: 340 },
          children: [new TextRun({ text: "产品地址：https://jeffrey-ai.vercel.app", font: FONT, size: FONT_SIZE_BODY, color: TEXT_BODY })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60, line: 340 },
          children: [new TextRun({ text: "联系邮箱：请通过产品页面获取", font: FONT, size: FONT_SIZE_BODY, color: TEXT_BODY })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40, line: 340 },
          children: [new TextRun({ text: "本文档为内部机密文件，未经授权不得外传。", font: FONT, size: FONT_SIZE_SMALL, color: "999999" })],
        }),
      ],
    },
  ],
});

// ─── Generate ───
const OUTPUT = "d:\\Epstein.AI\\docs\\Jeffrey.AI商业计划书.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Generated: " + OUTPUT);
  console.log("Size: " + (buf.length / 1024).toFixed(1) + " KB");
});
