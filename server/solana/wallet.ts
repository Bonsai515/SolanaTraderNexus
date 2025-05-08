import { Router } from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { storage } from '../storage';
import { z } from 'zod';

/**
 * Sets up routes for handling Solana wallet operations
 */
export function setupWalletRoutes(solanaConnection: Connection) {
  const router = Router();

  // Get wallet information
  router.get('/', async (req, res) => {
    try {
      // In a real app, we would get the user's wallet from authentication
      // Here we're using the sample wallet
      const wallet = await storage.getWallet(1);
      
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
      
      res.json({
        address: wallet.address,
        balance: `${wallet.balance.toFixed(2)} SOL`,
        type: wallet.type
      });
    } catch (error) {
      console.error('Error fetching wallet:', error);
      res.status(500).json({ message: 'Failed to fetch wallet information' });
    }
  });

  // Deposit funds to wallet
  router.post('/deposit', async (req, res) => {
    try {
      const depositSchema = z.object({
        amount: z.number().positive()
      });
      
      const validationResult = depositSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      
      const { amount } = validationResult.data;
      
      // In a real app, this would initiate a blockchain transaction
      // For demo purposes, we'll update the wallet balance directly
      
      const wallet = await storage.getWallet(1);
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
      
      const newBalance = wallet.balance + amount;
      const updatedWallet = await storage.updateWalletBalance(wallet.id, newBalance);
      
      if (!updatedWallet) {
        return res.status(500).json({ message: 'Failed to update wallet balance' });
      }
      
      // Record the deposit transaction
      await storage.createTransaction({
        walletId: wallet.id,
        strategyId: null,
        type: 'DEPOSIT',
        amount,
        status: 'COMPLETED',
        profit: null,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        message: 'Deposit successful',
        newBalance: `${updatedWallet.balance.toFixed(2)} SOL`
      });
    } catch (error) {
      console.error('Error processing deposit:', error);
      res.status(500).json({ message: 'Failed to process deposit' });
    }
  });

  // Withdraw funds from wallet
  router.post('/withdraw', async (req, res) => {
    try {
      const withdrawSchema = z.object({
        amount: z.number().positive()
      });
      
      const validationResult = withdrawSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      
      const { amount } = validationResult.data;
      
      // In a real app, this would initiate a blockchain transaction
      // For demo purposes, we'll update the wallet balance directly
      
      const wallet = await storage.getWallet(1);
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
      
      if (wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient funds' });
      }
      
      const newBalance = wallet.balance - amount;
      const updatedWallet = await storage.updateWalletBalance(wallet.id, newBalance);
      
      if (!updatedWallet) {
        return res.status(500).json({ message: 'Failed to update wallet balance' });
      }
      
      // Record the withdrawal transaction
      await storage.createTransaction({
        walletId: wallet.id,
        strategyId: null,
        type: 'WITHDRAW',
        amount,
        status: 'COMPLETED',
        profit: null,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        message: 'Withdrawal successful',
        newBalance: `${updatedWallet.balance.toFixed(2)} SOL`
      });
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      res.status(500).json({ message: 'Failed to process withdrawal' });
    }
  });

  // Transfer funds to another wallet
  router.post('/transfer', async (req, res) => {
    try {
      const transferSchema = z.object({
        recipient: z.string().min(10),
        amount: z.number().positive()
      });
      
      const validationResult = transferSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid transfer details' });
      }
      
      const { recipient, amount } = validationResult.data;
      
      // In a real app, this would create and submit a Solana transaction
      // For demo purposes, we'll simulate the process
      
      const wallet = await storage.getWallet(1);
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
      
      if (wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient funds' });
      }
      
      const newBalance = wallet.balance - amount;
      const updatedWallet = await storage.updateWalletBalance(wallet.id, newBalance);
      
      if (!updatedWallet) {
        return res.status(500).json({ message: 'Failed to update wallet balance' });
      }
      
      // Record the transfer transaction
      await storage.createTransaction({
        walletId: wallet.id,
        strategyId: null,
        type: 'TRANSFER',
        amount,
        status: 'COMPLETED',
        profit: null,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        message: 'Transfer successful',
        recipient,
        amount: `${amount.toFixed(2)} SOL`,
        newBalance: `${updatedWallet.balance.toFixed(2)} SOL`
      });
    } catch (error) {
      console.error('Error processing transfer:', error);
      res.status(500).json({ message: 'Failed to process transfer' });
    }
  });

  // Create new wallet
  router.post('/create', async (req, res) => {
    try {
      // Generate a new Solana keypair
      const keypair = Keypair.generate();
      
      // Get the public key (wallet address)
      const publicKey = keypair.publicKey.toString();
      
      // In a real app, we would store the keypair securely
      // For demo purposes, we'll just create a wallet record
      
      const wallet = await storage.createWallet({
        userId: 1, // Assuming user ID 1
        address: publicKey,
        balance: 0,
        type: 'SECONDARY'
      });
      
      res.status(201).json({
        message: 'Wallet created successfully',
        walletId: wallet.id,
        address: wallet.address
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      res.status(500).json({ message: 'Failed to create wallet' });
    }
  });

  return router;
}
