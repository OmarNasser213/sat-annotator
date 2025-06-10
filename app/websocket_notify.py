from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from typing import Dict, List
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger("websocket_notify")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.pending_messages: Dict[str, List[str]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket connected for session {session_id}")
        
        # Send any pending messages for this session
        if session_id in self.pending_messages:
            for message in self.pending_messages[session_id]:
                try:
                    await websocket.send_text(message)
                    logger.info(f"Sent pending message to {session_id}: {message}")
                except Exception as e:
                    logger.error(f"Failed to send pending message: {e}")
            # Clear pending messages after sending
            del self.pending_messages[session_id]

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket disconnected for session {session_id}")

    async def send_message(self, session_id: str, message: str):
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                await websocket.send_text(message)
                logger.info(f"Sent message to {session_id}: {message}")
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                # Remove connection if it's broken
                self.disconnect(session_id)
        else:
            # Store message for when WebSocket connects
            if session_id not in self.pending_messages:
                self.pending_messages[session_id] = []
            self.pending_messages[session_id].append(message)
            logger.info(f"Stored pending message for {session_id}: {message}")

manager = ConnectionManager()

@router.websocket("/ws/notify/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(session_id)
