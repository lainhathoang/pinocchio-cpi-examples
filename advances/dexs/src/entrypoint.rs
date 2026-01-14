use pinocchio::{error::ProgramError, AccountView, Address, ProgramResult};
use pinocchio_log::log;

use crate::instruction::{ProgramInstruction, PumpFunBuyExactSolInContext, PumpFunSellContext};

pub fn process_instruction(
    _program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    if _program_id.as_array().ne(&crate::ID) {
        return Err(ProgramError::IncorrectProgramId);
    }

    let (discriminator, data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match ProgramInstruction::try_from(discriminator)? {
        ProgramInstruction::PumpFunBuy => {
            log!("Instruction: PumpFunBuy");
            Ok(())
        }
        ProgramInstruction::PumpFunBuyExactSolIn => {
            log!("Instruction: PumpFunBuyExactSolIn");
            PumpFunBuyExactSolInContext::try_from((accounts, data))?.handler()
        }
        ProgramInstruction::PumpFunSell => {
            log!("Instruction: PumpFunSell");
            PumpFunSellContext::try_from((accounts, data))?.handler()
        }
        ProgramInstruction::RaydiumCpmmInit => {
            log!("Instruction: RaydiumCpmmInit");
            Ok(())
        }
        ProgramInstruction::RaydiumCpmmSwapBaseIn => {
            log!("Instruction: RaydiumCpmmSwapBaseIn");
            Ok(())
        }
        _ => todo!(),
    }
}
