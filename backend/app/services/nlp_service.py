"""
模块名称: nlp_engine.py
功能描述: NLP核心分析引擎 —— 提供文本预处理、中文分词、情感分析、
         关键词提取、心理主题分类等核心算法。

数据结构应用:
    - Set:   停用词表、心理类别关键词集 (O(1) 查询)
    - List:  分词序列、情感得分序列
    - Dict:  词频映射、心理主题得分、分析结果汇总
    - Tuple: 关键词-权重对 (keyword, weight)
"""

import re
from typing import List, Dict, Set, Tuple, Optional

import jieba
import jieba.analyse


# ─── 默认中文停用词表 ─────────────────────────────────────────────
DEFAULT_STOPWORDS: Set[str] = {
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
    "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
    "没有", "看", "好", "自己", "这", "他", "她", "它", "们", "那", "些",
    "所", "为", "所以", "因为", "但是", "然而", "虽然", "可以", "还是",
    "这个", "那个", "什么", "怎么", "怎样", "哪", "哪里", "还", "被", "把",
    "让", "给", "从", "与", "或", "及", "对", "向", "往", "朝", "比",
    "跟", "同", "而", "而且", "并", "并且", "虽", "但", "却", "只",
    "请", "吧", "吗", "呢", "啊", "嘛", "哈", "呀", "哦", "嗯", "哇",
    "能", "能够", "可能", "应该", "可以", "需要", "会", "该", "得",
    "更", "最", "太", "很", "非常", "比较", "有点", "更加", "极",
    "做", "作", "搞", "弄", "干", "进行", "觉得", "认为", "想", "觉得",
    "知道", "感觉", "发现", "开始", "继续", "已经", "曾经", "正在",
    "将", "要", "会", "可能", "一定", "必须", "真的", "确实", "其实",
    "当然", "特别", "一样", "这样", "那样", "怎么", "这么", "那么",
    "之后", "以后", "之前", "以前", "时候", "现在", "今天", "明天",
    "昨天", "去年", "今年", "一点", "一些", "很多", "少", "多",
    "来", "去", "出", "进", "过", "起", "下", "中", "前", "后",
    "里", "外", "边", "旁", "左", "右", "东", "西", "南", "北",
    "第", "号", "年", "月", "日", "时", "分", "秒",
    "只", "条", "个", "位", "名", "种", "件", "次", "遍",
    "用", "拿", "靠", "凭", "按", "照", "据", "按", "根",
    "吧", "吗", "呀", "啦", "哇", "唉", "嘿", "喂",
}


# ─── 心理主题类别词典 ─────────────────────────────────────────────
# 数据结构: Dict[str, Set[str]] — 每个心理主题对应一组关键词(Set)
PSYCH_TOPIC_KEYWORDS: Dict[str, Set[str]] = {
    "学业压力": {
        "学习", "考试", "成绩", "论文", "毕业", "考研", "课程", "挂科",
        "拖延", "作业", "科研", "导师", "复习", "备考", "保研", "出国",
        "绩点", "学分", "选课", "答辩", "开题", "实验",
    },
    "人际关系": {
        "朋友", "舍友", "同学", "社交", "孤立", "矛盾", "冲突", "信任",
        "沟通", "误会", "冷战", "吵架", "室友", "相处", "排斥", "八卦",
        "圈子", "塑料", "情谊", "背叛",
    },
    "情感问题": {
        "恋爱", "分手", "暗恋", "表白", "失恋", "异地", "吵架", "前任",
        "暧昧", "男友", "女友", "对象", "单身", "相亲", "复合", "吃醋",
    },
    "家庭关系": {
        "父母", "家人", "家庭", "期望", "控制", "代沟", "离婚", "爸妈",
        "爸爸", "妈妈", "父亲", "母亲", "亲戚", "回家", "管教", "催婚",
    },
    "自我认知": {
        "迷茫", "自卑", "价值", "意义", "未来", "方向", "目标", "自信",
        "认同", "我是谁", "成长", "性格", "内向", "外向", "完美主义",
    },
    "就业焦虑": {
        "工作", "就业", "实习", "面试", "简历", "职业", "薪水", "前途",
        "竞争", "秋招", "春招", "offer", "大厂", "考公", "考编",
    },
    "情绪管理": {
        "焦虑", "抑郁", "失眠", "压力", "烦躁", "疲惫", "崩溃", "难过",
        "孤独", "恐惧", "愤怒", "悲伤", "委屈", "无助", "绝望", "内耗",
        "Emo", "大哭", "情绪化", "暴躁",
    },
    "适应困难": {
        "适应", "新生", "环境", "变化", "独立", "不习惯", "想家",
        "陌生", "重新开始", "转学", "换宿舍",
    },
}


