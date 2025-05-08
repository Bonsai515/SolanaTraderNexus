interface SystemStatusProps {
  blockchainStatus: 'Online' | 'Offline';
  transactionEngineStatus: 'Active' | 'Inactive';
  aiAgentsStatus: 'Running' | 'Stopped';
}

const SystemStatus: React.FC<SystemStatusProps> = ({
  blockchainStatus,
  transactionEngineStatus,
  aiAgentsStatus,
}) => {
  return (
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
  );
};

export default SystemStatus;
