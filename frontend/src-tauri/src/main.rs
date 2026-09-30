// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::api::process::{Command, CommandChild};
use tauri::{Manager, RunEvent};

// Estrutura para armazenar o processo do backend de forma segura na memória do app
struct BackendState(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Obter o diretório de dados do aplicativo OS-specific (garante permissão de escrita)
            if let Some(app_data_dir) = app.path_resolver().app_data_dir() {
                // Cria a pasta de dados do app caso não exista
                let _ = std::fs::create_dir_all(&app_data_dir);
                
                // Configura os caminhos absolutos para o banco e imagens
                let db_path = app_data_dir.join("diagnosticos_app.db");
                let img_dir = app_data_dir.join("imagens_salvas");
                
                // Injeta no ambiente para o processo filho Python herdar
                if let Some(db_str) = db_path.to_str() {
                    std::env::set_var("DB_PATH", db_str);
                }
                if let Some(img_str) = img_dir.to_str() {
                    std::env::set_var("IMG_DIR", img_str);
                }
            }

            // Inicia o sidecar de forma assíncrona/background
            match Command::new_sidecar("api") {
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
