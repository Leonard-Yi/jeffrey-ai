# D:/Epstein.AI/scripts/research/download_report.py
"""
从巨潮资讯网下载指定公司的最新年报 PDF。

用法:
    python download_report.py 603355 莱克电气
    python download_report.py 300750 宁德时代
"""
import sys
import os
import requests
import json
import re
from pathlib import Path

REPORTS_DIR = Path(__file__).parent.parent.parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

CNINFO_URL = "http://www.cninfo.com.cn/new/hisAnnouncement/query"


def _cninfo_headers(referer_org_id: str = "") -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"http://www.cninfo.com.cn/new/disclosure/stock?stockCode=&orgId={referer_org_id}",
    }


def _guess_plate_and_column(code: str) -> tuple[str, str]:
    """根据股票代码推断交易所和 plate/column 参数。"""
    if code.startswith("6"):
        return "shse", "sse"
    elif code.startswith(("0", "3")):
        return "szse", "szse"
    else:
        return "", ""


def _query_announcements(
    code: str, org_id: str, plate: str, column: str, category: str = ""
) -> list[dict]:
    """向巨潮 API 查询公告列表。"""
    stock_param = f"{code},{org_id}" if org_id else code
    data = {
        "stock": stock_param,
        "tabName": "fulltext",
        "plate": plate,
        "pageSize": 30,
        "pageNum": 1,
        "column": column,
        "category": category
        or "category_ndbg_szsh;category_bndbg_szsh;category_yjdbg_szsh;category_sjdbg_szsh;",
        "isHLtitle": "true",
    }
    try:
        resp = requests.post(
            CNINFO_URL, headers=_cninfo_headers(org_id), data=data, timeout=10
        )
        resp.raise_for_status()
        result = resp.json()
        return result.get("announcements") or []
    except Exception:
        return []


def search_annual_report_url(code: str, company_name: str = "") -> tuple[str, str] | None:
    """
    搜索巨潮，获取最新年报 PDF 的 (标题, URL)。

    返回 (年报标题, PDF下载URL) 或 None。
    """
    plate, column = _guess_plate_and_column(code)

    # 部分股票可以使用 gssh/gssz 前缀格式直接查询
    if code.startswith("6"):
        stock_candidates = [f"{code},gssh0{code}", f"{code},gssh{code}"]
    else:
        stock_candidates = [f"{code},gssz0{code}", f"{code},gssz{code}"]

    announcements = []
    for stock_param in stock_candidates:
        anns = _query_announcements(code, stock_param.split(",")[1], plate, column)
        if anns:
            announcements = anns
            break

    # 如果直接查询失败，使用 searchkey 通过公司名查找 orgId
    if not announcements and company_name:
        anns = _query_announcements(code, "", plate, column, category="")
        # searchkey 查找
        data = {
            "stock": "",
            "tabName": "fulltext",
            "plate": plate,
            "pageSize": 30,
            "pageNum": 1,
            "column": column,
            "category": "",
            "searchkey": company_name,
            "isHLtitle": "true",
        }
        try:
            resp = requests.post(CNINFO_URL, headers=_cninfo_headers(), data=data, timeout=10)
            resp.raise_for_status()
            result = resp.json()
            found_anns = result.get("announcements") or []
        except Exception:
            found_anns = []

        for ann in found_anns:
            if ann.get("secCode") == code:
                found_org_id = ann.get("orgId", "")
                if found_org_id:
                    announcements = _query_announcements(
                        code, found_org_id, plate, column
                    )
                    break

    # 过滤出年报
    for ann in announcements:
        title = ann.get("announcementTitle", "")
        if re.search(r"\d{4}年年度报告", title):
            adjunct_url = ann.get("adjunctUrl", "")
            if adjunct_url:
                full_url = f"http://static.cninfo.com.cn/{adjunct_url}"
                return title, full_url

    return None


def download_report(code: str, company_name: str, force: bool = False) -> Path | None:
    """
    下载指定公司的最新年报 PDF。

    返回本地文件 Path，失败返回 None。
    """
    result = search_annual_report_url(code, company_name=company_name)
    if not result:
        print(f"[WARN] 未找到 {company_name}({code}) 的年报")
        return None

    title, url = result
    # 生成文件名：603355_莱克电气_2024年年度报告.pdf
    # 标题一般以公司名开头，避免文件名中公司名重复
    safe_company = company_name.replace("*", "SST")  # *ST 公司处理
    safe_title = re.sub(r'[/\\]', '_', title)  # 防止路径穿越
    if safe_title.startswith(safe_company):
        filename = f"{code}_{safe_title}.pdf"
    else:
        filename = f"{code}_{safe_company}_{safe_title}.pdf"
    # 去掉 Windows 文件名中的非法字符
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filepath = REPORTS_DIR / filename

    if filepath.exists() and not force:
        print(f"[SKIP] 已存在: {filepath.name}")
        return filepath

    print(f"[DOWN] 下载: {url}")
    try:
        pdf_resp = requests.get(url, timeout=30)
        pdf_resp.raise_for_status()
        with open(filepath, "wb") as f:
            f.write(pdf_resp.content)
    except Exception as e:
        print(f"[ERROR] 下载失败: {e}")
        return None

    print(f"[OK] 保存: {filepath.name}")
    return filepath


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python download_report.py <股票代码> <公司简称>")
        sys.exit(1)

    code = sys.argv[1]
    name = sys.argv[2]
    path = download_report(code, name)
    if path:
        print(f"PDF路径: {path}")