from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Notification

router = APIRouter(prefix="/api/notifications", tags=["In-App Notifications"])

@router.get("")
def list_notifications(
    unread_only: bool = Query(default=False),
    role: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve operational alerts and planning notifications."""
    query = db.query(Notification)

    if unread_only:
        query = query.filter(Notification.is_read == False)
    if role and role != "All":
        query = query.filter((Notification.recipient_role == role) | (Notification.recipient_role == None))

    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    unread_count = db.query(Notification).filter(Notification.is_read == False).count()

    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "notification_type": n.notification_type,
                "is_read": n.is_read,
                "link_url": n.link_url,
                "recipient_role": n.recipient_role,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in notifications
        ]
    }


@router.put("/{notif_id}/read")
def mark_notification_as_read(notif_id: str, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    return {"status": "success", "id": notif_id, "is_read": True}


@router.put("/read-all")
def mark_all_as_read(db: Session = Depends(get_db)):
    """Mark all notifications as read in the database."""
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "success", "message": "All notifications marked as read."}


@router.delete("/{notif_id}")
def delete_notification(notif_id: str, db: Session = Depends(get_db)):
    """Delete a notification."""
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    db.delete(notif)
    db.commit()
    return {"status": "success", "message": "Notification dismissed."}
