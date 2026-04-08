# D:/Epstein.AI/scripts/research/run_research.py
"""
公司研究 Agent 的端到端测试脚本。

完整流程：
1. 下载年报 PDF
2. 解析 PDF，提取字段
3. 通过 MCP 搜索补充通用字段（这里先用占位值，待 Skill 阶段接入 MCP）
4. 合并数据，写入 Excel

用法:
    python run_research.py 603355 莱克电气 小家电
"""
import sys
from pathlib import Path

# 添加项目根目录，确保 scripts.research 包可被导入
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from download_report import download_report
from parse_report import parse_report
from write_excel import get_filename, init_workbook, write_company_data, save_workbook
from constants import SEARCH_FIELDS


def run_research(code: str, company_name: str, industry: str):
    """完整流程。"""
    # 1. 下载年报 PDF
    pdf_path = download_report(code, company_name)

    # 2. 解析 PDF
    if pdf_path:
        try:
            pdf_fields = parse_report(pdf_path, company_name)
        except Exception as e:
            print(f"Warning: parse_report failed: {e}")
            pdf_fields = {}
    else:
        pdf_fields = {}

    # 3. 补充搜索字段（这里先用占位，待 MCP 接入）
    search_fields = {}
    for field in SEARCH_FIELDS:
        search_fields[field] = f"[待搜索] {field}"

    # 4. 合并数据
    company_data = {
        "公司名称": company_name,
        "股票代码": code,
        "交易所": "上交所" if code.startswith("6") else "深交所",
    }
    company_data.update(search_fields)
    company_data.update(pdf_fields)

    # 5. 写入 Excel
    companies = [company_name]
    filepath = get_filename(industry)
    try:
        wb, ws, all_companies = init_workbook(filepath, companies)
        write_company_data(ws, company_name, company_data, all_companies)
        save_workbook(wb, filepath)
    except Exception as e:
        print(f"Error: Excel write failed: {e}")
        sys.exit(1)

    return company_data


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("用法: python run_research.py <股票代码> <公司名称> <行业>")
        sys.exit(1)

    code = sys.argv[1]
    name = sys.argv[2]
    industry = sys.argv[3]
    result = run_research(code, name, industry)

    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))