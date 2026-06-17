"""Generate intervention suggestions based on assessment results."""

import os
import httpx
from app.core.config import settings

TEMPLATES_ZH = {
    # ── 压力相关 ──
    "high_stress": (
        "⚠️ 高压力预警：您的压力水平为 {stress_level}/10，已超过警戒线。\n"
        "1) 强烈建议预约学校心理咨询中心进行专业评估；\n"
        "2) 每天练习10分钟正念冥想或深呼吸（推荐APP：潮汐、小睡眠）；\n"
        "3) 尝试「番茄工作法」：学习25分钟休息5分钟，避免长时间高压；\n"
        "4) 与信任的朋友或家人倾诉，不要独自承受。"
    ),
    "moderate_stress": (
        "⚡ 压力提醒：您的压力水平为 {stress_level}/10，处于中等偏高水平。\n"
        "1) 识别压力来源，列出具体的压力清单并逐项分析；\n"
        "2) 每天留出30分钟做自己喜欢的事情（听音乐、散步等）；\n"
        "3) 学习时间管理技巧，避免任务堆积带来的焦虑。"
    ),

    # ── 睡眠相关 ──
    "low_sleep": (
        "🌙 睡眠不足：您的平均睡眠时长为 {sleep_hours} 小时，低于推荐的7-8小时。\n"
        "1) 设定固定的就寝时间，建立「睡前仪式」（如泡脚、阅读纸质书）；\n"
        "2) 睡前1小时关闭所有电子屏幕，蓝光会抑制褪黑素分泌；\n"
        "3) 下午2点后避免咖啡、茶等含咖啡因饮品；\n"
        "4) 卧室保持凉爽（18-22°C）、安静、遮光。"
    ),
    "very_low_sleep": (
        "🔴 严重睡眠不足：您的平均睡眠时长仅 {sleep_hours} 小时，已严重影响身心健康。\n"
        "1) 请尽快就医，排查是否存在睡眠障碍；\n"
        "2) 短期内避免熬夜赶作业，睡眠比学习效率更重要；\n"
        "3) 如有入睡困难，尝试「4-7-8呼吸法」：吸气4秒、屏息7秒、呼气8秒。"
    ),

    # ── 运动相关 ──
    "inactive": (
        "🏃 缺乏运动：您每周运动量为 {activity_min} 分钟，远低于推荐的150分钟。\n"
        "1) 从每天15分钟快走开始，循序渐进；\n"
        "2) 找一个运动伙伴，互相监督和鼓励；\n"
        "3) 利用课间时间爬楼梯、做拉伸；\n"
        "4) 尝试感兴趣的运动项目（羽毛球、游泳、瑜伽等）。"
    ),
    "moderate_activity": (
        "💪 运动提升：您每周运动 {activity_min} 分钟，已达基本标准但仍有提升空间。\n"
        "1) 试着增加到每周200分钟，效果会更明显；\n"
        "2) 加入不同类型的运动（有氧+力量训练结合）。"
    ),

    # ── 社交媒体相关 ──
    "high_social": (
        "📱 社交媒体过度：您每天使用社交媒体 {social_hours} 小时，与抑郁风险正相关。\n"
        "1) 使用手机「屏幕使用时间」功能设定每日2小时上限；\n"
        "2) 关闭非必要APP的通知推送，减少被动刷屏；\n"
        "3) 用线下活动替代：约朋友散步、参加社团、面对面交流；\n"
        "4) 睡前将手机放在伸手够不到的地方。"
    ),
    "moderate_social": (
        "📲 社交媒体提醒：您每天使用社交媒体 {social_hours} 小时，建议适当控制。\n"
        "1) 定期清理关注列表，减少负面信息摄入；\n"
        "2) 避免睡前浏览社交媒体，影响睡眠质量。"
    ),

    # ── 学习相关 ──
    "overwork": (
        "📚 学习过劳：您每天学习 {study_hours} 小时，长期高强度学习可能导致倦怠。\n"
        "1) 适当减少学习时间，留出休息和娱乐空间；\n"
        "2) 采用「主动学习」策略（做题、讨论）替代低效的被动学习；\n"
        "3) 每学习90分钟至少休息15分钟。"
    ),
    "low_study": (
        "📖 学习投入不足：您每天学习 {study_hours} 小时，可能影响学业表现和自信心。\n"
        "1) 设定小目标（如每天专注学习2小时），逐步建立学习习惯；\n"
        "2) 寻找学习伙伴或加入学习小组，互相激励；\n"
        "3) 如有学习困难，及时向老师或辅导员求助。"
    ),

    # ── 抑郁风险相关 ──
    "depression_risk": (
        "🔴 抑郁风险提示：系统评估您当前存在抑郁风险（概率 {prob}%）。\n"
        "1) 请务必预约学校心理咨询中心进行专业评估；\n"
        "2) 如有自伤或自杀念头，请立即拨打24小时心理援助热线：400-161-9995；\n"
        "3) 告诉身边信任的人你的感受，不要独自面对；\n"
        "4) 记住：寻求帮助是勇敢的表现，你并不孤单。"
    ),

    # ── 综合建议 ──
    "general_good": (
        "✅ 综合评估良好：您的各项指标处于正常范围，请继续保持健康的生活方式。\n"
        "1) 保持规律作息，坚持运动；\n"
        "2) 定期进行自我心理状态评估；\n"
        "3) 遇到困难时及时寻求帮助。"
    ),
    "general_mild": (
        "💡 综合建议：您的整体状况尚可，但部分指标需要关注。\n"
        "1) 保持充足睡眠（7-8小时）和规律运动（每周150分钟）；\n"
        "2) 控制社交媒体使用时间；\n"
        "3) 学习基本的压力管理技巧；\n"
        "4) 如感到持续不适，建议咨询心理老师。"
    ),
}


