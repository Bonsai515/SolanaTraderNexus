import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Settings = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">Settings</h2>
      
      <Tabs defaultValue="general" className="mb-8">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="ai">AI & Transformer</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Appearance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="darkMode">Dark Mode</Label>
                    <p className="text-sm text-gray-400">Use dark theme</p>
                  </div>
                  <Switch id="darkMode" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="animations">Animations</Label>
                    <p className="text-sm text-gray-400">Enable UI animations</p>
                  </div>
                  <Switch id="animations" defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="tradeNotifications">Trade Notifications</Label>
                    <p className="text-sm text-gray-400">Notify on trade execution</p>
                  </div>
                  <Switch id="tradeNotifications" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="alertNotifications">Alert Notifications</Label>
                    <p className="text-sm text-gray-400">Notify on system alerts</p>
                  </div>
                  <Switch id="alertNotifications" defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Authentication</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="password">Change Password</Label>
                  <Input id="password" type="password" className="mt-1 bg-background-elevated" placeholder="New password" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="twoFactor">Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-400">Add an extra layer of security</p>
                  </div>
                  <Switch id="twoFactor" />
                </div>
                
                <Button className="w-full">Update Security Settings</Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Transaction Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="transactionConfirmation">Transaction Confirmation</Label>
                    <p className="text-sm text-gray-400">Require confirmation for all transactions</p>
                  </div>
                  <Switch id="transactionConfirmation" defaultChecked />
                </div>
                
                <div>
                  <Label htmlFor="transactionLimit">Transaction Limit (SOL)</Label>
                  <Input id="transactionLimit" type="number" className="mt-1 bg-background-elevated" defaultValue="10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="ai" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">AI Agent Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoTrade">Automated Trading</Label>
                    <p className="text-sm text-gray-400">Allow AI to execute trades automatically</p>
                  </div>
                  <Switch id="autoTrade" defaultChecked />
                </div>
                
                <div>
                  <Label htmlFor="riskLevel">Risk Level</Label>
                  <div className="flex space-x-2 mt-1">
                    <Button variant="outline" className="flex-1 bg-background-elevated">Low</Button>
                    <Button variant="outline" className="flex-1 bg-primary">Medium</Button>
                    <Button variant="outline" className="flex-1 bg-background-elevated">High</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Transformer Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="quantumMode">Quantum-Inspired Processing</Label>
                    <p className="text-sm text-gray-400">Enable advanced processing algorithms</p>
                  </div>
                  <Switch id="quantumMode" defaultChecked />
                </div>
                
                <div>
                  <Label htmlFor="updateFrequency">Data Update Frequency</Label>
                  <div className="flex space-x-2 mt-1">
                    <Button variant="outline" className="flex-1 bg-background-elevated">5s</Button>
                    <Button variant="outline" className="flex-1 bg-primary">10s</Button>
                    <Button variant="outline" className="flex-1 bg-background-elevated">30s</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="api" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">API Configuration</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="solanaApiKey">Solana API Key</Label>
                  <Input id="solanaApiKey" className="mt-1 bg-background-elevated" placeholder="Enter your Solana API key" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="apiEnabled">Enable API Access</Label>
                    <p className="text-sm text-gray-400">Allow external API connections</p>
                  </div>
                  <Switch id="apiEnabled" defaultChecked />
                </div>
                
                <Button className="w-full">Save API Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
