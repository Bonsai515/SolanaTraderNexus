use yew::prelude::*;
use yew_router::prelude::*;

/// Application routes
#[derive(Clone, Routable, PartialEq)]
pub enum Route {
    #[at("/")]
    Dashboard,
    #[at("/trading")]
    Trading,
    #[at("/strategies")]
    Strategies,
    #[at("/ai-agents")]
    AIAgents,
    #[at("/wallet")]
    Wallet,
    #[at("/analytics")]
    Analytics,
    #[at("/settings")]
    Settings,
    #[not_found]
    #[at("/404")]
    NotFound,
}

/// Route switch function
pub fn switch(routes: Route) -> Html {
    match routes {
        Route::Dashboard => html! { <Dashboard /> },
        Route::Trading => html! { <Trading /> },
        Route::Strategies => html! { <Strategies /> },
        Route::AIAgents => html! { <AIAgents /> },
        Route::Wallet => html! { <Wallet /> },
        Route::Analytics => html! { <Analytics /> },
        Route::Settings => html! { <Settings /> },
        Route::NotFound => html! { <NotFound /> },
    }
}