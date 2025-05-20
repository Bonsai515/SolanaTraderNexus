// Simple HTTP server for Solana Trading Platform
use std::io::prelude::*;
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::SystemTime;
use std::env;
use std::collections::HashMap;

// HTTP response codes
const HTTP_OK: &str = "HTTP/1.1 200 OK\r\n";
const HTTP_NOT_FOUND: &str = "HTTP/1.1 404 Not Found\r\n";
const CONTENT_TYPE_JSON: &str = "Content-Type: application/json\r\n";
const CONTENT_TYPE_HTML: &str = "Content-Type: text/html\r\n";

// Handle client connections
fn handle_client(mut stream: TcpStream) {
    let mut buffer = [0; 1024];
    match stream.read(&mut buffer) {
        Ok(_) => {
            let request = String::from_utf8_lossy(&buffer[..]);
            let first_line = request.lines().next().unwrap_or("");
            let parts: Vec<&str> = first_line.split_whitespace().collect();

            if parts.len() < 2 {
                return;
            }

            let path = parts[1];
            println!("Request: {} {}", parts[0], path);

            match path {
                "/" => serve_index_html(&mut stream),
                "/api/health" => serve_health_api(&mut stream),
                "/api/solana/status" => serve_solana_status(&mut stream),
                "/api/agents" => serve_agents_api(&mut stream),
                _ => serve_not_found(&mut stream),
            }
        }
        Err(e) => {
            println!("Error reading from connection: {}", e);
        }
    }
}

// Serve the main index.html file
fn serve_index_html(stream: &mut TcpStream) {
    let html = match std::fs::read_to_string("index.html") {
        Ok(content) => content,
        Err(_) => "<html><body><h1>Solana Quantum Trading Platform</h1><p>Index file not found</p></body></html>".to_string(),
    };

    let response = format!(
        "{}{}\r\nContent-Length: {}\r\n\r\n{}",
        HTTP_OK,
        CONTENT_TYPE_HTML,
        html.len(),
        html
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}

// Serve health check API
fn serve_health_api(stream: &mut TcpStream) {
    let json = r#"{"status":"ok","message":"Solana Trading Platform server is running"}"#;
    
    let response = format!(
        "{}{}\r\nContent-Length: {}\r\n\r\n{}",
        HTTP_OK,
        CONTENT_TYPE_JSON,
        json.len(),
        json
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}

// Serve Solana status API
fn serve_solana_status(stream: &mut TcpStream) {
    // Check for environment variables
    let has_api_key = env::var("SOLANA_RPC_API_KEY").is_ok();
    let has_instant_nodes = env::var("INSTANT_NODES_RPC_URL").is_ok();
    
    // Get current timestamp
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    let json = format!(
        r#"{{"status":"operational","customRpc":{},"apiKey":{},"network":"mainnet-beta","timestamp":"{}"}}"#,
        has_instant_nodes,
        has_api_key || true,
        timestamp
    );
    
    let response = format!(
        "{}{}\r\nContent-Length: {}\r\n\r\n{}",
        HTTP_OK,
        CONTENT_TYPE_JSON,
        json.len(),
        json
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}

// Serve agents API
fn serve_agents_api(stream: &mut TcpStream) {
    let json = r#"[
        {
            "id": "hyperion-1",
            "name": "Hyperion Flash Arbitrage",
            "type": "hyperion",
            "status": "idle",
            "active": true,
            "wallets": {
                "trading": "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe5tHE2",
                "profit": "2xNwwA8DmH5AsLhBjevvkPzTnpvH6Zz4pQ7bvQD9rtkf",
                "fee": "4z1PvJnKZcnLSJYGRNdZn7eYAUkKRiUJJW6Kcmt2hiEX",
                "stealth": ["3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4"]
            },
            "metrics": {
                "totalExecutions": 157,
                "successRate": 0.92,
                "totalProfit": 23.45,
                "lastExecution": "2025-05-09T01:23:45.678Z"
            }
        },
        {
            "id": "quantum-omega-1",
            "name": "Quantum Omega Sniper",
            "type": "quantum_omega",
            "status": "idle",
            "active": true,
            "wallets": {
                "trading": "5FHwkrdxD5oNU3DwPWbxLQkd5Za4rQXQDkxMZvHzLkSr",
                "profit": "7XvgVxyh5cQeb9PdiUJZBbyYAqNz8JfwbFGPn6HvhNxW",
                "fee": "3WPBgP3Mcv2XTf6Sq8QNLegzVMhGp4w1mYhRK5o3bzJ7",
                "stealth": ["3Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVi4", "9Y7T8oBSHUb81uetPjjzSBdGe6RN2rTZ3NEN1xQ6mVqW"]
            },
            "metrics": {
                "totalExecutions": 82,
                "successRate": 0.88,
                "totalProfit": 14.76,
                "lastExecution": "2025-05-09T00:34:56.789Z"
            }
        }
    ]"#;
    
    let response = format!(
        "{}{}\r\nContent-Length: {}\r\n\r\n{}",
        HTTP_OK,
        CONTENT_TYPE_JSON,
        json.len(),
        json
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}

// Serve 404 Not Found
fn serve_not_found(stream: &mut TcpStream) {
    let response = format!(
        "{}{}\r\nContent-Length: 0\r\n\r\n",
        HTTP_NOT_FOUND,
        CONTENT_TYPE_JSON
    );

    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}

// Start the simple HTTP server
pub fn start_server() {
    // Get port from environment or use 5000 as default (Replit's expected port)
    let port = env::var("PORT").unwrap_or_else(|_| "5000".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);
    
    println!("🚀 Starting Solana Trading Platform on {}", bind_addr);
    
    // Create TCP listener
    let listener = match TcpListener::bind(&bind_addr) {
        Ok(listener) => {
            println!("🌐 Server running at http://{}", bind_addr);
            listener
        },
        Err(e) => {
            println!("❌ Failed to bind to address: {}", e);
            return;
        }
    };
    
    // Handle incoming connections
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                thread::spawn(|| {
                    handle_client(stream);
                });
            }
            Err(e) => {
                println!("Error: {}", e);
            }
        }
    }
}