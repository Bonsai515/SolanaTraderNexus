export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Analytics</h1>
      </div>
      
      <div className="bg-card rounded-lg shadow-md p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
        
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-lg">Analytics visualizations coming soon</p>
          <p className="text-sm mt-2">
            Performance metrics, trading history, and strategy insights will be displayed here
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Strategy Performance</h2>
          <div className="text-center py-10 text-muted-foreground">
            <p>Strategy comparison charts</p>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Trading History</h2>
          <div className="text-center py-10 text-muted-foreground">
            <p>Recent transactions and performance</p>
          </div>
        </div>
      </div>
    </div>
  );
}