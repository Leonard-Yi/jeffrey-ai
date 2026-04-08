# D:/Epstein.AI/scripts/research/constants.py

"""
字段常量定义。

分组:
- SEARCH_FIELDS: 网页搜索字段
- LIXINGER_FIELDS: 理杏仁数据字段
- PDF_FIELDS: 年报 PDF 提取字段
- ALL_FIELDS: 完整字段列表（用于 Excel 输出顺序）
"""

# 第一组：通用字段（网页搜索）
SEARCH_FIELDS = [
    "成立时间",
    "所在地（总部）",
    "创始人",
    "股东背景",
    "官网 Link",
]

SEARCH_TEMPLATE = {
    "成立时间": "{company} 成立时间",
    "所在地（总部）": "{company} 总部 OR 注册地",
    "创始人": "{company} 创始人",
    "股东背景": "{company} 股东 OR 前十大股东",
    "官网 Link": "{company} 官网",
}

# 第二组：理杏仁字段
LIXINGER_FIELDS = [
    "市盈率",
    "市净率",
    "市销率",
    "EV/EBITDA",
    "毛利率",
    "净利率",
    "应收账款回款周期(天)",
    "前五大客户占比",
]

# 第三组：年报 PDF 字段
PDF_FIELDS = [
    "营收规模",
    "归母净利润",
    "EBITDA",
    "经营活动现金流量净额",
    "资产总额",
    "总员工人数",
    "核心业务领域",
    "服务范围",
    "主要资质",
    "主要客户类型",
    "是否轻资产运营",
    "行业地位",
    "核心研发人员数量/级别",
    "市场占有率",
    "海外业务占比",
    "主要合作伙伴",
    "代表性项目",
    "标杆客户",
    "成功案例",
    "行业影响力",
    "补充说明",
]

# 所有字段（按 Excel 行顺序）
ALL_FIELDS = (
    ["公司名称", "股票代码", "交易所"] +
    SEARCH_FIELDS +
    LIXINGER_FIELDS +
    PDF_FIELDS
)