def generate_suggestion(assessment, behavior: dict) -> str:
    """Generate intervention text using template rules."""
    suggestions = []
    stress = behavior.get("stress_level", 0)
    sleep = behavior.get("sleep_duration", 8)
    activity = behavior.get("physical_activity", 150)
    social = behavior.get("social_media_hours", 0)
    study = behavior.get("study_hours", 5)
    prob = getattr(assessment, "depression_probability", 0) or 0
    predicted = getattr(assessment, "depression_predicted", False)

    # 抑郁风险（优先级最高）
    if predicted or prob >= 0.3:
        suggestions.append(TEMPLATES_ZH["depression_risk"].format(prob=round(prob * 100, 1)))

    # 压力
    if stress >= 8:
        suggestions.append(TEMPLATES_ZH["high_stress"].format(stress_level=stress))
    elif stress >= 6:
        suggestions.append(TEMPLATES_ZH["moderate_stress"].format(stress_level=stress))

    # 睡眠
    if sleep < 4:
        suggestions.append(TEMPLATES_ZH["very_low_sleep"].format(sleep_hours=sleep))
    elif sleep < 6:
        suggestions.append(TEMPLATES_ZH["low_sleep"].format(sleep_hours=sleep))

    # 运动
    if activity < 60:
        suggestions.append(TEMPLATES_ZH["inactive"].format(activity_min=activity))
    elif activity < 120:
        suggestions.append(TEMPLATES_ZH["moderate_activity"].format(activity_min=activity))

    # 社交媒体
    if social > 4:
        suggestions.append(TEMPLATES_ZH["high_social"].format(social_hours=social))
    elif social > 2:
        suggestions.append(TEMPLATES_ZH["moderate_social"].format(social_hours=social))

    # 学习时长
    if study >= 10:
        suggestions.append(TEMPLATES_ZH["overwork"].format(study_hours=study))
    elif study <= 2:
        suggestions.append(TEMPLATES_ZH["low_study"].format(study_hours=study))

    # 无明显问题
    if not suggestions:
        if stress >= 4 or sleep < 7:
            suggestions.append(TEMPLATES_ZH["general_mild"])
        else:
            suggestions.append(TEMPLATES_ZH["general_good"])

    return "\n\n".join(suggestions)


async def generate_suggestion_llm(assessment, behavior: dict) -> str | None:
    """Optional: call LLM API for richer suggestions. Falls back to template."""
    if not settings.LLM_API_KEY:
        return None

    prompt = (
        f"你是一位大学心理咨询师。一位学生的最新评估数据如下：\n"
        f"- 压力水平: {behavior.get('stress_level')}/10\n"
        f"- 睡眠时长: {behavior.get('sleep_duration')}小时/天\n"
        f"- 学习时长: {behavior.get('study_hours')}小时/天\n"
        f"- 社交媒体使用: {behavior.get('social_media_hours')}小时/天\n"
        f"- 运动量: {behavior.get('physical_activity')}分钟/周\n"
        f"- 抑郁概率: {getattr(assessment, 'depression_probability', 'N/A')}\n\n"
        f"请用中文给出3条简短、具体、可操作的心理健康改善建议。每条不超过50字。"
    )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        pass

    return None
