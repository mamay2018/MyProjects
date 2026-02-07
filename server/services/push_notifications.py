"""Push Notification Service - Expo Push Notifications"""
import os
import httpx
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"
EXPO_ACCESS_TOKEN = os.getenv("EXPO_ACCESS_TOKEN")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushNotificationService:
    def __init__(self):
        self.mock_mode = MOCK_MODE
        self.access_token = EXPO_ACCESS_TOKEN
    
    async def send_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[dict] = None,
        badge: Optional[int] = None,
        sound: str = "default"
    ) -> dict:
        """Send push notification to Expo tokens"""
        if not tokens:
            return {
                "success": False,
                "message": "No tokens provided"
            }
        
        if self.mock_mode:
            print(f"[MOCK PUSH] To {len(tokens)} devices: {title} - {body}")
            return {
                "success": True,
                "message": f"Mocked notification sent to {len(tokens)} devices",
                "mock_mode": True,
                "tickets": [{"status": "mocked", "id": f"mock_{t[:20]}"} for t in tokens]
            }
        
        # Build messages
        messages = []
        for token in tokens:
            if not token.startswith("ExponentPushToken"):
                continue
            
            message = {
                "to": token,
                "title": title,
                "body": body,
                "sound": sound,
            }
            
            if data:
                message["data"] = data
            if badge is not None:
                message["badge"] = badge
            
            messages.append(message)
        
        if not messages:
            return {
                "success": False,
                "message": "No valid Expo push tokens"
            }
        
        try:
            headers = {
                "Content-Type": "application/json",
            }
            if self.access_token:
                headers["Authorization"] = f"Bearer {self.access_token}"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers=headers,
                    timeout=30.0
                )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "message": f"Sent to {len(messages)} devices",
                    "mock_mode": False,
                    "tickets": result.get("data", [])
                }
            else:
                return {
                    "success": False,
                    "message": f"Expo API error: {response.status_code}",
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to send notifications: {str(e)}"
            }
    
    async def send_to_user_devices(
        self,
        db,
        user_id,
        title: str,
        body: str,
        data: Optional[dict] = None
    ) -> dict:
        """Helper to send notification to all of a user's devices"""
        from crud import get_user_devices
        
        devices = await get_user_devices(db, user_id)
        if not devices:
            return {
                "success": False,
                "message": "User has no registered devices"
            }
        
        tokens = [d.expo_push_token for d in devices]
        return await self.send_notification(tokens, title, body, data)
