#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Mutex;
use tauri::api::process::{Command, CommandChild};
use tauri::{Manager, RunEvent};

// Estrutura para armazenar o processo do backend de forma segura na memória do app
struct BackendState(Mutex<Option<CommandChild>>);

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

