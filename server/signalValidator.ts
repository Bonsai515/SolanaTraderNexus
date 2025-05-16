/**
 * The code fixes a TypeScript type error by casting `signal` to `any` when accessing `targetComponents`.
 */
/**
 * Signal Validator - Real-time Signal Quality and Integrity Assurance
 * 
 * This module validates signals before they are processed by the system
 * to ensure data quality, completeness, and prevent invalid trading actions.
 * 
 * Now enhanced with Zero-Knowledge Proof verification to validate signal
 * integrity without revealing model weights or parameters.
 */

import { SignalPriority, SignalType, BaseSignal } from '../shared/signalTypes';
import { Signal } from './signalHub';
import { logger } from './logger';
import { zkProofVerification, ZkProofScheme } from './lib/zkProofVerification';

// Signal validation rules
interface ValidationRule {
  name: string;
  validate: (signal: Signal) => boolean;
  errorMessage: (signal: Signal) => string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    rule: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  signalId: string;
  timestamp: Date;
}

class SignalValidator {
  private static instance: SignalValidator;
  private rules: ValidationRule[] = [];
  private validationStats: {
    totalValidated: number;
    validSignals: number;
    invalidSignals: number;
    warningSignals: number;
    errorsByRule: Record<string, number>;
  } = {
    totalValidated: 0,
    validSignals: 0,
    invalidSignals: 0,
    warningSignals: 0,
    errorsByRule: {}
  };

  private constructor() {
    this.initializeRules();
  }

  public static getInstance(): SignalValidator {
    if (!SignalValidator.instance) {
      SignalValidator.instance = new SignalValidator();
    }
    return SignalValidator.instance;
  }

  /**
   * Initialize validation rules
   */
  private initializeRules(): void {
    // Required field validation
    this.rules.push({
      name: 'required-fields',
      validate: (signal) => {
        return !!(
          signal.pair && 
          signal.type && 
          signal.source && 
          signal.strength && 
          signal.direction && 
          signal.confidence !== undefined && 
          signal.description
        );
      },
      errorMessage: () => 'Missing required signal fields',
      severity: 'error'
    });

    // Confidence score range validation
    this.rules.push({
      name: 'confidence-range',
      validate: (signal) => {
        return signal.confidence >= 0 && signal.confidence <= 100;
      },
      errorMessage: (signal) => `Confidence score out of range: ${signal.confidence}`,
      severity: 'error'
    });

    // Token address validation for asset-specific signals
    this.rules.push({
      name: 'token-address-required',
      validate: (signal) => {
        // Only apply to certain signal types
        const requiresToken = [
          SignalType.PRICE_ACTION,
          SignalType.LIQUIDITY_CHANGE,
          SignalType.WHALE_MOVEMENT,
          SignalType.MEV_OPPORTUNITY,
          SignalType.FLASH_LOAN,
          SignalType.ARBITRAGE,
          SignalType.MEV_OPPORTUNITY
        ].includes(signal.type);

        return !requiresToken || !!signal.token_address;
      },
      errorMessage: (signal) => `Token address required for signal type: ${signal.type}`,
      severity: 'error'
    });

    // Critical priority validation
    this.rules.push({
      name: 'critical-priority-validation',
      validate: (signal) => {
        return signal.priority !== SignalPriority.CRITICAL || signal.confidence >= 85;
      },
      errorMessage: () => 'Critical priority signals must have confidence of at least 85%',
      severity: 'error'
    });

    // Component targeting validation for actionable signals
    this.rules.push({
      name: 'actionable-targeting',
      validate: (signal) => {
        return !signal.actionable || ((signal as any).targetComponents && (signal as any).targetComponents.length > 0) ? true : false;
      },
      errorMessage: () => 'Actionable signals must specify target components',
      severity: 'error'
    });

    // Metrics validation for arbitrage and MEV signals
    this.rules.push({
      name: 'profit-metrics-required',
      validate: (signal) => {
        const requiresMetrics = [
          SignalType.MEV_OPPORTUNITY,
          SignalType.ARBITRAGE,
          SignalType.FLASH_LOAN
        ].includes(signal.type);

        return (!requiresMetrics || 
               (signal.metrics && 
                signal.metrics.profitPotential !== undefined && 
                signal.metrics.successProbability !== undefined)) ? true : false;
      },
      errorMessage: (signal) => `Profit metrics required for signal type: ${signal.type}`,
      severity: 'error'
    });

    // Warning for low confidence but high priority signals
    this.rules.push({
      name: 'low-confidence-high-priority',
      validate: (signal) => {
        return signal.priority < SignalPriority.HIGH || signal.confidence >= 70;
      },
      errorMessage: () => 'High priority signal with confidence below 70%',
      severity: 'warning'
    });

    // Warning for missing analysis on certain signal types
    this.rules.push({
      name: 'analysis-recommended',
      validate: (signal) => {
        const shouldHaveAnalysis = [
          SignalType.PATTERN_RECOGNITION,
          SignalType.CROSS_CHAIN_OPPORTUNITY,
          SignalType.WHALE_MOVEMENT
        ].includes(signal.type);

        return (!shouldHaveAnalysis || (signal.analysis && Object.keys(signal.analysis).length > 0)) ? true : false;
      },
      errorMessage: (signal) => `Analysis data recommended for signal type: ${signal.type}`,
      severity: 'warning'
    });

    // Zero-Knowledge Proof verification for AI-generated signals
    this.rules.push({
      name: 'zk-proof-verification',
      validate: (signal) => {
        // Only validate AI-generated signals that should have ZK proofs
        const requiresZkProof = [
          'PerplexityAI',
          'DeepSeekAI',
          'MemeCortex',
          'QuantumNeuralNet'
        ].includes(signal.source);

        if (!requiresZkProof) {
          return true; // Skip validation for signals from other sources
        }

        try {
          // Generate model weights for the signal source
          // In a real implementation, these would be retrieved from a secure storage
          const modelWeights = zkProofVerification.generateModelWeights(
            signal.source,
            { 
              timestamp: signal.timestamp,
              sourceId: signal.source,
              confidenceFactors: signal.confidence
            }
          );

          // Verify the signal with ZK proof
          const isValid = zkProofVerification.verifySignal(signal, modelWeights);

          if (isValid) {
            logger.info(`ZK proof verification passed for signal ${signal.id} from ${signal.source}`);
          } else {
            logger.warn(`ZK proof verification failed for signal ${signal.id} from ${signal.source}`);
          }

          return isValid;
        } catch (error) {
          logger.error(`Error during ZK proof verification for signal ${signal.id}: ${error.message}`);
          return false;
        }
      },
      errorMessage: (signal) => `AI signal verification failed: ZK proof invalid for ${signal.source}`,
      severity: 'error'
    });
  }

