# D:/Epstein.AI/scripts/research/parse_report.py

import pdfplumber
from pathlib import Path
import re
import openai
import json
import sys


def truncate_pdf_before_financial_statements(pdf_path: Path) -> str:
    """
    读取 PDF，截取'管理层讨论与分析'章节及其之前的内容，
    丢弃其后的财务报表、附注等。
    返回截断后的纯文本。
    """
    full_text = []
    found_discussion_title = False
    found_discussion_page = False  # 标记是否已进入章节并看到第一页

    # 章节结束信号（找到这些标题意味着管理层讨论与分析章节结束）
    END_SIGNALS = [
        r"第[一二三四五六七八九十\d]+节?\s*财务报告",
        r"第[一二三四五六七八九十\d]+节?\s*审计报告",
        r"第[一二三四五六七八九十\d]+节?\s*财务报表",
        r"合并财务报表",
        r"公司财务报表",
    ]

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            lines = text.split("\n")

            # 检查是否进入"管理层讨论与分析"章节
            if not found_discussion_title:
                for line in lines:
                    if re.search(r"管理层讨论与分析", line):
                        found_discussion_title = True
                        break

            # 标记已进入章节，第一页必须保留
            if found_discussion_title and not found_discussion_page:
                found_discussion_page = True

            # 检查是否已离开管理层讨论章节（进入财务报表）
            # 只有在看到章节第一页之后才检查 END_SIGNALS，确保第一页一定被保留
            if found_discussion_page:
                for line in lines:
                    for signal in END_SIGNALS:
                        if re.search(signal, line):
                            # 找到了财务报表章节，停止，不加入这一页
                            return "\n".join(full_text)

            full_text.append(text)

    return "\n".join(full_text)


def extract_fields_with_llm(text: str, company_name: str) -> dict:
    """
    将截断后的年报文本发送给 LLM，提取结构化字段。
    返回字段字典。
    """
    from config import DASHSCOPE_API_KEY, LLM_MODEL
    from constants import PDF_FIELDS

    client = openai.OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    fields_list = "\n".join(f"- {f}" for f in PDF_FIELDS)

    prompt = f"""你是一个专业的财务数据提取助手。以下是{company_name}的年度报告文本（已截取到管理层讨论与分析章节）。

请从文本中提取以下字段的值。如果某字段在文本中找不到，写"缺失"。
所有字段都必须返回，不要遗漏。

字段列表：
{fields_list}

请以 JSON 格式返回，key 为字段名，value 为提取的值。
只返回 JSON，不要有其他内容。"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "你是一个专业的A股财务数据提取助手。"},
            {"role": "user", "content": f"{prompt}\n\n年报文本：\n{text[:30000]}"},
        ],
        temperature=0.1,
    )

    result_text = response.choices[0].message.content.strip()
    # 去掉可能的 markdown 代码块
    if result_text.startswith("```"):
        result_text = result_text.split("```")[1]
        if result_text.startswith("json"):
            result_text = result_text[4:]
    return json.loads(result_text.strip())


def parse_report(pdf_path: Path, company_name: str) -> dict:
    """
    解析年报 PDF，返回字段字典。
    """
    print(f"[PARSE] 截取 PDF: {pdf_path.name}")
    text = truncate_pdf_before_financial_statements(pdf_path)
    print(f"[PARSE] 截取文本长度: {len(text)} 字符")

    fields = extract_fields_with_llm(text, company_name)
    return fields


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python parse_report.py <PDF路径> <公司名称>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    company_name = sys.argv[2]

    result = parse_report(pdf_path, company_name)
    print(json.dumps(result, ensure_ascii=False, indent=2))