use yew::prelude::*;
use yew_router::prelude::*;
use crate::frontend::pages::{Route};

/// Sidebar properties
#[derive(Properties, PartialEq)]
pub struct SidebarProps {
    #[prop_or(false)]
    pub visible: bool,
}

/// Navigation item structure
struct NavItem {
    label: &'static str,
    icon: &'static str,
    route: Route,
}

/// Sidebar component
#[function_component(Sidebar)]
pub fn sidebar(props: &SidebarProps) -> Html {
    let sidebar_class = if props.visible {
        "translate-x-0"
    } else {
        "-translate-x-full lg:translate-x-0"
    };

    let nav_items = vec![
        NavItem {
            label: "Dashboard",
            icon: "dashboard",
            route: Route::Dashboard,
        },
        NavItem {
            label: "Trading",
            icon: "sync_alt",
            route: Route::Trading,
        },
        NavItem {
            label: "Strategies",
            icon: "auto_graph",
            route: Route::Strategies,
        },
        NavItem {
            label: "AI Agents",
            icon: "smart_toy",
            route: Route::AIAgents,
        },
        NavItem {
            label: "Wallet",
            icon: "account_balance_wallet",
            route: Route::Wallet,
        },
        NavItem {
            label: "Analytics",
            icon: "insights",
            route: Route::Analytics,
        },
        NavItem {
            label: "Settings",
            icon: "settings",
            route: Route::Settings,
        },
    ];

    html! {
        <div class={format!("fixed top-16 left-0 w-64 h-screen bg-gray-900 border-r border-gray-800 z-20 transition-transform duration-300 ease-in-out {} lg:translate-x-0", sidebar_class)}>
            <nav class="px-4 py-6">
                <div class="space-y-1">
                    {
                        nav_items.into_iter().map(|item| {
                            html! {
                                <Link<Route> to={item.route} classes="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors">
                                    <span class="material-icons mr-3">{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link<Route>>
                            }
                        }).collect::<Html>()
                    }
                </div>
            </nav>
            <div class="absolute bottom-0 left-0 right-0 p-4">
                <div class="bg-gray-800 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <span class="material-icons text-yellow-500 mr-2">{"bolt"}</span>
                        <span class="font-medium">{"Quantum Mode"}</span>
                    </div>
                    <p class="text-sm text-gray-400">{"Enhanced trading with quantum-inspired algorithms"}</p>
                    <label class="relative inline-flex items-center cursor-pointer mt-2">
                        <input type="checkbox" value="" class="sr-only peer" checked=true />
                        <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span class="ml-3 text-sm font-medium text-gray-300">{"Enabled"}</span>
                    </label>
                </div>
            </div>
        </div>
    }
}