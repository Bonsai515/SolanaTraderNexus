import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertCircle, Check, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface WalletBalance {
  address: string;
  balance: number;
  label?: string;
  lastUpdated: string;
  changePercent?: number;
  changeDirection?: "up" | "down" | "none";
}

export default function WalletMonitor() {
  const [customWalletAddress, setCustomWalletAddress] = useState("");
  const [customWallets, setCustomWallets] = useState<string[]>([]);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [notifications, setNotifications] = useState<Array<{
    address: string;
    message: string;
    timestamp: string;
    type: "success" | "warning" | "error" | "info";
  }>>([]);
  const { toast } = useToast();

  // Query for system wallets
  const { data: systemWallets, isLoading: systemWalletsLoading, error: systemWalletsError, refetch: refetchSystemWallets } = useQuery({
    queryKey: ["/system/wallet-status"],
    queryFn: () => apiRequest("GET", "/system/wallet-status").then(res => res.json()),
  });

  // Query for custom wallet balances using bulk endpoint
  const { data: customWalletBalances, isLoading: customWalletBalancesLoading, error: customWalletBalancesError, refetch: refetchCustomWallets } = useQuery({
    queryKey: ["/wallet/balances", customWallets],
    enabled: customWallets.length > 0,
    queryFn: async () => {
      if (customWallets.length === 0) return [];
      const addressesParam = customWallets.join(',');
      const response = await apiRequest("GET", `/wallet/balances?addresses=${addressesParam}`);
      return response.json();
    },
  });

  // Mutation for adding custom wallets
  const addWalletMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await apiRequest("GET", `/wallet/validate/${address}`);
      return res.json();
    },
    onSuccess: (data, address) => {
      if (data.valid) {
        if (!customWallets.includes(address)) {
          setCustomWallets(prev => [...prev, address]);
          toast({
            title: "Wallet Added",
            description: "The wallet has been added to your monitoring list.",
            duration: 3000,
          });
          // Clear the input
          setCustomWalletAddress("");
        } else {
          toast({
            title: "Wallet Already Added",
            description: "This wallet is already being monitored.",
            variant: "destructive",
            duration: 3000,
          });
        }
      } else {
        toast({
          title: "Invalid Wallet Address",
          description: data.message || "Please enter a valid Solana wallet address.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
  });

  // Connect to WebSocket for real-time balance updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("Connected to wallet balance WebSocket");
      socket.send(JSON.stringify({ type: "SUBSCRIBE", channels: ["wallet_balances", "system_health"] }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "WALLET_BALANCE_UPDATE") {
        // Add notification
        setNotifications(prev => [
          {
            address: data.address,
            message: `Balance ${data.changeDirection === "up" ? "increased" : "decreased"} by ${Math.abs(data.changePercent).toFixed(2)}%`,
            timestamp: new Date().toISOString(),
            type: data.changeDirection === "up" ? "success" : "warning",
          },
          ...prev.slice(0, 9), // Keep only the 10 most recent notifications
        ]);
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["/system/wallet-status"] });
        if (customWallets.includes(data.address)) {
          queryClient.invalidateQueries({ queryKey: ["/wallet/balances", customWallets] });
        }
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    setWebsocket(socket);

    return () => {
      socket.close();
    };
  }, [customWallets]);

  const handleAddCustomWallet = () => {
    if (customWalletAddress) {
      addWalletMutation.mutate(customWalletAddress);
    }
  };

  const formatSOL = (lamports: number) => {
    return (lamports / 1_000_000_000).toFixed(4);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Wallet Monitor</h1>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              refetchSystemWallets();
              refetchCustomWallets();
            }}
            disabled={systemWalletsLoading || customWalletBalancesLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="system" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="system">System Wallets</TabsTrigger>
          <TabsTrigger value="custom">Custom Wallets</TabsTrigger>
        </TabsList>
        
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemWalletsLoading ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Loading system wallets...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-20 flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            ) : systemWalletsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Failed to load system wallets. Please try again.
                </AlertDescription>
              </Alert>
            ) : systemWallets?.wallets && systemWallets.wallets.length > 0 ? (
              systemWallets.wallets.map((wallet: WalletBalance) => (
                <Card key={wallet.address} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg truncate" title={wallet.label || wallet.address}>
                        {wallet.label || wallet.address.substring(0, 8) + '...'}
                      </CardTitle>
                      {wallet.changePercent !== undefined && (
                        <Badge 
                          variant={wallet.changeDirection === "up" ? "success" : wallet.changeDirection === "down" ? "destructive" : "secondary"}
                          className="ml-2"
                        >
                          {wallet.changeDirection === "up" ? "+" : wallet.changeDirection === "down" ? "-" : ""}
                          {Math.abs(wallet.changePercent).toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="font-mono text-xs truncate" title={wallet.address}>
                      {wallet.address}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatSOL(wallet.balance)} SOL</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last updated: {new Date(wallet.lastUpdated).toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No System Wallets</CardTitle>
                  <CardDescription>No system wallets are currently configured.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Custom Wallet</CardTitle>
              <CardDescription>
                Monitor additional Solana wallets by adding their addresses below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Solana wallet address"
                  value={customWalletAddress}
                  onChange={(e) => setCustomWalletAddress(e.target.value)}
                  className="font-mono"
                />
                <Button 
                  onClick={handleAddCustomWallet}
                  disabled={!customWalletAddress || addWalletMutation.isPending}
                >
                  {addWalletMutation.isPending ? 
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div> : 
                    <Wallet className="h-4 w-4 mr-2" />
                  }
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customWalletBalancesLoading ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Loading custom wallets...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-20 flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            ) : customWalletBalancesError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Failed to load custom wallets. Please try again.
                </AlertDescription>
              </Alert>
            ) : customWalletBalances && customWalletBalances.length > 0 ? (
              customWalletBalances.map((wallet: WalletBalance) => (
                <Card key={wallet.address} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg truncate" title={wallet.address}>
                        {wallet.address.substring(0, 8) + '...'}
                      </CardTitle>
                      {wallet.changePercent !== undefined && (
                        <Badge 
                          variant={wallet.changeDirection === "up" ? "success" : wallet.changeDirection === "down" ? "destructive" : "secondary"}
                          className="ml-2"
                        >
                          {wallet.changeDirection === "up" ? "+" : wallet.changeDirection === "down" ? "-" : ""}
                          {Math.abs(wallet.changePercent).toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="font-mono text-xs truncate" title={wallet.address}>
                      {wallet.address}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatSOL(wallet.balance)} SOL</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last updated: {new Date(wallet.lastUpdated).toLocaleTimeString()}
                    </p>
                  </CardContent>
                  <CardFooter className="bg-muted/50 py-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-center text-xs"
                      onClick={() => {
                        setCustomWallets(prev => prev.filter(addr => addr !== wallet.address));
                      }}
                    >
                      Remove
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : customWallets.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Loading Wallets</CardTitle>
                  <CardDescription>Fetching wallet information...</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Custom Wallets</CardTitle>
                  <CardDescription>Add a wallet address above to start monitoring.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Balance Notifications</CardTitle>
          <CardDescription>
            Real-time notifications of significant wallet balance changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent balance notifications.</p>
            ) : (
              notifications.map((notification, index) => (
                <Alert 
                  key={index} 
                  variant={
                    notification.type === "success" ? "success" : 
                    notification.type === "warning" ? "destructive" : 
                    "default"
                  }
                  className="text-sm"
                >
                  {notification.type === "success" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle className="text-xs font-medium">
                    {new Date(notification.timestamp).toLocaleTimeString()} - {notification.address.substring(0, 8)}...
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {notification.message}
                  </AlertDescription>
                </Alert>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}