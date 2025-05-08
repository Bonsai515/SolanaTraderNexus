use yew::prelude::*;
use crate::frontend::components::header::Header;
use crate::frontend::components::sidebar::Sidebar;

/// Layout properties
#[derive(Properties, PartialEq)]
pub struct LayoutProps {
    pub children: Children,
}

/// Main application layout
#[function_component(Layout)]
pub fn layout(props: &LayoutProps) -> Html {
    let sidebar_visible = use_state(|| false);
    
    let toggle_sidebar = {
        let sidebar_visible = sidebar_visible.clone();
        Callback::from(move |_| {
            sidebar_visible.set(!*sidebar_visible);
        })
    };
    
    let overlay_class = if *sidebar_visible {
        "lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
    } else {
        "hidden"
    };
    
    let handle_overlay_click = {
        let sidebar_visible = sidebar_visible.clone();
        Callback::from(move |_| {
            sidebar_visible.set(false);
        })
    };

    html! {
        <div class="min-h-screen bg-gray-950 text-white">
            <Header toggle_sidebar={toggle_sidebar} />
            <Sidebar visible={*sidebar_visible} />
            
            // Overlay for mobile sidebar
            <div class={overlay_class} onclick={handle_overlay_click}></div>
            
            <main class="pt-16 lg:pl-64 min-h-screen">
                { for props.children.iter() }
            </main>
        </div>
    }
}