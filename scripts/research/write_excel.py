# D:/Epstein.AI/scripts/research/write_excel.py
"""
将公司数据写入横向布局的 Excel 文件。

布局:
            | 公司A  | 公司B  | 公司C  |
成立时间    |  xxx   |  xxx   |  xxx   |
所在地      |  xxx   |  xxx   |  xxx   |
...

文件命名: 行业名_公司研究_YYYYMMDD.xlsx
策略: 已存在的数据覆盖写入；新增公司追加列；缺失字段留空。
"""
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from pathlib import Path
import datetime
from scripts.research.config import OUTPUT_DIR
from scripts.research.constants import ALL_FIELDS


Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


def get_filename(industry: str) -> Path:
    """生成文件名：行业名_公司研究_YYYYMMDD.xlsx"""
    date = datetime.date.today().strftime("%Y%m%d")
    safe_industry = industry.replace("/", "_").replace("\\", "_")
    return Path(OUTPUT_DIR) / f"{safe_industry}_公司研究_{date}.xlsx"


def init_workbook(filepath: Path, companies: list[str]) -> tuple[openpyxl.Workbook, openpyxl.worksheet.worksheet.Worksheet]:
    """
    创建或打开 Excel 文件，初始化表头。
    返回 (workbook, worksheet)。
    """
    if filepath.exists():
        wb = openpyxl.load_workbook(filepath)
        ws = wb.active
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "公司研究"
        # 写表头：第一列是字段名
        ws.cell(row=1, column=1, value="字段")
        for col, company in enumerate(companies, start=2):
            ws.cell(row=1, column=col, value=company)
        # 写字段名（第一列）
        for row, field in enumerate(ALL_FIELDS, start=2):
            ws.cell(row=row, column=1, value=field)

    return wb, ws


def write_company_data(
    ws: openpyxl.worksheet.worksheet.Worksheet,
    company: str,
    data: dict,
    companies: list[str],
):
    """
    将公司数据写入指定列。覆盖模式：先清空该列再写入。
    """
    col_index = companies.index(company) + 2  # +2 因为第1列是字段名，第2列开始是公司

    for row, field in enumerate(ALL_FIELDS, start=2):
        cell = ws.cell(row=row, column=col_index)
        value = data.get(field, "")
        if value is None:
            value = ""
        cell.value = value


def save_workbook(wb: openpyxl.Workbook, filepath: Path):
    """保存 workbook。"""
    wb.save(filepath)
    print(f"[OK] 已保存: {filepath.name}")


if __name__ == "__main__":
    # CLI 测试
    import json
    import sys

    if len(sys.argv) < 4:
        print("用法: python write_excel.py <行业名> <公司名> <数据JSON|JSON文件路径>")
        sys.exit(1)

    industry = sys.argv[1]
    company = sys.argv[2]
    data_arg = sys.argv[3]

    if data_arg.startswith("{"):
        data = json.loads(data_arg)
    else:
        with open(data_arg, encoding="utf-8") as f:
            data = json.load(f)

    companies = [company]
    filepath = get_filename(industry)
    wb, ws = init_workbook(filepath, companies)
    write_company_data(ws, company, data, companies)
    save_workbook(wb, filepath)