class PsychAssessmentEngine:
    """大学生心理测评NLP核心分析引擎

    整合中文分词、停用词过滤、情感分析、关键词提取、心理主题分类
    等功能，提供一站式心理文本分析流水线。

    Attributes:
        stopwords: 停用词集合 (Set[str]), O(1) 查询复杂度
        topic_keywords: 心理主题关键词词典 (Dict[str, Set[str]])
    """

    # ─── 心理情感词典 (全面覆盖心理场景) ────────────────────
    # 数据结构: Dict[str, float] — 词汇 → 情感强度 (负=消极, 正=积极)
    PSYCH_NEGATIVE: Set[str] = {
        # ── 重度消极 ──
        "绝望", "崩溃", "窒息", "想死", "自残", "自杀", "活不下去",
        "生无可恋", "走投无路", "万念俱灰", "痛不欲生", "生不如死",
        # ── 情绪症状 ──
        "抑郁", "焦虑", "恐惧", "害怕", "恐慌", "压抑", "煎熬",
        "无助", "绝望", "孤独", "孤立", "寂寞", "空虚", "麻木",
        "痛苦", "折磨", "悲伤", "悲哀", "伤心", "痛哭", "哭泣",
        "大哭", "想哭", "难过", "难受", "不开心", "不高兴", "低落",
        "消沉", "沮丧", "灰心", "丧气", "颓废", "萎靡",
        "烦躁", "烦闷", "烦心", "心烦意乱", "坐立不安", "焦躁",
        "不安", "忐忑", "心神不宁", "惶惶不安", "紧张", "惊慌",
        "愤怒", "暴躁", "恼火", "生气", "气愤", "怨恨", "恨",
        "委屈", "冤枉", "不甘", "不平", "憋屈", "窝囊",
        "愧疚", "内疚", "自责", "后悔", "遗憾", "惭愧",
        # ── 自我否定 ──
        "失败", "没用", "废物", "垃圾", "差劲", "无能", "一无是处",
        "不如人", "比不上", "不配", "配不上", "不称职", "不行",
        "自卑", "不自信", "自我怀疑", "自我否定", "讨厌自己",
        "嫌弃自己", "看不起自己", "觉得自己差",
        # ── 迷茫空虚 ──
        "迷茫", "迷失", "困惑", "不知所措", "彷徨", "迷惘",
        "没意思", "没意义", "没价值", "没人在乎", "无所谓",
        "不知道怎么办", "不知道该", "不知道怎么办才好",
        # ── 疲惫无力 ──
        "疲惫", "疲倦", "累", "无力", "筋疲力尽", "身心疲惫",
        "心力交瘁", "身心俱疲", "透支", "力不从心", "提不起劲",
        "没精神", "没力气", "没动力", "懒得", "不想动",
        "内耗", "消耗", "心累", "心好累", "太累了",
        "撑不住", "熬不住", "扛不住", "挺不住", "受不了",
        # ── 人际创伤 ──
        "被孤立", "被排挤", "被欺负", "霸凌", "欺凌", "冷暴力",
        "吵架", "争吵", "闹掰", "绝交", "翻脸", "冷战", "断交",
        "背叛", "欺骗", "被甩", "失恋", "分手", "被分手",
        "被忽视", "被冷落", "被嫌弃", "被讨厌", "不被理解",
        # ── 学业困境 ──
        "挂科", "退学", "休学", "延毕", "肄业", "重修",
        "不及格", "考砸", "考差了", "没考好", "成绩差",
        "学不会", "学不进去", "看不进去", "听不懂", "跟不上",
        "厌学", "不想学", "不想上课", "逃课",
        # ── 生理症状 ──
        "失眠", "睡不着", "惊醒", "多梦", "噩梦", "嗜睡",
        "没食欲", "暴食", "吃不下", "反胃", "恶心",
        "心慌", "心悸", "胸闷", "气短", "发抖", "冒冷汗",
        "头晕", "头痛", "浑身疼",
        # ── 负向短语 ──
        "不行了", "完蛋了", "没救了", "没办法", "没希望",
        "看不到希望", "看不到未来", "前途渺茫",
        "放弃", "逃避", "退缩", "躺平", "摆烂", "自暴自弃",
        "社恐", "不想见人", "不想说话", "不想出门",
    }

    PSYCH_POSITIVE: Set[str] = {
        "开心", "快乐", "愉快", "高兴", "欣喜", "喜悦", "欢喜",
        "幸福", "美满", "甜蜜", "温馨", "美好",
        "自信", "自豪", "骄傲", "满足", "满意", "欣慰",
        "希望", "期待", "憧憬", "向往", "乐观",
        "积极", "向上", "进取", "奋斗", "拼搏", "努力",
        "感恩", "感谢", "感动", "感激", "珍惜",
        "温暖", "贴心", "关爱", "关心", "体贴",
        "放松", "轻松", "自在", "舒适", "惬意", "舒服",
        "充实", "丰富", "精彩", "有趣", "好玩",
        "进步", "成长", "收获", "突破", "成功", "胜利",
        "喜欢", "热爱", "喜爱", "钟爱", "爱",
        "坚强", "勇敢", "坚定", "果断", "勇往直前",
        "平静", "淡定", "从容", "坦然", "释然", "放下",
        "优秀", "出色", "杰出", "厉害", "很棒", "真棒",
        "漂亮", "帅气", "好看", "可爱", "美",
        "支持", "鼓励", "加油", "没问题", "可以的",
        "offer", "通过", "录取", "拿到", "成了",
        "顺利", "顺心", "如意", "如愿", "圆满",
        "健康", "活力", "元气", "精力充沛",
        "舒服", "享受", "陶醉", "沉浸",
        "温暖", "治愈", "安慰", "被理解", "被接纳",
    }

    # 否定词（翻转情感极性）
    NEGATION_WORDS: Set[str] = {
        "不", "没有", "没", "无", "非", "别", "不要", "不会",
        "不可能", "无法", "难以", "很难",
    }

    def __init__(self, stopwords: Optional[Set[str]] = None):
        """初始化分析引擎

        Args:
            stopwords: 自定义停用词集合, 若为 None 则使用内置默认停用词表
        """
        # 数据结构: Set — 停用词集合, 基于哈希表实现 O(1) 查询
        self.stopwords: Set[str] = stopwords if stopwords is not None else DEFAULT_STOPWORDS.copy()

        # 数据结构: Dict[str, Set[str]] — 心理主题 → 关键词集合
        self.topic_keywords: Dict[str, Set[str]] = PSYCH_TOPIC_KEYWORDS

        # PsyQA 语料库词汇表 (后续由 data_loader 注入)
        self.corpus_word_freq: Dict[str, float] = {}
        self.psy_keywords: Set[str] = set()

    def load_stopwords_from_file(self, filepath: str) -> None:
        """从文本文件加载停用词, 每行一个词

        满足课程文件IO要求: 读取TXT文件

        Args:
            filepath: 停用词文件路径
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                # 数据结构: Set — 使用集合推导式高效加载与去重
                custom_stopwords = {line.strip() for line in f if line.strip()}
                self.stopwords.update(custom_stopwords)
                print(f"[INFO] 已从 {filepath} 加载 {len(custom_stopwords)} 个停用词")
        except FileNotFoundError:
            print(f"[WARN] 停用词文件 {filepath} 未找到, 使用默认停用词表")

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """利用正则表达式清洗文本, 只保留中英文字符和数字

        Args:
            raw_text: 原始文本

        Returns:
            清洗后的纯文本字符串
        """
        if not raw_text:
            return ""
        # 正则匹配: 保留中文字符(一-龥)、英文字母(a-zA-Z)、数字(0-9)
        pattern = re.compile(r'[^一-龥a-zA-Z0-9]')
        return pattern.sub('', raw_text)

    def segment_and_filter(self, text: str) -> List[str]:
        """Jieba中文分词 + 停用词过滤

        使用 Set 实现 O(1) 复杂度的停用词判重, 相比 List 的 O(n) 大幅提升效率

        Args:
            text: 待分词的文本

        Returns:
            过滤后的分词列表 (List[str])
        """
        if not text:
            return []

        # jieba精确模式分词
        tokens = jieba.lcut(text)

        # 数据结构: List — 存储有效分词结果
        # 过滤条件: (1) 不在停用词Set中 (2) 长度大于1
        filtered_tokens: List[str] = [
            token for token in tokens
            if token not in self.stopwords and len(token) > 1
        ]
        return filtered_tokens

    def set_model(self, model) -> None:
        """注入训练好的 ML 情感分类模型（优先于词典方法）

        Args:
            model: PsyQASentimentModel 实例
        """
        self._ml_model = model

    def set_corpus_lexicon(self, corpus_word_freq: Dict[str, float],
                           psy_keywords: Set[str]) -> None:
        """注入 PsyQA 语料库心理词汇表，用于情感分析（备用）"""
        self.corpus_word_freq: Dict[str, float] = corpus_word_freq
        self.psy_keywords: Set[str] = psy_keywords

    def analyze_sentiment(self, text: str) -> float:
        """情感分析（词典为主，ML 模型辅助校准）

        核心策略:
        - 词典方法: 心理词汇匹配 + PsyQA 语料频率加权（对心理场景准确）
        - ML 辅助: 若加载了模型，其输出作为参考信号参与校准

        Args:
            text: 待分析的文本

        Returns:
            情感得分 (0.0=消极 ~ 1.0=积极)
        """
        if not text or len(text.strip()) < 3:
            return 0.5

        # ── 主: 词典方法 ──
        lexicon_score = self._lexicon_sentiment(text)

        # ── 辅: ML 模型信号 ──
        if hasattr(self, '_ml_model') and self._ml_model and self._ml_model.is_trained:
            try:
                ml_score = self._ml_model.predict(text)
                # ML 模型区分 question/answer 格式，不是直接的情感打分
                # 若 ML 与词典方向一致则加强，若不一致则忽略 ML
                if (lexicon_score < 0.45 and ml_score < 0.5) or \
                   (lexicon_score > 0.75 and ml_score > 0.5):
                    # 方向一致: 轻微向 ML 方向调整
                    return round(lexicon_score * 0.85 + ml_score * 0.15, 4)
            except Exception:
                pass

        return lexicon_score

    def _lexicon_sentiment(self, text: str) -> float:
        """基于 PsyQA 语料库 + 心理情感词典的情感分析（兜底方案）"""
        tokens = jieba.lcut(text)
        tokens = [t for t in tokens if len(t) > 1]
        if not tokens:
            return 0.5

        neg_count = sum(1 for t in tokens if t in self.PSYCH_NEGATIVE)
        pos_count = sum(1 for t in tokens if t in self.PSYCH_POSITIVE)

        corpus_signal = 0.0
        matched = 0
        for t in tokens:
            if (hasattr(self, 'corpus_word_freq') and
                    t in self.corpus_word_freq and
                    t not in self.PSYCH_POSITIVE):
                corpus_signal += self.corpus_word_freq[t]
                matched += 1

        if neg_count + pos_count > 0:
            exact = pos_count / (neg_count + pos_count)
            final = exact * 0.7 + (1.0 - min(corpus_signal / max(matched, 1), 1.0)) * 0.3
        elif matched > 0:
            final = 1.0 - (corpus_signal / matched) * 0.8
        else:
            final = 0.55

        return round(max(0.0, min(1.0, final)), 4)

    def extract_keywords(self, text: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """基于 TF-IDF 算法提取核心关键词

        TF-IDF = 词频(TF) × 逆文档频率(IDF)
        - TF: 词在文档中出现次数 / 文档总词数
        - IDF: log(语料库文档总数 / 包含该词的文档数)

        Args:
            text: 待提取关键词的文本
            top_k: 返回关键词数量, 默认10

        Returns:
            数据结构 List[Tuple[str, float]] — (关键词, TF-IDF权重) 列表,
            按权重降序排列
        """
        if not text:
            return []

        # jieba.analyse.extract_tags 内置 TF-IDF 算法
        keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=True)
        # 返回值类型: List[Tuple[str, float]]
        return keywords

    def build_word_frequency(self, tokens: List[str]) -> Dict[str, int]:
        """统计词频

        Args:
            tokens: 分词列表

        Returns:
            数据结构 Dict[str, int] — {词: 出现次数}, 按频次降序排列
        """
        word_counts: Dict[str, int] = {}
        for token in tokens:
            # dict.get(key, default) 实现计数累加
            word_counts[token] = word_counts.get(token, 0) + 1

        # 按频次降序排序后返回
        return dict(sorted(word_counts.items(), key=lambda x: x[1], reverse=True))

    def classify_psychological_topic(self, keywords: List[Tuple[str, float]]) -> Dict[str, float]:
        """基于关键词匹配进行心理主题分类

        将提取的关键词与各心理主题的关键词Set进行匹配,
        计算每个主题的匹配得分(累加匹配关键词的TF-IDF权重)

        Args:
            keywords: TF-IDF关键词列表 List[Tuple[str, float]]

        Returns:
            数据结构 Dict[str, float] — {心理主题: 匹配得分},
            按得分降序排列, 得分为0的主题不返回
        """
        # 提取关键词文本为 Set 用于快速查找
        keyword_texts: Set[str] = {kw[0] for kw in keywords}
        # 构建关键词→权重映射 (Dict)
        keyword_weight: Dict[str, float] = {kw[0]: kw[1] for kw in keywords}

        # 数据结构: Dict[str, float] — 主题得分映射
        topic_scores: Dict[str, float] = {}

        for topic, topic_kw_set in self.topic_keywords.items():
            score = 0.0
            # 计算关键词与主题的匹配度
            for kw in keyword_texts:
                if kw in topic_kw_set:
                    score += keyword_weight.get(kw, 0.0)
            if score > 0:
                topic_scores[topic] = round(score, 4)

        # 按得分降序返回
        return dict(sorted(topic_scores.items(), key=lambda x: x[1], reverse=True))

    def full_analysis(self, raw_text: str) -> Dict:
        """执行完整的文本分析流水线

        整合: 清洗 → 分词过滤 → 情感分析 → 关键词提取 → 词频统计 → 心理主题分类

        Args:
            raw_text: 用户输入的原始心理倾诉文本

        Returns:
            数据结构 Dict — 包含所有分析结果的字典:
            {
                "original_text": str,          # 原始文本
                "cleaned_text": str,           # 清洗后文本
                "char_count": int,             # 原文字符数
                "sentiment_score": float,      # 情感得分 (0.0~1.0)
                "sentiment_label": str,        # 情感标签 (积极/中性/消极)
                "tokens": List[str],           # 分词结果
                "token_count": int,            # 有效分词数
                "keywords": List[Tuple[str, float]],  # 关键词及权重
                "word_frequency": Dict[str, int],     # 词频统计(前20)
                "psychological_topics": Dict[str, float],  # 心理主题分类
            }
        """
        if not raw_text or not raw_text.strip():
            return {"error": "输入文本为空, 请重新输入"}

        # Step 1: 文本清洗
        cleaned_text = self.clean_text(raw_text)

        if not cleaned_text:
            return {"error": "清洗后无有效文本, 请检查输入内容"}

        # Step 2: 情感分析 (PsyQA 语料库 + 心理情感词典)
        sentiment_score = self.analyze_sentiment(raw_text)

        if sentiment_score < 0.45:
            sentiment_label = "消极"
        elif sentiment_score > 0.75:
            sentiment_label = "积极"
        else:
            sentiment_label = "中性"

        # Step 3: 分词 + 停用词过滤 → 返回 List[str]
        tokens: List[str] = self.segment_and_filter(cleaned_text)

        # Step 4: 关键词提取 (基于清洗后全文) → 返回 List[Tuple[str, float]]
        keywords: List[Tuple[str, float]] = self.extract_keywords(cleaned_text, top_k=15)

        # Step 5: 词频统计 → 返回 Dict[str, int] (前20)
        word_freq: Dict[str, int] = self.build_word_frequency(tokens)
        top_word_freq = dict(list(word_freq.items())[:20])

        # Step 6: 心理主题分类 → 返回 Dict[str, float]
        psych_topics = self.classify_psychological_topic(keywords)

        # ─── 汇总分析结果 (Dict) ───────────────────────────────
        result: Dict = {
            "original_text": raw_text.strip(),
            "cleaned_text": cleaned_text,
            "char_count": len(raw_text.strip()),
            "sentiment_score": sentiment_score,
            "sentiment_label": sentiment_label,
            "tokens": tokens,
            "token_count": len(tokens),
            "keywords": keywords,
            "word_frequency": top_word_freq,
            "psychological_topics": psych_topics,
        }
        return result


# ─── 模块独立测试 ─────────────────────────────────────────────────
if __name__ == "__main__":
    engine = PsychAssessmentEngine()

    test_texts = [
        "最近学业压力太大了, 每天失眠到凌晨, 考研复习完全看不进去, 对未来感到迷茫无助",
        "和舍友因为作息问题又吵架了, 感觉被孤立了, 很难过",
        "今天拿到了实习offer, 特别开心! 努力终于有了回报!",
    ]

    for i, text in enumerate(test_texts, 1):
        print(f"\n{'='*60}")
        print(f"测试案例 {i}: {text}")
        print(f"{'='*60}")

        result = engine.full_analysis(text)

        if "error" in result:
            print(f"错误: {result['error']}")
            continue

        print(f"字符数: {result['char_count']}")
        print(f"有效分词数: {result['token_count']}")
        print(f"情感得分: {result['sentiment_score']} ({result['sentiment_label']})")
        print(f"\n关键词 (TF-IDF):")
        for kw, weight in result['keywords'][:10]:
            print(f"  - {kw}: {weight:.4f}")
        print(f"\n心理主题分类:")
        for topic, score in result['psychological_topics'].items():
            print(f"  - {topic}: {score:.4f}")
        print(f"\n高频词统计 (前10):")
        for word, count in list(result['word_frequency'].items())[:10]:
            print(f"  - {word}: {count}次")
