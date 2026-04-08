# research-assistant

## 描述

公司研究 Agent。输入一个行业或公司列表，自动搜索整理各公司的公开数据，最终综合成一张横向排列的 Excel 汇总表。

## 使用方式

```
/research <行业或公司列表>
```

示例：
```
/research 新能源汽车行业
/research 比亚迪,宁德时代,理想汽车
```

## 工作流程

1. 用户输入行业或公司列表
2. 若输入为行业：通过网页搜索找到 A 股该行业主要上市公司列表，列给用户确认
3. 若输入为公司列表：直接使用
4. 对每家公司并行执行：
   - MCP 搜索通用字段（成立时间、创始人、股东背景等）
   - 调用 download_report.py 下载最新年报 PDF
   - 调用 parse_report.py 解析 PDF，提取财务和业务字段
   - 通过 MCP 搜索补充理杏仁字段（PE/PB/PS 等）
5. 调用 write_excel.py 将所有数据写入 Excel（横向布局）
6. 通知用户完成

## 数据来源

| 字段类型 | 来源 |
|---------|------|
| 成立时间/创始人/股东背景/官网 | MCP 网页搜索 |
| PE/PB/PS/EV/EBITDA | MCP 搜索理杏仁数值 |
| 毛利率/净利率/营收等 | 年报 PDF（巨潮下载）|
| 前五大客户/应收账款天数 | 理杏仁搜索或年报 PDF |

## Excel 输出

- 横向布局（每家公司一列，字段按行）
- 文件命名：`<行业>_公司研究_YYYYMMDD.xlsx`
- 位置：`output/` 目录

## 脚本路径

所有脚本位于：`scripts/research/`
- `download_report.py` — 下载年报 PDF
- `parse_report.py` — 解析 PDF，提取字段
- `write_excel.py` — 写入 Excel
- `run_research.py` — 端到端测试

## 依赖

- Python 3
- pdfplumber, openpyxl, requests, openai/dashscope
- MCP (web_search_exa, web_fetch_exa)

## 注意事项

- 理杏仁部分页面为 JS 动态加载，直接抓取可能超时，可通过搜索具体数值绕过
- 年报 PDF 截取"管理层讨论与分析"章节之前的内容
- 找不到的字段标注"缺失"，不阻塞流程
- 输出文件默认保存在 `output/` 目录