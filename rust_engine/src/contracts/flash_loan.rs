use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
};
use spl_token::instruction as token_instruction;

entrypoint!(process_instruction);

/// Flash loan program that allows borrowing tokens with zero capital
/// as long as they are returned within the same transaction (plus fees)
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Flash Loan Instruction");

    let accounts_iter = &mut accounts.iter();
    let user = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let source_liquidity_pool = next_account_info(accounts_iter)?;
    let user_token_account = next_account_info(accounts_iter)?;
    let fee_account = next_account_info(accounts_iter)?;
    let pda_account = next_account_info(accounts_iter)?;
    
    // Validate accounts
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Parse instruction data
    let (instruction_type, rest) = instruction_data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
    
    // Process flash loan based on instruction type
    match instruction_type {
        0 => {
            // Flash loan start - transfer tokens from pool to user
            msg!("Starting flash loan of {} tokens", amount);
            
            // Get PDA seeds and bump seed
            let (pda_pubkey, bump_seed) = Pubkey::find_program_address(&[b"flash_loan", user.key.as_ref()], program_id);
            if pda_pubkey != *pda_account.key {
                return Err(ProgramError::InvalidArgument);
            }
            
            // Transfer tokens from pool to user
            let transfer_instruction = token_instruction::transfer(
                token_program.key,
                source_liquidity_pool.key,
                user_token_account.key,
                pda_account.key,
                &[&pda_account.key],
                amount,
            )?;
            
            invoke_signed(
                &transfer_instruction,
                &[
                    source_liquidity_pool.clone(),
                    user_token_account.clone(),
                    pda_account.clone(),
                    token_program.clone(),
                ],
                &[&[b"flash_loan", user.key.as_ref(), &[bump_seed]]],
            )?;
            
            msg!("Flash loan executed successfully");
            Ok(())
        },
        1 => {
            // Flash loan end - return tokens from user to pool (with fee)
            msg!("Ending flash loan, returning {} tokens (plus fee)", amount);
            
            // Calculate fee (0.3%)
            let fee_amount = amount * 3 / 1000;
            let total_repayment = amount + fee_amount;
            
            // Transfer tokens from user back to pool
            let repay_instruction = token_instruction::transfer(
                token_program.key,
                user_token_account.key,
                source_liquidity_pool.key,
                user.key,
                &[&user.key],
                amount,
            )?;
            
            invoke(
                &repay_instruction,
                &[
                    user_token_account.clone(),
                    source_liquidity_pool.clone(),
                    user.clone(),
                    token_program.clone(),
                ],
            )?;
            
            // Transfer fee from user to fee account
            let fee_instruction = token_instruction::transfer(
                token_program.key,
                user_token_account.key,
                fee_account.key,
                user.key,
                &[&user.key],
                fee_amount,
            )?;
            
            invoke(
                &fee_instruction,
                &[
                    user_token_account.clone(),
                    fee_account.clone(),
                    user.clone(),
                    token_program.clone(),
                ],
            )?;
            
            msg!("Flash loan repaid successfully with fee");
            Ok(())
        },
        _ => Err(ProgramError::InvalidInstructionData),
    }
}