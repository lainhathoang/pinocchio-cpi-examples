use bytemuck::{Pod, Zeroable};
use pinocchio::{
    cpi::invoke,
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    AccountView, ProgramResult,
};
use shank::ShankType;

const DISCRIMINATOR: [u8; 8] = [143, 190, 90, 218, 196, 30, 51, 222];

pub struct RaydiumCpmmSwapBaseInputAccounts<'info> {
    /// The user performing the swap
    pub payer: &'info AccountView,
    /// Pool vault and lp mint authority PDA
    pub authority: &'info AccountView,
    /// The factory state to read protocol fees
    pub amm_config: &'info AccountView,
    /// The program account of the pool in which the swap will be performed
    pub pool_state: &'info AccountView,
    /// The user token account for input token
    pub input_token_account: &'info AccountView,
    /// The user token account for output token
    pub output_token_account: &'info AccountView,
    /// The vault token account for input token
    pub input_vault: &'info AccountView,
    /// The vault token account for output token
    pub output_vault: &'info AccountView,
    /// SPL program for input token transfers
    pub input_token_program: &'info AccountView,
    /// SPL program for output token transfers
    pub output_token_program: &'info AccountView,
    /// The mint of input token
    pub input_token_mint: &'info AccountView,
    /// The mint of output token
    pub output_token_mint: &'info AccountView,
    /// The program account for the most recent oracle observation
    pub observation_state: &'info AccountView,
    /// Raydium CPMM program
    pub raydium_program: &'info AccountView,
}

impl<'info> TryFrom<&'info [AccountView]> for RaydiumCpmmSwapBaseInputAccounts<'info> {
    type Error = ProgramError;

    fn try_from(accounts: &'info [AccountView]) -> Result<Self, Self::Error> {
        let [payer, authority, amm_config, pool_state, input_token_account, output_token_account, input_vault, output_vault, input_token_program, output_token_program, input_token_mint, output_token_mint, observation_state, raydium_program] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !payer.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        if !pool_state.is_writable()
            || !input_token_account.is_writable()
            || !output_token_account.is_writable()
            || !input_vault.is_writable()
            || !output_vault.is_writable()
            || !observation_state.is_writable()
        {
            return Err(ProgramError::Immutable);
        }

        Ok(Self {
            payer,
            authority,
            amm_config,
            pool_state,
            input_token_account,
            output_token_account,
            input_vault,
            output_vault,
            input_token_program,
            output_token_program,
            input_token_mint,
            output_token_mint,
            observation_state,
            raydium_program,
        })
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankType)]
pub struct RaydiumCpmmSwapBaseInputData {
    /// Input amount to transfer, output to DESTINATION is based on the exchange rate
    #[idl_type(u64)]
    pub amount_in: [u8; 8],

    /// Minimum amount of output token, prevents excessive slippage
    #[idl_type(u64)]
    pub minimum_amount_out: [u8; 8],
}

impl RaydiumCpmmSwapBaseInputData {
    pub const LEN: usize = core::mem::size_of::<RaydiumCpmmSwapBaseInputData>();
}

impl<'info> TryFrom<&'info [u8]> for RaydiumCpmmSwapBaseInputData {
    type Error = ProgramError;

    fn try_from(data: &'info [u8]) -> Result<Self, Self::Error> {
        let result = bytemuck::try_from_bytes::<Self>(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        Ok(*result)
    }
}

pub struct RaydiumCpmmSwapBaseInputContext<'info> {
    pub accounts: RaydiumCpmmSwapBaseInputAccounts<'info>,
    pub instruction_data: RaydiumCpmmSwapBaseInputData,
}

impl<'info> TryFrom<(&'info [AccountView], &'info [u8])>
    for RaydiumCpmmSwapBaseInputContext<'info>
{
    type Error = ProgramError;

    fn try_from(
        (accounts, data): (&'info [AccountView], &'info [u8]),
    ) -> Result<Self, Self::Error> {
        let parsed_accounts = RaydiumCpmmSwapBaseInputAccounts::try_from(accounts)?;
        let instruction_data = RaydiumCpmmSwapBaseInputData::try_from(data)?;

        Ok(Self {
            accounts: parsed_accounts,
            instruction_data,
        })
    }
}

impl<'info> RaydiumCpmmSwapBaseInputContext<'info> {
    pub fn handler(&mut self) -> ProgramResult {
        let RaydiumCpmmSwapBaseInputAccounts {
            payer,
            authority,
            amm_config,
            pool_state,
            input_token_account,
            output_token_account,
            input_vault,
            output_vault,
            input_token_program,
            output_token_program,
            input_token_mint,
            output_token_mint,
            observation_state,
            raydium_program,
        } = self.accounts;

        let account_metas = [
            InstructionAccount::readonly_signer(payer.address()),
            InstructionAccount::readonly(authority.address()),
            InstructionAccount::readonly(amm_config.address()),
            InstructionAccount::writable(pool_state.address()),
            InstructionAccount::writable(input_token_account.address()),
            InstructionAccount::writable(output_token_account.address()),
            InstructionAccount::writable(input_vault.address()),
            InstructionAccount::writable(output_vault.address()),
            InstructionAccount::readonly(input_token_program.address()),
            InstructionAccount::readonly(output_token_program.address()),
            InstructionAccount::readonly(input_token_mint.address()),
            InstructionAccount::readonly(output_token_mint.address()),
            InstructionAccount::writable(observation_state.address()),
        ];

        let mut instruction_data = [0u8; 24];
        instruction_data[0..8].copy_from_slice(&DISCRIMINATOR);
        instruction_data[8..16].copy_from_slice(&self.instruction_data.amount_in);
        instruction_data[16..24].copy_from_slice(&self.instruction_data.minimum_amount_out);

        let instruction = InstructionView {
            program_id: raydium_program.address(),
            data: &instruction_data,
            accounts: &account_metas,
        };

        invoke::<13>(
            &instruction,
            &[
                payer,
                authority,
                amm_config,
                pool_state,
                input_token_account,
                output_token_account,
                input_vault,
                output_vault,
                input_token_program,
                output_token_program,
                input_token_mint,
                output_token_mint,
                observation_state,
            ],
        )
    }
}
