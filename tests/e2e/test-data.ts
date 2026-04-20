// 测试数据
export const TEST_DATA = {
  // 录入测试
  input: {
    simple: '今天和老王喝咖啡',
    withDetails: '今天和老王喝咖啡，他说最近在研究LLM',
    multiplePersons: '今天和老王、张总一起吃了顿饭',
  },

  // 人物测试数据（用于预埋）
  persons: {
    laoWang: {
      name: '老王',
      careers: [{ name: '投行', weight: 0.9 }],
      interests: [{ name: 'LLM', weight: 0.7 }],
    },
    zhangZong: {
      name: '张总',
      careers: [{ name: 'VC', weight: 0.85 }],
      interests: [{ name: '区块链', weight: 0.6 }],
    },
  },
};

// 辅助函数：生成带时间戳的测试数据（避免冲突）
export function timestamp() {
  return Date.now().toString(36);
}

// 辅助函数：生成唯一的测试姓名
export function uniqueName(prefix: string) {
  return `${prefix}_${timestamp()}`;
}
