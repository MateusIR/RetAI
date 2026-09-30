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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![close_splashscreen])
        .setup(|app| {
            let mut env_map = std::collections::HashMap::new();

            // Obter o diretório de dados do aplicativo OS-specific (garante permissão de escrita)
            if let Some(app_data_dir) = app.path_resolver().app_data_dir() {
                // Cria a pasta de dados do app caso não exista
                let _ = std::fs::create_dir_all(&app_data_dir);
                
                // Configura os caminhos absolutos para o banco e imagens
                let db_path = app_data_dir.join("diagnosticos_app.db");
                let img_dir = app_data_dir.join("imagens_salvas");
                
                // Injeta no ambiente para o processo filho Python herdar
                if let Some(db_str) = db_path.to_str() {
                    env_map.insert("DB_PATH".into(), db_str.into());
                }
                if let Some(img_str) = img_dir.to_str() {
                    env_map.insert("IMG_DIR".into(), img_str.into());
                }
            }

            // Inicia o sidecar de forma assíncrona/background
            match Command::new_sidecar("retai_backend") {
                Ok(command) => {
                    match command.envs(env_map).spawn() {
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
            }
            _ => {}
        });
}
