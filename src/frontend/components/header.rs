use yew::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;

/// Header properties
#[derive(Properties, PartialEq)]
pub struct HeaderProps {
    pub toggle_sidebar: Callback<()>,
}

/// Header component
#[function_component(Header)]
pub fn header(props: &HeaderProps) -> Html {
    let handle_toggle_sidebar = {
        let toggle_callback = props.toggle_sidebar.clone();
        Callback::from(move |_| {
            toggle_callback.emit(());
        })
    };

    html! {
        <header class="fixed top-0 left-0 w-full h-16 bg-gray-900 border-b border-gray-800 z-30 flex items-center justify-between px-4">
            <div class="flex items-center">
                <button
                    class="lg:hidden mr-2 p-2 rounded-full hover:bg-gray-800"
                    onclick={handle_toggle_sidebar}
                >
                    <span class="material-icons">{"menu"}</span>
                </button>
                <div class="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-transparent bg-clip-text">
                    {"Solana Quantum Trading"}
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <div class="hidden md:flex items-center">
                    <div class="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span class="text-gray-400 text-sm">{"Connected to Solana"}</span>
                </div>
                <button class="p-2 rounded-full hover:bg-gray-800">
                    <span class="material-icons">{"notifications"}</span>
                </button>
                <button class="p-2 rounded-full hover:bg-gray-800">
                    <span class="material-icons">{"account_circle"}</span>
                </button>
            </div>
        </header>
    }
}