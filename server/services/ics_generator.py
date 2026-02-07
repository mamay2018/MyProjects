"""ICS Calendar File Generator"""
from datetime import datetime
from typing import Optional
import uuid


def generate_ics(
    summary: str,
    start: datetime,
    end: datetime,
    description: str = "",
    location: str = "",
    organizer_name: Optional[str] = None,
    organizer_email: Optional[str] = None,
    uid: Optional[str] = None
) -> str:
    """Generate an ICS calendar file content"""
    
    if uid is None:
        uid = str(uuid.uuid4())
    
    # Format dates in iCalendar format (UTC)
    def format_datetime(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")
    
    # Escape special characters in text fields
    def escape_text(text: str) -> str:
        return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")
    
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//FollowUp Pro//v2.0//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{format_datetime(datetime.utcnow())}",
        f"DTSTART:{format_datetime(start)}",
        f"DTEND:{format_datetime(end)}",
        f"SUMMARY:{escape_text(summary)}",
    ]
    
    if description:
        lines.append(f"DESCRIPTION:{escape_text(description)}")
    
    if location:
        lines.append(f"LOCATION:{escape_text(location)}")
    
    if organizer_email:
        organizer_line = f"ORGANIZER"
        if organizer_name:
            organizer_line += f";CN={escape_text(organizer_name)}"
        organizer_line += f":mailto:{organizer_email}"
        lines.append(organizer_line)
    
    # Add reminder (15 minutes before)
    lines.extend([
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Reminder",
        "END:VALARM",
    ])
    
    lines.extend([
        "END:VEVENT",
        "END:VCALENDAR"
    ])
    
    return "\r\n".join(lines)


def generate_google_calendar_stub_url(
    summary: str,
    start: datetime,
    end: datetime,
    description: str = "",
    location: str = ""
) -> str:
    """Generate a Google Calendar 'Add Event' URL (stub for future OAuth integration)"""
    from urllib.parse import urlencode
    
    # Format dates for Google Calendar URL
    def format_gc_datetime(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")
    
    params = {
        "action": "TEMPLATE",
        "text": summary,
        "dates": f"{format_gc_datetime(start)}/{format_gc_datetime(end)}",
    }
    
    if description:
        params["details"] = description
    if location:
        params["location"] = location
    
    base_url = "https://calendar.google.com/calendar/render"
    return f"{base_url}?{urlencode(params)}"
