export interface NexusEngine {
  executeFlashLoan(params: any): Promise<any>;
  executeCrossChain(params: any): Promise<any>;
  rebalancePortfolio(params: any): Promise<any>;
}