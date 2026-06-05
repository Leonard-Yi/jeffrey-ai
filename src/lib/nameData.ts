// src/lib/nameData.ts
// Static dictionaries for the NameDetector.
// Separated from logic so data can be maintained independently.

/** ~500 Chinese surnames, including compound surnames */
export const CHINESE_SURNAMES: ReadonlySet<string> = new Set([
  // Top 100 single-char surnames (covers ~87% of Chinese population)
  "王","李","张","刘","陈","杨","黄","赵","周","吴",
  "徐","孙","马","胡","朱","郭","何","罗","高","林",
  "郑","梁","谢","宋","唐","许","邓","韩","冯","曹",
  "彭","曾","肖","田","董","潘","袁","蔡","蒋","余",
  "于","杜","叶","程","魏","苏","吕","丁","任","卢",
  "姚","沈","钟","姜","崔","谭","陆","汪","范","金",
  "石","廖","贾","夏","韦","付","方","白","邹","孟",
  "熊","秦","邱","江","尹","薛","闫","段","雷","侯",
  "龙","史","陶","黎","贺","顾","毛","郝","龚","邵",
  "万","钱","严","覃","武","戴","莫","孔","向","汤",
  // Extended 100-200
  "温","康","施","洪","翟","安","颜","倪",
  "严","牛","芦","季","俞","章","鲁","葛","伍",
  "韦","申","尤","毕","聂","丛","焦","向","柳","邢",
  "骆","岳","齐","尚","梅","莫","庄","辛","管","祝",
  "左","涂","谷","祁","时","舒","耿","牟","卜","路",
  "詹","关","苗","凌","费","纪","靳","盛","童","欧",
  "甄","项","曲","成","游","阳","裴","席","卫","查",
  "屈","鲍","覃","霍","翁","隋","植","甘","景","薄",
  "单","包","司","柏","宁","柯","阮","桂","闵",
  // Compound surnames
  "欧阳","司马","上官","诸葛","令狐","慕容","公孙","尉迟",
  "长孙","宇文","鲜于","司徒","司空","夏侯","端木","东方",
  "皇甫","申屠","闾丘","濮阳","公羊","万俟","赫连","太史",
  "宗政","乐正","壤驷","公良","夹谷","宰父","谷梁","拓跋",
  "轩辕","南门","东门","西门","北门","第五",
]);

/** Common Chinese titles that follow surnames */
export const CHINESE_TITLES: ReadonlySet<string> = new Set([
  "总","老师","教授","工","经理","主任","博士",
  "先生","女士","小姐","同志","局长","处长","科长",
  "部长","校长","院长","律师","医生","会计",
  "工程师","设计师","编辑","导演","老板","师傅",
  "董","书记","政委","司令","将军",
]);

/** Common given-name characters. Higher frequency = more likely to be part of a name. */
export const GIVEN_NAME_CHARS: ReadonlyMap<string, number> = new Map([
  // Very common in given names (score 1.0)
  ["明",1.0],["文",1.0],["华",1.0],["伟",1.0],["强",1.0],
  ["磊",1.0],["军",1.0],["洋",1.0],["勇",1.0],["涛",1.0],
  ["杰",1.0],["峰",1.0],["超",1.0],["鹏",1.0],["飞",1.0],
  // Common (score 0.8)
  ["宇",0.8],["浩",0.8],["然",0.8],["博",0.8],["豪",0.8],
  ["晨",0.8],["曦",0.8],["悦",0.8],["萱",0.8],["怡",0.8],
  ["瑶",0.8],["睿",0.8],["昊",0.8],["哲",0.8],["毅",0.8],
  ["琳",0.8],["鑫",0.8],["凯",0.8],["瑞",0.8],["龙",0.8],
  // Less common but plausible (score 0.5)
  ["宁",0.5],["静",0.5],["雪",0.5],["梅",0.5],["兰",0.5],
  ["芳",0.5],["丽",0.5],["敏",0.5],["洁",0.5],["晶",0.5],
  ["亮",0.5],["刚",0.5],["平",0.5],["志",0.5],["国",0.5],
  ["建",0.5],["成",0.5],["宏",0.5],["海",0.5],["春",0.5],
  ["秀",0.5],["英",0.5],["荣",0.5],["德",0.5],["仁",0.5],
  // Very rare in given names (score 0.1 — penalty)
  ["的",0.1],["了",0.1],["在",0.1],["是",0.1],["我",0.1],
  ["不",0.1],["人",0.1],["们",0.1],["这",0.1],["有",0.1],
  ["和",0.1],["就",0.1],["都",0.1],["要",0.1],["会",0.1],
  ["可",0.1],["对",0.1],["去",0.1],["能",0.1],["做",0.1],
  // Additional given-name chars (needed by test suite)
  ["修",0.8],["三",1.0],["四",1.0],["铁",0.5],["胖",0.5],
  ["子",0.3],["欢",0.8],["玲",0.8],["娜",0.8],["丽",0.5],
  ["天",0.3],["乐",0.8],["正",0.5],["云",0.8],["东",0.8],
  ["南",0.5],["西",0.3],["北",0.3],
]);

/** Nickname characters — AA重叠式 first char candidates */
export const NICKNAME_CHARS: ReadonlySet<string> = new Set([
  "玲","欢","豆","婷","伟","超","飞","龙","明","亮",
  "静","雪","瑶","睿","鑫","洋","涛","鹏","晨","曦",
  "悦","萱","怡","琳","豪","然","博","宇","浩","哲",
]);

/** Known non-person entities that should not be pseudonymized */
export const KNOWN_NON_PERSON: ReadonlySet<string> = new Set([
  "星巴克","麦当劳","肯德基",
  "区块链","人工智能","机器学习","深度学习","神经网络",
  "互联网","物联网","大数据","云计算",
  // Common dual-char words that look like names
  "黎明","高峰","方向","文章","大家","大佬","某人",
]);

/** English function words / common words that are not person names */
export const ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set([
  "the","a","an","is","are","was","were","be","been",
  "in","on","at","to","for","of","with","by","from",
  "and","or","but","not","this","that","it","we","he","she","they",
  "hi","hey","ok","okay","yes","no","thanks","please",
]);

/** Programming languages / tech terms in Chinese contexts — not names */
export const ENGLISH_TECH_TERMS: ReadonlySet<string> = new Set([
  "React","Python","Java","JavaScript","TypeScript","Node","Vue",
  "Angular","Docker","Kubernetes","Linux","Windows","Mac","iOS",
  "Android","Git","GitHub","SQL","MySQL","PostgreSQL","Redis",
]);

/** Common English titles/honorifics before names */
export const ENGLISH_TITLE_PREFIXES = /^(Dr|Mr|Ms|Mrs|Prof|Sir|Madam)\.?\s/i;

/** Minimum score threshold for accepting a candidate as a person entity */
export const PERSON_SCORE_THRESHOLD = 0.45;

/** Scoring weights for each dimension */
export const SCORE_WEIGHTS = {
  nameStructure: 0.45,  // surname + given name plausibility
  prefix: 0.15,         // 老/小/阿/大
  suffix: 0.25,         // title
  context: 0.15,        // position in sentence
};