  /**
   * Validate a signal against all rules
   * @param signal Signal to validate
   * @returns Validation result
   */
  public validate(signal: Signal): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      signalId: signal.id,
      timestamp: new Date()
    };

    // Check each rule
    for (const rule of this.rules) {
      const isValid = rule.validate(signal);

      if (!isValid) {
        result.errors.push({
          rule: rule.name,
          message: rule.errorMessage(signal),
          severity: rule.severity
        });

        // Only set valid to false for errors, not warnings
        if (rule.severity === 'error') {
          result.valid = false;
        }

        // Track errors by rule
        this.validationStats.errorsByRule[rule.name] = (this.validationStats.errorsByRule[rule.name] || 0) + 1;
      }
    }

    // Update stats
    this.validationStats.totalValidated++;

    if (!result.valid) {
      this.validationStats.invalidSignals++;
      logger.warn(`Invalid signal detected [${signal.id}]: ${result.errors.filter(e => e.severity === 'error').map(e => e.message).join(', ')}`);
    } else {
      this.validationStats.validSignals++;

      if (result.errors.length > 0) {
        this.validationStats.warningSignals++;
        logger.info(`Signal with warnings [${signal.id}]: ${result.errors.map(e => e.message).join(', ')}`);
      }
    }

    return result;
  }

  /**
   * Get validation statistics
   * @returns Current validation stats
   */
  public getStats(): typeof this.validationStats {
    return { ...this.validationStats };
  }

  /**
   * Reset validation statistics
   */
  public resetStats(): void {
    this.validationStats = {
      totalValidated: 0,
      validSignals: 0,
      invalidSignals: 0,
      warningSignals: 0,
      errorsByRule: {}
    };
  }
}

// Export the singleton instance
export const signalValidator = SignalValidator.getInstance();