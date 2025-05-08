import { useLocation } from "wouter";

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const [location] = useLocation();

  // Get the current page title based on the path
  const getPageTitle = () => {
    switch (location) {
      case "/":
        return "Dashboard";
      case "/trading":
        return "Trading";
      case "/wallet":
        return "Wallet";
      case "/ai-agents":
        return "AI Agents";
      case "/strategies":
        return "Strategies";
      case "/analytics":
        return "Analytics";
      case "/settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  return (
    <div className="bg-background-elevated border-b border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center">
            <button
              type="button"
              className="md:hidden px-4 text-gray-400 focus:outline-none"
              onClick={toggleSidebar}
            >
              <span className="material-icons">menu</span>
            </button>
            <h1 className="text-xl font-semibold text-white">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button className="flex items-center text-gray-300 hover:text-white">
                <span className="material-icons">notifications</span>
                <span className="absolute top-0 right-0 h-2 w-2 bg-danger rounded-full"></span>
              </button>
            </div>
            <div>
              <button className="flex items-center text-gray-300 hover:text-white">
                <span className="material-icons">help_outline</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
