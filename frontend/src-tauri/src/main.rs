#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Mutex;
use tauri::api::process::{Command, CommandChild};
use tauri::{Manager, RunEvent};

// Estrutura para armazenar o processo do backend de forma segura na memória do app
struct BackendState(Mutex<Option<CommandChild>>);

/// Verifica se o backend está respondendo em http://127.0.0.1:8000/health
/// usando um request HTTP raw via TcpStream (sem dependências extras).
fn check_backend_health() -> bool {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    let stream = TcpStream::connect_timeout(
        &"127.0.0.1:8000".parse().unwrap(),
        Duration::from_secs(2),
    );

    match stream {
        Ok(mut s) => {
            s.set_read_timeout(Some(Duration::from_secs(2))).ok();
            s.set_write_timeout(Some(Duration::from_secs(2))).ok();

            let request = "GET /health HTTP/1.1\r\nHost: 127.0.0.1:8000\r\nConnection: close\r\n\r\n";
            if s.write_all(request.as_bytes()).is_err() {
                return false;
            }

            let mut buf = [0u8; 512];
            match s.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let response = String::from_utf8_lossy(&buf[..n]);
                    response.contains("200 OK")
                }
                _ => false,
            }
        }
        Err(_) => false,
    }
}

#[tauri::command]
fn close_splashscreen(window: tauri::Window) {
    if let Some(splashscreen) = window.get_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    if let Some(main_window) = window.get_window("main") {
        main_window.show().unwrap();
    }
}

#[tauri::command]
fn restart_backend(app_handle: tauri::AppHandle) -> Result<(), String> {
    println!("Reiniciando o backend a pedido do frontend...");
    
    let state = app_handle.state::<BackendState>();
    
    // 1. Matar processo atual
    if let Ok(mut lock) = state.inner().0.lock() {
        if let Some(child) = lock.take() {
            let _ = child.kill();
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("taskkill")
            .args(["/F", "/T", "/IM", "retai_backend*"])
            .spawn()
            .ok();
    }
    
    // Pausa para dar tempo ao S.O. de liberar as portas
    std::thread::sleep(std::time::Duration::from_millis(1500));
    
    // 2. Iniciar o sidecar novamente (sem injetar env vars de caminho)
    match Command::new_sidecar("retai_backend") {
        Ok(command) => {
            match command.spawn() {
                Ok((_rx, child)) => {
                    if let Ok(mut lock) = state.inner().0.lock() {
                        *lock = Some(child);
                    }
                    Ok(())
                }
                Err(e) => Err(format!("Falha: {}", e)),
            }
        }
        Err(e) => Err(format!("Erro: {}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![close_splashscreen, restart_backend])
        .setup(|app| {
            // O backend Python gerencia seus próprios caminhos via ~/.retai_data/
            // NÃO injetamos DB_PATH/IMG_DIR para evitar conflito de caminhos.

            // Inicia o sidecar de forma assíncrona/background
            match Command::new_sidecar("retai_backend") {
                Ok(command) => {
                    match command.spawn() {
                        Ok((_rx, child)) => {
                            // Salva a referência do processo filho no estado do app
                            app.manage(BackendState(Mutex::new(Some(child))));
                        }
                        Err(e) => eprintln!("Erro ao spawnar sidecar: {}", e),
                    }
                }
                Err(e) => eprintln!("Erro ao criar comando sidecar: {}", e),
            }

            // Set larger default window size on macOS
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_window("main") {
                let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 1024.0,
                    height: 768.0,
                }));
            }

            // ── Health check do backend no lado Rust ─────────────────────────
            // No macOS, o WKWebView não executa JavaScript em janelas ocultas
            // (visible: false), então o health check do App.tsx nunca roda.
            // Movemos essa lógica para cá: uma thread que faz polling no
            // backend e, quando pronto, fecha o splash e mostra a janela main.
            let app_handle = app.handle();
            std::thread::spawn(move || {
                loop {
                    if check_backend_health() {
                        // Backend pronto! Fechar splash e mostrar janela principal.
                        if let Some(splashscreen) = app_handle.get_window("splashscreen") {
                            let _ = splashscreen.close();
                        }
                        if let Some(main_window) = app_handle.get_window("main") {
                            let _ = main_window.show();
                        }
                        println!("Backend pronto — splash fechado, janela principal visível.");
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            // Quando for solicitado fechar o app, matar o processo
            RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                let state = app_handle.state::<BackendState>();
                if let Ok(mut lock) = state.inner().0.lock() {
                    if let Some(child) = lock.take() {
                        let _ = child.kill();
                    }
                }
                
                #[cfg(target_os = "windows")]
                {
                    // O asterisco (*) garante que vai pegar a casca e o subprocesso
                    std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/IM", "retai_backend*"])
                        .spawn()
                        .ok();
                }
            }
            _ => {}
        });
}


