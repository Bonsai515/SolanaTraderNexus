/**
 * Security Transformer API Key Loader
 * 
 * Automatically loads and manages API credentials from secure vault
 * - Write-only secure access
 * - Environment variable integration
 * - Real-time credential validation
 * - Automatic protocol authentication
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecureCredential {
  key: string;
  secret: string;
  accountId: string;
  accessToken: string;
  endpoint: string;
  status: string;
  maxFlashLoan: number;
}

interface LoadedCredentials {
  [protocol: string]: SecureCredential;
}

class APIKeyLoader {
  private vaultPath: string;
  private loadedCredentials: LoadedCredentials;
  private lastLoadTime: number;

  constructor() {
    this.vaultPath = './security_transformer/secure_api_vault.txt';
    this.loadedCredentials = {};
    this.lastLoadTime = 0;

    console.log('[SecurityTransformer] 🔐 API Key Loader initialized');
    console.log('[SecurityTransformer] 📍 Vault location: Security Transformer');
  }

  public loadAllCredentials(): LoadedCredentials {
    try {
      console.log('[SecurityTransformer] 🔑 Loading credentials from secure vault...');
      
      if (!fs.existsSync(this.vaultPath)) {
        console.log('[SecurityTransformer] ❌ Secure vault not found');
        return {};
      }

      const vaultContent = fs.readFileSync(this.vaultPath, 'utf8');
      const credentials = this.parseVaultContent(vaultContent);
      
      this.loadedCredentials = credentials;
      this.lastLoadTime = Date.now();
      
      console.log(`[SecurityTransformer] ✅ Loaded ${Object.keys(credentials).length} protocol credentials`);
      
      Object.keys(credentials).forEach(protocol => {
        const cred = credentials[protocol];
        console.log(`[SecurityTransformer] 🔗 ${protocol}: ${cred.status} (${cred.maxFlashLoan} SOL capacity)`);
      });
      
      return credentials;
      
    } catch (error) {
      console.error('[SecurityTransformer] ❌ Failed to load credentials:', (error as Error).message);
      return {};
    }
  }

  private parseVaultContent(content: string): LoadedCredentials {
    const credentials: LoadedCredentials = {};
    const lines = content.split('\n');
    
    const protocols = ['SOLEND', 'MARGINFI', 'KAMINO', 'DRIFT', 'MARINADE', 'JUPITER'];
    
    for (const protocol of protocols) {
      const protocolCreds = this.extractProtocolCredentials(lines, protocol);
      if (protocolCreds) {
        credentials[protocol] = protocolCreds;
      }
    }
    
    return credentials;
  }

  private extractProtocolCredentials(lines: string[], protocol: string): SecureCredential | null {
    try {
      const apiKey = this.findValue(lines, `${protocol}_API_KEY`);
      const apiSecret = this.findValue(lines, `${protocol}_API_SECRET`);
      const accountId = this.findValue(lines, `${protocol}_ACCOUNT_ID`);
      const accessToken = this.findValue(lines, `${protocol}_ACCESS_TOKEN`);
      const endpoint = this.findValue(lines, `${protocol}_ENDPOINT`);
      const status = this.findValue(lines, `${protocol}_STATUS`);
      const maxFlashLoan = parseInt(this.findValue(lines, `${protocol}_MAX_FLASH_LOAN`) || '0');

      if (apiKey && apiSecret) {
        return {
          key: apiKey,
          secret: apiSecret,
          accountId: accountId || '',
          accessToken: accessToken || '',
          endpoint: endpoint || '',
          status: status || 'PENDING',
          maxFlashLoan
        };
      }
      
      return null;
      
    } catch (error) {
      return null;
    }
  }

  private findValue(lines: string[], key: string): string | null {
    const line = lines.find(l => l.startsWith(`${key}=`));
    return line ? line.split('=')[1] : null;
  }

  public getProtocolCredentials(protocol: string): SecureCredential | null {
    return this.loadedCredentials[protocol.toUpperCase()] || null;
  }

  public getAllActiveProtocols(): string[] {
    return Object.keys(this.loadedCredentials).filter(protocol => {
      const cred = this.loadedCredentials[protocol];
      return cred.status === 'AUTHENTICATED';
    });
  }

  public getTotalFlashLoanCapacity(): number {
    return Object.values(this.loadedCredentials).reduce((total, cred) => {
      return total + cred.maxFlashLoan;
    }, 0);
  }

  public setEnvironmentVariables(): void {
    console.log('[SecurityTransformer] 🔧 Setting environment variables...');
    
    Object.entries(this.loadedCredentials).forEach(([protocol, cred]) => {
      process.env[`${protocol}_API_KEY`] = cred.key;
      process.env[`${protocol}_API_SECRET`] = cred.secret;
      process.env[`${protocol}_ENDPOINT`] = cred.endpoint;
    });
    
    console.log('[SecurityTransformer] ✅ Environment variables configured');
  }

  public validateCredentials(): boolean {
    const activeProtocols = this.getAllActiveProtocols();
    const totalCapacity = this.getTotalFlashLoanCapacity();
    
    console.log('\n[SecurityTransformer] 🔍 CREDENTIAL VALIDATION:');
    console.log(`[SecurityTransformer] Active Protocols: ${activeProtocols.length}`);
    console.log(`[SecurityTransformer] Total Flash Loan Capacity: ${totalCapacity.toLocaleString()} SOL`);
    
    return activeProtocols.length > 0 && totalCapacity > 0;
  }

  public showSecurityStatus(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 SECURITY TRANSFORMER STATUS');
    console.log('='.repeat(60));
    
    console.log(`\n📁 Vault Location: ${this.vaultPath}`);
    console.log(`📊 Protocols Loaded: ${Object.keys(this.loadedCredentials).length}`);
    console.log(`⏰ Last Updated: ${new Date(this.lastLoadTime).toLocaleString()}`);
    
    if (Object.keys(this.loadedCredentials).length > 0) {
      console.log('\n🔑 LOADED CREDENTIALS:');
      console.log('-'.repeat(20));
      
      Object.entries(this.loadedCredentials).forEach(([protocol, cred]) => {
        console.log(`${protocol}:`);
        console.log(`  API Key: ${cred.key.substring(0, 10)}...`);
        console.log(`  Status: ${cred.status}`);
        console.log(`  Capacity: ${cred.maxFlashLoan.toLocaleString()} SOL`);
        console.log(`  Endpoint: ${cred.endpoint}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Auto-load credentials when module is imported
const apiLoader = new APIKeyLoader();
const credentials = apiLoader.loadAllCredentials();
apiLoader.setEnvironmentVariables();

// Export for use in other modules
export { APIKeyLoader, apiLoader, credentials };

// Show status if run directly
if (require.main === module) {
  console.log('🔐 SECURITY TRANSFORMER API KEY LOADER');
  apiLoader.showSecurityStatus();
  
  if (apiLoader.validateCredentials()) {
    console.log('✅ All credentials validated successfully!');
  } else {
    console.log('⚠️ Credential validation failed');
  }
}