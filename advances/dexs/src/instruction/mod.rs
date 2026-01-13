use pinocchio::error::ProgramError;

pub mod pump_fun;

pub use pump_fun::*;

// ix accounts
// ix data
// context

#[repr(u8)]
pub enum ProgramInstruction {
    // pump: 1x
    PumpFunBuy,
    PumpFunBuyExactSolIn,
    PumpFunSell,
    // raydium: 2x
    // meteora: 3x
    // orca: 4x
}

impl TryFrom<&u8> for ProgramInstruction {
    type Error = ProgramError;

    fn try_from(value: &u8) -> Result<Self, Self::Error> {
        match *value {
            // pump fun
            11 => Ok(ProgramInstruction::PumpFunBuy),
            12 => Ok(ProgramInstruction::PumpFunBuyExactSolIn),
            13 => Ok(ProgramInstruction::PumpFunSell),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}
