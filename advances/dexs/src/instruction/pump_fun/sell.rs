use bytemuck::{Pod, Zeroable};
use pinocchio::{
    cpi::invoke,
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    AccountView, ProgramResult,
};
use shank::ShankType;

const DISCRIMINATOR: [u8; 8] = [51, 230, 133, 164, 1, 127, 131, 173];

// accounts
pub struct PumpFunSellAccounts<'info> {
    pub global: &'info AccountView,
    pub fee_recipient: &'info AccountView,
    pub mint: &'info AccountView,
    pub bonding_curve: &'info AccountView,
    pub associated_bonding_curve: &'info AccountView,
    pub associated_user: &'info AccountView,
    pub user: &'info AccountView,
    pub system_program: &'info AccountView,
    pub creator_vault: &'info AccountView,
    pub token_program: &'info AccountView,
    pub event_authority: &'info AccountView,
    pub program: &'info AccountView,
    pub fee_config: &'info AccountView,
    pub fee_program: &'info AccountView,
}

impl<'info> TryFrom<&'info [AccountView]> for PumpFunSellAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountView]) -> Result<Self, Self::Error> {
        let [global, fee_recipient, mint, bonding_curve, associated_bonding_curve, associated_user, user, system_program, creator_vault, token_program, event_authority, program, fee_config, fee_program] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !user.is_signer() {
            return Err(ProgramError::Immutable);
        }

        if !fee_recipient.is_writable()
            || !bonding_curve.is_writable()
            || !associated_bonding_curve.is_writable()
            || !associated_user.is_writable()
            || !user.is_writable()
            || !creator_vault.is_writable()
        {
            return Err(ProgramError::Immutable);
        }

        Ok(Self {
            global,
            fee_recipient,
            mint,
            bonding_curve,
            associated_bonding_curve,
            associated_user,
            user,
            system_program,
            creator_vault,
            token_program,
            event_authority,
            program,
            fee_config,
            fee_program,
        })
    }
}

// data
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct PumpFunSellData {
    #[idl_type(u64)]
    pub amount: [u8; 8],

    #[idl_type(u64)]
    pub min_sol_output: [u8; 8],
}

impl PumpFunSellData {
    pub const LEN: usize = core::mem::size_of::<PumpFunSellData>();
}

impl<'info> TryFrom<&'info [u8]> for PumpFunSellData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result = bytemuck::try_from_bytes::<Self>(&data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

// context
pub struct PumpFunSellContext<'info> {
    pub accounts: PumpFunSellAccounts<'info>,
    pub instruction_data: PumpFunSellData,
}

impl<'info> TryFrom<(&'info [AccountView], &'info [u8])> for PumpFunSellContext<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountView], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = PumpFunSellAccounts::try_from(accounts)?;
        let instruction_data = PumpFunSellData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> PumpFunSellContext<'info> {
    pub fn handler(&mut self) -> ProgramResult {
        let PumpFunSellAccounts {
            global,
            fee_recipient,
            mint,
            bonding_curve,
            associated_bonding_curve,
            associated_user,
            user,
            system_program,
            creator_vault,
            token_program,
            event_authority,
            program,
            fee_config,
            fee_program,
        } = self.accounts;

        let account_metas = [
            InstructionAccount::readonly(global.address()),
            InstructionAccount::writable(fee_recipient.address()),
            InstructionAccount::readonly(mint.address()),
            InstructionAccount::writable(bonding_curve.address()),
            InstructionAccount::writable(associated_bonding_curve.address()),
            InstructionAccount::writable(associated_user.address()),
            InstructionAccount::writable_signer(user.address()),
            InstructionAccount::readonly(system_program.address()),
            InstructionAccount::writable(creator_vault.address()),
            InstructionAccount::readonly(token_program.address()),
            InstructionAccount::readonly(event_authority.address()),
            InstructionAccount::readonly(program.address()),
            InstructionAccount::readonly(fee_config.address()),
            InstructionAccount::readonly(fee_program.address()),
        ];

        // instruction data
        // [0] discriminator: 8 bytes
        // [1] amount: 8 bytes
        // [2] min_sol_output: 8 bytes
        let mut instruction_data = [0; 24]; // 8 + 8 + 8 = 24 bytes
        instruction_data[0..8].copy_from_slice(&DISCRIMINATOR);
        instruction_data[8..16].copy_from_slice(&self.instruction_data.amount);
        instruction_data[16..24].copy_from_slice(&self.instruction_data.min_sol_output);

        let instruction = InstructionView {
            program_id: program.address(),
            data: &instruction_data,
            accounts: &account_metas,
        };

        invoke::<14>(
            &instruction,
            &[
                global,
                fee_recipient,
                mint,
                bonding_curve,
                associated_bonding_curve,
                associated_user,
                user,
                system_program,
                creator_vault,
                token_program,
                event_authority,
                program,
                fee_config,
                fee_program,
            ],
        )
    }
}
