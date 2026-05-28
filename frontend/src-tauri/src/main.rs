#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::api::process::Command;
use tauri::Manager;

#[tauri::command]
fn close_splashscreen(window: tauri::Window) {
    if let Some(splashscreen) = window.get_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    if let Some(main_window) = window.get_window("main") {
        main_window.show().unwrap();
    }
}

fn main() {
    // Inicia o backend silenciosamente
    let (_rx, _child) = Command::new_sidecar("retai_backend")
        .expect("Falha ao inicializar o backend Python")
        .spawn()
        .expect("Falha ao criar o processo do backend");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![close_splashscreen])
        // Intercepta o exato momento em que o usuário clica no "X" da janela
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::Destroyed => {
                // Se a janela que foi fechada for a principal (main)
                if event.window().label() == "main" {
                    println!("Janela principal fechada! Exterminando processos do backend...");
                    
                    #[cfg(target_os = "windows")]
                    {
                        // O asterisco (*) garante que vai pegar a casca e o subprocesso
                        std::process::Command::new("taskkill")
                            .args(["/F", "/T", "/IM", "retai_backend*"])
                            .spawn()
                            .ok();
                    }
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("Erro na build da aplicação Tauri")
        .run(|_app_handle, _event| {
            // O gerenciamento de saída agora é feito pelo on_window_event acima
        });
}