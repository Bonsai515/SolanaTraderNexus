import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { useSystemStatus } from "@/hooks/useSystemStatus";

const Sidebar = () => {
  const [location] = useLocation();

  const { 
    blockchainStatus, 
    transactionEngineStatus, 
    aiAgentsStatus 
  } = useSystemStatus();

  const navItems = [
    { path: "/", label: "Dashboard", icon: "dashboard" },
    { path: "/trading", label: "Trading", icon: "candlestick_chart" },
    { path: "/wallet", label: "Wallet", icon: "account_balance_wallet" },
    { path: "/ai-agents", label: "AI Agents", icon: "smart_toy" },
    { path: "/strategies", label: "Strategies", icon: "strategy" },
    { path: "/analytics", label: "Analytics", icon: "insights" },
    { path: "/settings", label: "Settings", icon: "settings" },
  ];

  return (
    <div className="flex flex-col w-64 bg-background-elevated">
      <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center space-x-2">
            <span className="material-icons text-primary">bolt</span>
            <h1 className="text-xl font-bold">SolanaTrader AI</h1>
          </div>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  location === item.path
                    ? "bg-primary bg-opacity-20 text-primary"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span className="material-icons mr-3 h-6 w-6">{item.icon}</span>
                {item.label}
              </a>
            </Link>
          ))}
        </nav>

        {/* System Status */}
        <div className="px-2 mt-6 space-y-1">
          <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            System Status
          </h3>
          <Card className="px-2 py-2 bg-background-card">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className={`h-2 w-2 rounded-full ${blockchainStatus === 'Online' ? 'bg-success' : 'bg-danger'} mr-2 pulse`}></span>
                  <span>Blockchain Connection</span>
                </div>
                <span className={blockchainStatus === 'Online' ? 'text-success' : 'text-danger'}>
                  {blockchainStatus}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className={`h-2 w-2 rounded-full ${transactionEngineStatus === 'Active' ? 'bg-success' : 'bg-danger'} mr-2 pulse`}></span>
                  <span>Transaction Engine</span>
                </div>
                <span className={transactionEngineStatus === 'Active' ? 'text-success' : 'text-danger'}>
                  {transactionEngineStatus}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className={`h-2 w-2 rounded-full ${aiAgentsStatus === 'Running' ? 'bg-success' : 'bg-danger'} mr-2 pulse`}></span>
                  <span>AI Agents</span>
                </div>
                <span className={aiAgentsStatus === 'Running' ? 'text-success' : 'text-danger'}>
                  {aiAgentsStatus}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* User Profile */}
      <div className="flex-shrink-0 flex bg-background-card p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
              <span className="text-sm">JD</span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">User</p>
            <p className="text-xs text-gray-400">Trader</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
