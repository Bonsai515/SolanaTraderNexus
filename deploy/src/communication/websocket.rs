use crate::models::WebSocketMessage;
use crate::communication::CommunicationCenter;
use crate::security::SecurityProtocol;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_ws::{Message, MessageStream, Session};
use anyhow::Result;
use futures::StreamExt;
use log::{info, error, warn, debug};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tokio::time::{interval_at, Instant as TokioInstant};
use chrono::Utc;
use serde_json::json;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// WebSocket manager for real-time communication
pub struct WebSocketManager {
    communication_center: Arc<CommunicationCenter>,
    security_protocol: Arc<SecurityProtocol>,
}

impl WebSocketManager {
    /// Create a new WebSocket manager
    pub fn new(
        communication_center: Arc<CommunicationCenter>,
        security_protocol: Arc<SecurityProtocol>,
    ) -> Self {
        Self {
            communication_center,
            security_protocol,
        }
    }
    
    /// Handle new WebSocket connection
    pub async fn handle_connection(
        &self,
        req: HttpRequest,
        body: web::Payload,
    ) -> Result<HttpResponse, Error> {
        let (response, session, mut msg_stream) = actix_ws::handle(&req, body)?;
        
        // Verify connection through security protocol
        match self.security_protocol.verify_websocket_connection(&req) {
            Ok(_) => {
                info!("New WebSocket connection established");
            },
            Err(e) => {
                warn!("WebSocket connection rejected: {}", e);
                return Ok(response);
            }
        };
        
        // Store session
        let session = Arc::new(Mutex::new(session));
        let comm_center = self.communication_center.clone();
        let sec_protocol = self.security_protocol.clone();
        
        // Start client handler
        let ws_session = session.clone();
        tokio::spawn(async move {
            let mut last_heartbeat = Instant::now();
            let mut interval = interval_at(
                TokioInstant::now() + HEARTBEAT_INTERVAL,
                HEARTBEAT_INTERVAL,
            );
            
            // Subscribe to transaction updates
            let mut tx_receiver = comm_center.get_transaction_receiver();
            let mut status_receiver = comm_center.get_status_receiver();
            
            loop {
                tokio::select! {
                    // Handle incoming WebSocket messages
                    Some(Ok(msg)) = msg_stream.next() => {
                        last_heartbeat = Instant::now();
                        
                        if let Err(e) = handle_client_message(
                            msg, &ws_session, &comm_center, &sec_protocol).await {
                            error!("Error handling WebSocket message: {}", e);
                            break;
                        }
                    }
                    
                    // Handle transaction updates
                    Ok(transaction) = tx_receiver.recv() => {
                        let message = WebSocketMessage::Transaction {
                            id: transaction.id.to_string(),
                            timestamp: Utc::now(),
                        };
                        
                        if let Err(e) = send_message(&message, &ws_session).await {
                            error!("Error sending transaction update: {}", e);
                        }
                    }
                    
                    // Handle system status updates
                    Ok(status) = status_receiver.recv() => {
                        let message = WebSocketMessage::Status {
                            components: status,
                        };
                        
                        if let Err(e) = send_message(&message, &ws_session).await {
                            error!("Error sending status update: {}", e);
                        }
                    }
                    
                    // Send periodic heartbeats
                    _ = interval.tick() => {
                        // Check client timeout
                        if Instant::now().duration_since(last_heartbeat) > CLIENT_TIMEOUT {
                            warn!("WebSocket client timed out");
                            break;
                        }
                        
                        // Send ping
                        let session = ws_session.lock().await;
                        if let Err(e) = session.ping(b"").await {
                            error!("Error sending ping: {}", e);
                            break;
                        }
                    }
                }
            }
            
            // Close the session
            let mut session = ws_session.lock().await;
            let _ = session.close(None).await;
            info!("WebSocket connection closed");
        });
        
        Ok(response)
    }
}

/// Handle incoming WebSocket messages
async fn handle_client_message(
    msg: Message,
    session: &Arc<Mutex<Session>>,
    comm_center: &CommunicationCenter,
    sec_protocol: &SecurityProtocol,
) -> Result<()> {
    match msg {
        Message::Text(text) => {
            // Parse the message
            match serde_json::from_str::<WebSocketMessage>(&text) {
                Ok(client_message) => {
                    // Verify message with security protocol
                    sec_protocol.verify_websocket_message(&client_message)?;
                    
                    // Handle different message types
                    match client_message {
                        WebSocketMessage::Ping => {
                            // Respond with pong
                            let pong = WebSocketMessage::Pong {
                                timestamp: Utc::now(),
                            };
                            send_message(&pong, session).await?;
                        },
                        _ => {
                            debug!("Received message: {:?}", client_message);
                        }
                    }
                },
                Err(e) => {
                    warn!("Invalid WebSocket message: {}", e);
                }
            }
        },
        Message::Ping(bytes) => {
            let mut session = session.lock().await;
            session.pong(&bytes).await?;
        },
        Message::Pong(_) => {
            // Client responded to ping
        },
        Message::Close(reason) => {
            let mut session = session.lock().await;
            session.close(reason).await?;
            return Err(anyhow::anyhow!("WebSocket closed by client"));
        },
        Message::Binary(_) => {
            warn!("Binary WebSocket messages are not supported");
        },
        Message::Continuation(_) => {
            // Handle continuation frames if needed
        },
        Message::Nop => {
            // No operation
        },
    }
    
    Ok(())
}

/// Send a WebSocket message
async fn send_message(
    message: &WebSocketMessage,
    session: &Arc<Mutex<Session>>,
) -> Result<()> {
    let json = serde_json::to_string(message)?;
    let mut session = session.lock().await;
    session.text(json).await?;
    Ok(())
}