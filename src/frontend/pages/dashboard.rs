use yew::prelude::*;
use gloo::net::http::Request;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlElement, HtmlInputElement};
use serde::{Deserialize, Serialize};
use crate::models::{SystemStatus, FormattedTransaction, ComponentStatus};

/// Dashboard properties
#[derive(Properties, PartialEq)]
pub struct DashboardProps {
    #[prop_or_default]
    pub is_loading: bool,
}

/// System status response from API
#[derive(Clone, Debug, Serialize, Deserialize)]
struct SystemStatusResponse {
    blockchain: bool,
    transaction_engine: bool,
    ai_agents: bool,
    last_updated: String,
}

/// Recent transactions response from API
#[derive(Clone, Debug, Serialize, Deserialize)]
struct RecentTransactionsResponse {
    transactions: Vec<FormattedTransaction>,
}

/// Dashboard component
#[function_component(Dashboard)]
pub fn dashboard(props: &DashboardProps) -> Html {
    let status = use_state(|| SystemStatusResponse {
        blockchain: false,
        transaction_engine: false,
        ai_agents: false,
        last_updated: "".to_string(),
    });
    
    let transactions = use_state(Vec::<FormattedTransaction>::new);
    let loading = use_state(|| props.is_loading);
    
    // Fetch data on component mount
    {
        let status = status.clone();
        let transactions = transactions.clone();
        let loading = loading.clone();
        
        use_effect_with_deps(move |_| {
            loading.set(true);
            
            // Fetch system status
            {
                let status = status.clone();
                let loading = loading.clone();
                
                spawn_local(async move {
                    match Request::get("/api/system/status")
                        .send()
                        .await {
                            Ok(response) => {
                                if response.ok() {
                                    match response.json::<SystemStatusResponse>().await {
                                        Ok(data) => {
                                            status.set(data);
                                        },
                                        Err(e) => {
                                            log::error!("Error parsing status: {:?}", e);
                                        }
                                    }
                                }
                            },
                            Err(e) => {
                                log::error!("Error fetching status: {:?}", e);
                            }
                        }
                    
                    loading.set(false);
                });
            }
            
            // Fetch recent transactions
            {
                let transactions = transactions.clone();
                
                spawn_local(async move {
                    match Request::get("/api/transactions/recent")
                        .send()
                        .await {
                            Ok(response) => {
                                if response.ok() {
                                    match response.json::<RecentTransactionsResponse>().await {
                                        Ok(data) => {
                                            transactions.set(data.transactions);
                                        },
                                        Err(e) => {
                                            log::error!("Error parsing transactions: {:?}", e);
                                        }
                                    }
                                }
                            },
                            Err(e) => {
                                log::error!("Error fetching transactions: {:?}", e);
                            }
                        }
                });
            }
            
            // Cleanup
            || {}
        }, ());
    }
    
    html! {
        <div class="container mx-auto px-4 py-8">
            <h1 class="text-3xl font-bold mb-6">{"Dashboard"}</h1>
            
            // System Status Section
            <div class="bg-gray-800 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">{"System Status"}</h2>
                
                if *loading {
                    <div class="animate-pulse flex space-x-4">
                        <div class="flex-1 space-y-4 py-1">
                            <div class="h-4 bg-gray-700 rounded w-3/4"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-700 rounded"></div>
                                <div class="h-4 bg-gray-700 rounded w-5/6"></div>
                            </div>
                        </div>
                    </div>
                } else {
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="flex items-center">
                            <div class={format!("w-3 h-3 rounded-full mr-2 {}", if status.blockchain { "bg-green-500" } else { "bg-red-500" })}></div>
                            <span>{"Blockchain"}</span>
                            <span class="ml-2 text-gray-400">{if status.blockchain { "Online" } else { "Offline" }}</span>
                        </div>
                        <div class="flex items-center">
                            <div class={format!("w-3 h-3 rounded-full mr-2 {}", if status.transaction_engine { "bg-green-500" } else { "bg-red-500" })}></div>
                            <span>{"Transaction Engine"}</span>
                            <span class="ml-2 text-gray-400">{if status.transaction_engine { "Active" } else { "Inactive" }}</span>
                        </div>
                        <div class="flex items-center">
                            <div class={format!("w-3 h-3 rounded-full mr-2 {}", if status.ai_agents { "bg-green-500" } else { "bg-red-500" })}></div>
                            <span>{"AI Agents"}</span>
                            <span class="ml-2 text-gray-400">{if status.ai_agents { "Running" } else { "Stopped" }}</span>
                        </div>
                    </div>
                }
            </div>
            
            // Recent Transactions Section
            <div class="bg-gray-800 rounded-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold">{"Recent Transactions"}</h2>
                    <a href="/trading" class="text-blue-500 hover:text-blue-400 text-sm">{"View All"}</a>
                </div>
                
                if transactions.is_empty() && !*loading {
                    <div class="text-center py-8">
                        <p class="text-gray-400">{"No transactions found"}</p>
                    </div>
                } else if *loading {
                    <div class="animate-pulse space-y-4">
                        { for (0..3).map(|_| html! {
                            <div class="h-12 bg-gray-700 rounded"></div>
                        })}
                    </div>
                } else {
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    <th class="px-6 py-3">{"Strategy"}</th>
                                    <th class="px-6 py-3">{"Type"}</th>
                                    <th class="px-6 py-3">{"Amount"}</th>
                                    <th class="px-6 py-3">{"Status"}</th>
                                    <th class="px-6 py-3">{"Profit"}</th>
                                    <th class="px-6 py-3">{"Time"}</th>
                                </tr>
                            </thead>
                            <tbody>
                                { for transactions.iter().map(|tx| self.render_transaction_row(tx)) }
                            </tbody>
                        </table>
                    </div>
                }
            </div>
        </div>
    }
}

impl Dashboard {
    /// Render a transaction row
    fn render_transaction_row(&self, transaction: &FormattedTransaction) -> Html {
        let status_color = match transaction.status {
            TransactionStatus::Completed => "text-green-500",
            TransactionStatus::Processing => "text-yellow-500",
            TransactionStatus::Failed => "text-red-500",
            _ => "text-gray-400",
        };
        
        let timestamp = chrono::DateTime::parse_from_rfc3339(&transaction.timestamp)
            .map(|dt| dt.format("%H:%M:%S %d/%m").to_string())
            .unwrap_or_else(|_| "Invalid date".to_string());
        
        html! {
            <tr class="border-t border-gray-700">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <span class={format!("material-icons text-{}", transaction.strategy.color)}>
                            {&transaction.strategy.icon}
                        </span>
                        <span class="ml-2">{&transaction.strategy.name}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    {format!("{:?}", transaction.transaction_type)}
                </td>
                <td class="px-6 py-4">
                    {&transaction.amount}
                </td>
                <td class="px-6 py-4">
                    <span class={status_color}>
                        {format!("{:?}", transaction.status)}
                    </span>
                </td>
                <td class="px-6 py-4">
                    {transaction.profit.as_ref().map_or("—".to_string(), |p| p.to_string())}
                </td>
                <td class="px-6 py-4 text-gray-400">
                    {timestamp}
                </td>
            </tr>
        }
    }
}