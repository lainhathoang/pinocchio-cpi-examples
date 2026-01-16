use pinocchio::error::ProgramError;

pub mod pump_fun;
pub mod raydium_cpmm;

pub use pump_fun::*;
pub use raydium_cpmm::*;

use shank::ShankType;

// ix accounts
// ix data
// context

#[repr(u8)]
pub enum ProgramInstruction {
    // pump
    PumpFunBuy,
    PumpFunBuyExactSolIn,
    PumpFunSell,
    // raydium
    RaydiumCpmmInit,
    RaydiumCpmmSwapBaseIn,
    RaydiumCpmmSwapBaseOut,
    // meteora
    // orca
}

impl TryFrom<&u8> for ProgramInstruction {
    type Error = ProgramError;

    fn try_from(value: &u8) -> Result<Self, Self::Error> {
        match *value {
            // ===== pump fun
            0 => Ok(ProgramInstruction::PumpFunBuy),
            1 => Ok(ProgramInstruction::PumpFunBuyExactSolIn),
            2 => Ok(ProgramInstruction::PumpFunSell),
            // ===== raydium
            // cpmm
            3 => Ok(ProgramInstruction::RaydiumCpmmInit),
            4 => Ok(ProgramInstruction::RaydiumCpmmSwapBaseIn),
            5 => Ok(ProgramInstruction::RaydiumCpmmSwapBaseOut),
            //
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

mod idl_gen {
    use super::{
        PumpFunBuyExactSolInData, PumpFunSellData, RaydiumCpmmSwapBaseInputData,
        RaydiumCpmmSwapBaseOutputData,
    };

    /// IDL generation enum - MUST match ProgramInstruction order exactly!
    /// Shank assigns discriminators based on variant order (0, 1, 2, ...)
    #[derive(shank::ShankInstruction)]
    enum _ProgramInstruction {
        // ===== PumpFun Buy (discriminator = 0) =====
        // Placeholder - not implemented yet
        PumpFunBuy,

        // ===== PumpFun Buy Exact Sol In (discriminator = 1) =====
        #[account(0, name = "global", desc = "Global state PDA")]
        #[account(1, writable, name = "fee_recipient", desc = "Fee recipient account")]
        #[account(2, name = "mint", desc = "Token mint")]
        #[account(3, writable, name = "bonding_curve", desc = "Bonding curve PDA")]
        #[account(
            4,
            writable,
            name = "associated_bonding_curve",
            desc = "Associated token account for bonding curve"
        )]
        #[account(
            5,
            writable,
            name = "associated_user",
            desc = "User's associated token account"
        )]
        #[account(6, writable, signer, name = "user", desc = "User account (signer)")]
        #[account(7, name = "system_program", desc = "System program")]
        #[account(8, name = "token_program", desc = "Token program")]
        #[account(9, writable, name = "creator_vault", desc = "Creator vault PDA")]
        #[account(10, name = "event_authority", desc = "Event authority PDA")]
        #[account(11, name = "program", desc = "Pump fun program")]
        #[account(
            12,
            name = "global_volume_accumulator",
            desc = "Global volume accumulator PDA"
        )]
        #[account(
            13,
            writable,
            name = "user_volume_accumulator",
            desc = "User volume accumulator PDA"
        )]
        #[account(14, name = "fee_config", desc = "Fee config PDA")]
        #[account(15, name = "fee_program", desc = "Fee program")]
        PumpFunBuyExactSolIn(PumpFunBuyExactSolInData),

        // ===== PumpFun Sell (discriminator = 2) =====
        #[account(0, name = "global", desc = "Global state PDA")]
        #[account(1, writable, name = "fee_recipient", desc = "Fee recipient account")]
        #[account(2, name = "mint", desc = "Token mint")]
        #[account(3, writable, name = "bonding_curve", desc = "Bonding curve PDA")]
        #[account(
            4,
            writable,
            name = "associated_bonding_curve",
            desc = "Associated token account for bonding curve"
        )]
        #[account(
            5,
            writable,
            name = "associated_user",
            desc = "User's associated token account"
        )]
        #[account(6, writable, signer, name = "user", desc = "User account (signer)")]
        #[account(7, name = "system_program", desc = "System program")]
        #[account(8, writable, name = "creator_vault", desc = "Creator vault PDA")]
        #[account(9, name = "token_program", desc = "Token program")]
        #[account(10, name = "event_authority", desc = "Event authority PDA")]
        #[account(11, name = "program", desc = "Pump fun program")]
        #[account(12, name = "fee_config", desc = "Fee config PDA")]
        #[account(13, name = "fee_program", desc = "Fee program")]
        PumpFunSell(PumpFunSellData),

        // ===== Raydium CPMM Init (discriminator = 3) =====
        // Placeholder - not implemented yet
        RaydiumCpmmInit,

        // ===== Raydium CPMM Swap Base In (discriminator = 4) =====
        #[account(0, signer, name = "payer", desc = "The user performing the swap")]
        #[account(1, name = "authority", desc = "Pool vault and lp mint authority PDA")]
        #[account(
            2,
            name = "amm_config",
            desc = "The factory state to read protocol fees"
        )]
        #[account(
            3,
            writable,
            name = "pool_state",
            desc = "The program account of the pool in which the swap will be performed"
        )]
        #[account(
            4,
            writable,
            name = "input_token_account",
            desc = "The user token account for input token"
        )]
        #[account(
            5,
            writable,
            name = "output_token_account",
            desc = "The user token account for output token"
        )]
        #[account(
            6,
            writable,
            name = "input_vault",
            desc = "The vault token account for input token"
        )]
        #[account(
            7,
            writable,
            name = "output_vault",
            desc = "The vault token account for output token"
        )]
        #[account(
            8,
            name = "input_token_program",
            desc = "SPL program for input token transfers"
        )]
        #[account(
            9,
            name = "output_token_program",
            desc = "SPL program for output token transfers"
        )]
        #[account(10, name = "input_token_mint", desc = "The mint of input token")]
        #[account(11, name = "output_token_mint", desc = "The mint of output token")]
        #[account(
            12,
            writable,
            name = "observation_state",
            desc = "The program account for the most recent oracle observation"
        )]
        #[account(13, name = "raydium_program", desc = "Raydium CPMM program")]
        RaydiumCpmmSwapBaseIn(RaydiumCpmmSwapBaseInputData),

        // ===== Raydium CPMM Swap Base Out (discriminator = 5) =====
        #[account(0, signer, name = "payer", desc = "The user performing the swap")]
        #[account(1, name = "authority", desc = "Pool vault and lp mint authority PDA")]
        #[account(
            2,
            name = "amm_config",
            desc = "The factory state to read protocol fees"
        )]
        #[account(
            3,
            writable,
            name = "pool_state",
            desc = "The program account of the pool in which the swap will be performed"
        )]
        #[account(
            4,
            writable,
            name = "input_token_account",
            desc = "The user token account for input token"
        )]
        #[account(
            5,
            writable,
            name = "output_token_account",
            desc = "The user token account for output token"
        )]
        #[account(
            6,
            writable,
            name = "input_vault",
            desc = "The vault token account for input token"
        )]
        #[account(
            7,
            writable,
            name = "output_vault",
            desc = "The vault token account for output token"
        )]
        #[account(
            8,
            name = "input_token_program",
            desc = "SPL program for input token transfers"
        )]
        #[account(
            9,
            name = "output_token_program",
            desc = "SPL program for output token transfers"
        )]
        #[account(10, name = "input_token_mint", desc = "The mint of input token")]
        #[account(11, name = "output_token_mint", desc = "The mint of output token")]
        #[account(
            12,
            writable,
            name = "observation_state",
            desc = "The program account for the most recent oracle observation"
        )]
        #[account(13, name = "raydium_program", desc = "Raydium CPMM program")]
        RaydiumCpmmSwapBaseOut(RaydiumCpmmSwapBaseOutputData),
    }
}
