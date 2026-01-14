use pinocchio::error::ProgramError;

pub mod pump_fun;

pub use pump_fun::*;
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
            //
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

mod idl_gen {
    use super::{PumpFunBuyExactSolInData, PumpFunSellData};

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
        // Placeholder - not implemented yet
        RaydiumCpmmSwapBaseIn,
    }
}
