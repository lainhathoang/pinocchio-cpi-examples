use bytemuck::{Pod, Zeroable};
use pinocchio::{
    cpi::invoke,
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    AccountView, ProgramResult,
};
use shank::ShankType;

const DISCRIMINATOR: [u8; 8] = [56, 252, 116, 8, 158, 223, 205, 95];

// accounts
pub struct PumpFunBuyExactSolInAccounts<'info> {
    pub global: &'info AccountView,
    pub fee_recipient: &'info AccountView,
    pub mint: &'info AccountView,
    pub bonding_curve: &'info AccountView,
    pub associated_bonding_curve: &'info AccountView,
    pub associated_user: &'info AccountView,
    pub user: &'info AccountView,
    pub system_program: &'info AccountView,
    pub token_program: &'info AccountView,
    pub creator_vault: &'info AccountView,
    pub event_authority: &'info AccountView,
    pub program: &'info AccountView,
    pub global_volume_accumulator: &'info AccountView,
    pub user_volume_accumulator: &'info AccountView,
    pub fee_config: &'info AccountView,
    pub fee_program: &'info AccountView,
}

impl<'info> TryFrom<&'info [AccountView]> for PumpFunBuyExactSolInAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountView]) -> Result<Self, Self::Error> {
        let [global, fee_recipient, mint, bonding_curve, associated_bonding_curve, associated_user, user, system_program, token_program, creator_vault, event_authority, program, global_volume_accumulator, user_volume_accumulator, fee_config, fee_program] =
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
            || !user_volume_accumulator.is_writable()
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
            token_program,
            creator_vault,
            event_authority,
            program,
            global_volume_accumulator,
            user_volume_accumulator,
            fee_config,
            fee_program,
        })
    }
}

// data
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct PumpFunBuyExactSolInData {
    pub bump: u8,

    #[idl_type(u64)]
    pub spendable_sol_in: [u8; 8],

    #[idl_type(u64)]
    pub min_tokens_out: [u8; 8],

    #[idl_type("Option<bool>")]
    pub track_volume: u8,
}

impl PumpFunBuyExactSolInData {
    pub const LEN: usize = core::mem::size_of::<PumpFunBuyExactSolInData>();
}

impl<'info> TryFrom<&'info [u8]> for PumpFunBuyExactSolInData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result = bytemuck::try_from_bytes::<Self>(&data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

// context
pub struct PumpFunBuyExactSolInContext<'info> {
    pub accounts: PumpFunBuyExactSolInAccounts<'info>,
    pub instruction_data: PumpFunBuyExactSolInData,
}

impl<'info> TryFrom<(&'info [AccountView], &'info [u8])> for PumpFunBuyExactSolInContext<'info> {
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountView], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let accounts = PumpFunBuyExactSolInAccounts::try_from(accounts)?;
        let instruction_data = PumpFunBuyExactSolInData::try_from(data)?;

        Ok(Self {
            accounts,
            instruction_data,
        })
    }
}

impl<'info> PumpFunBuyExactSolInContext<'info> {
    pub fn handler(&mut self) -> ProgramResult {
        let PumpFunBuyExactSolInAccounts {
            global,
            fee_recipient,
            mint,
            bonding_curve,
            associated_bonding_curve,
            associated_user,
            user,
            system_program,
            token_program,
            creator_vault,
            event_authority,
            program,
            global_volume_accumulator,
            user_volume_accumulator,
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
            InstructionAccount::readonly(token_program.address()),
            InstructionAccount::writable(creator_vault.address()),
            InstructionAccount::readonly(event_authority.address()),
            InstructionAccount::readonly(program.address()),
            InstructionAccount::readonly(global_volume_accumulator.address()),
            InstructionAccount::writable(user_volume_accumulator.address()),
            InstructionAccount::readonly(fee_config.address()),
            InstructionAccount::readonly(fee_program.address()),
        ];

        // instruction data
        // [0] discriminator: 8 bytes
        // [1] spendable_sol_in: 8 bytes
        // [2] min_tokens_out: 8 bytes
        // [3] track_volume: 1 bytes
        let mut instruction_data = [0; 25]; // 8 + 8 + 8 + 1 = 25 bytes
        instruction_data[0..8].copy_from_slice(&DISCRIMINATOR);
        instruction_data[8..16].copy_from_slice(&self.instruction_data.spendable_sol_in);
        instruction_data[16..24].copy_from_slice(&self.instruction_data.min_tokens_out);
        instruction_data[24] = self.instruction_data.track_volume;

        let instruction = InstructionView {
            program_id: program.address(),
            data: &instruction_data,
            accounts: &account_metas,
        };

        invoke::<16>(
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
                token_program,
                creator_vault,
                event_authority,
                program,
                global_volume_accumulator,
                user_volume_accumulator,
                fee_config,
                fee_program,
            ],
        )
    }
}
