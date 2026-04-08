import os
from dotenv import load_dotenv

load_dotenv()

# LLM API 配置（复用 Epstein.AI 的 DashScope）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen-plus")

# PDF 存储路径
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "reports")

# 输出 Excel 路径
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "output")