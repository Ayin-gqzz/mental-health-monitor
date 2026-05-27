"""Generate intervention suggestions based on assessment results."""

import os
import httpx
from app.core.config import settings

TEMPLATES_ZH = {
    "high_stress": (
        "您的压力水平为 {stress_level}/10，处于较高水平。建议采取以下措施：\n"
        "1) 预约学校心理咨询中心，与咨询师进行一次面谈；\n"
        "2) 每天进行10分钟的深呼吸或正念冥想练习；\n"
        "3) 将社交媒体使用时间控制在每天2小时以内；\n"
        "4) 保证每天至少7小时的睡眠时间；\n"
        "5) 每周进行至少150分钟的中等强度运动。"
    ),
    "low_sleep": (
        "您的平均睡眠时长为 {sleep_hours} 小时，低于推荐标准。睡眠不足与心理健康水平下降密切相关。建议：\n"
        "1) 建立规律的作息时间，每天固定时间上床和起床；\n"
        "2) 睡前30分钟不使用电子设备；\n"
        "3) 下午4点后避免摄入咖啡因；\n"
        "4) 创造安静、黑暗、凉爽的睡眠环境。"
    ),
    "inactive": (
        "您每周运动量为 {activity_min} 分钟。研究表明每周150分钟以上的中等强度运动"
        "可显著降低抑郁风险。建议从每天15分钟步行开始，逐步增加运动量。"
    ),
    "high_social": (
        "您每天使用社交媒体 {social_hours} 小时。长时间使用社交媒体与抑郁风险增加相关。"
        "建议设定每日2小时的使用上限，用阅读、运动或面对面社交替代屏幕时间。"
    ),
    "general": (
        "根据综合评估，建议您保持平衡的生活作息：保证充足睡眠、规律运动、"
        "控制屏幕时间、保持学习投入。如感到压力过大，请及时联系心理咨询中心。"
    ),
}


def generate_suggestion(assessment, behavior: dict) -> str:
    """Generate intervention text using template rules."""
    suggestions = []

    if behavior.get("stress_level", 0) >= 8:
        suggestions.append(TEMPLATES_ZH["high_stress"].format(
            stress_level=behavior["stress_level"]))
    if behavior.get("sleep_duration", 8) < 6:
        suggestions.append(TEMPLATES_ZH["low_sleep"].format(
            sleep_hours=behavior["sleep_duration"]))
    if behavior.get("physical_activity", 150) < 60:
        suggestions.append(TEMPLATES_ZH["inactive"].format(
            activity_min=behavior["physical_activity"]))
    if behavior.get("social_media_hours", 0) > 4:
        suggestions.append(TEMPLATES_ZH["high_social"].format(
            social_hours=behavior["social_media_hours"]))

    if not suggestions:
        suggestions.append(TEMPLATES_ZH["general"])

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
