import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

async def rewrite_message(message: str, tone: str = "Friendly", length: Optional[str] = None) -> str:
    """
    Rewrite a follow-up message using AI with specified tone and length.
    Tones: Friendly, Professional, Urgent
    Length: Shorter, Longer, or None (keep similar)
    """
    if not EMERGENT_LLM_KEY:
        # Return original if no key configured
        return message
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Build the system message based on parameters
        length_instruction = ""
        if length == "Shorter":
            length_instruction = "Make the message more concise and to the point."
        elif length == "Longer":
            length_instruction = "Expand the message with more detail while keeping it natural."
        
        tone_descriptions = {
            "Friendly": "warm, personable, and approachable. Use casual language that builds rapport.",
            "Professional": "formal, business-like, and polished. Maintain a respectful and competent tone.",
            "Urgent": "convey a sense of urgency and scarcity. Emphasize time-sensitivity without being pushy."
        }
        
        tone_desc = tone_descriptions.get(tone, tone_descriptions["Friendly"])
        
        system_message = f"""You are a professional copywriter specializing in business follow-up messages.
Your task is to rewrite follow-up messages for service professionals.
Make the message {tone_desc}
{length_instruction}

Rules:
- Keep the message appropriate for business communication
- Preserve any specific details (names, amounts, dates)
- Do not generate anything inappropriate or harassing
- Return ONLY the rewritten message, no explanations
"""
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"rewrite_{hash(message)}",
            system_message=system_message
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"Rewrite this follow-up message:\n\n{message}"
        )
        
        response = await chat.send_message(user_message)
        return response.strip()
        
    except Exception as e:
        print(f"AI rewrite error: {e}")
        return message
