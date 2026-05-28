#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::api::process::Command;
use tauri::{Manager, RunEvent};

// Cria o comando que será chamado pelo React
#[tauri::command]
fn close_splashscreen(window: tauri::Window) {
    // Fecha a janela "splashscreen"
    if let Some(splashscreen) = window.get_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    // Torna a janela "main" visível
    if let Some(main_window) = window.get_window("main") {
        main_window.show().unwrap();
    }
}

fn main() {
    let (mut _rx, mut _child) = Command::new_sidecar("retai_backend")
        .expect("Falha ao inicializar o backend Python")
        .spawn()
        .expect("Falha ao criar o processo do backend");

    tauri::Builder::default()
        // Registra o comando aqui!
        .invoke_handler(tauri::generate_handler![close_splashscreen])
        .build(tauri::generate_context!())
        .expect("Erro na build da aplicação Tauri")
        .run(move |_app_handle, event| match event {
            RunEvent::Exit => {
                println!("Encerrando a aplicação e matando o sidecar...");
            }
            _ => {}
        });
}