//! Integration tests for Pump.fun CPI functions
//!
//! These tests interact with localnet to test the buy_exact_sol_in CPI instruction
//! against the actual Pump.fun program.
//!
//! Prerequisites:
//! - Run a local Solana validator: `solana-test-validator`
//! - Ensure the keypair at `~/.config/solana/id.json` has sufficient SOL
//!
//! Test token: EtxQtkw2Xpwm1Hn1jMgMSJMFtX97eyQ3E3JrqXeYpump

#[cfg(test)]
mod tests {
    use solana_client::rpc_client::RpcClient;
    use solana_sdk::{
        instruction::{AccountMeta, Instruction},
        message::Message,
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair, Signer},
        transaction::Transaction,
    };
    use spl_associated_token_account::get_associated_token_address_with_program_id;
    use std::str::FromStr;

    // Pump.fun program constants
    const PUMP_FUN_PROGRAM_ID: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
    const PUMP_FUN_FEE_RECIPIENT: &str = "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV";
    const PUMP_FUN_FEE_PROGRAM: &str = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
    const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    const TOKEN_2022_PROGRAM: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    const SYSTEM_PROGRAM: &str = "11111111111111111111111111111111";
    const ASSOCIATED_TOKEN_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

    // Test token
    const TEST_MINT: &str = "EtxQtkw2Xpwm1Hn1jMgMSJMFtX97eyQ3E3JrqXeYpump";

    // Seeds for PDA derivation (from IDL)
    const GLOBAL_SEED: &[u8] = b"global";
    const BONDING_CURVE_SEED: &[u8] = b"bonding-curve";
    const CREATOR_VAULT_SEED: &[u8] = b"creator-vault";
    const EVENT_AUTHORITY_SEED: &[u8] = b"__event_authority";
    const GLOBAL_VOLUME_ACCUMULATOR_SEED: &[u8] = b"global_volume_accumulator";
    const USER_VOLUME_ACCUMULATOR_SEED: &[u8] = b"user_volume_accumulator";
    const FEE_CONFIG_SEED: &[u8] = b"fee_config";

    // Fee config pubkey constant (from IDL)
    const FEE_CONFIG_PUBKEY: [u8; 32] = [
        1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81, 137, 203, 151,
        245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
    ];

    // buy_exact_sol_in discriminator
    const BUY_EXACT_SOL_IN_DISCRIMINATOR: [u8; 8] = [56, 252, 116, 8, 158, 223, 205, 95];

    // Lamports per SOL
    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

    fn get_rpc_client() -> RpcClient {
        RpcClient::new("http://127.0.0.1:8899".to_string())
    }

    fn load_keypair() -> Keypair {
        read_keypair_file("/Users/lainhathoang/.config/solana/id.json")
            .expect("Failed to load keypair from /Users/lainhathoang/.config/solana/id.json")
    }

    fn system_program_id() -> Pubkey {
        Pubkey::from_str(SYSTEM_PROGRAM).unwrap()
    }

    fn token_program_id() -> Pubkey {
        Pubkey::from_str(TOKEN_PROGRAM).unwrap()
    }

    fn token_2022_program_id() -> Pubkey {
        Pubkey::from_str(TOKEN_2022_PROGRAM).unwrap()
    }

    /// Derives the Global PDA
    fn derive_global_pda(program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[GLOBAL_SEED], program_id)
    }

    /// Derives the Bonding Curve PDA for a given mint
    fn derive_bonding_curve_pda(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[BONDING_CURVE_SEED, mint.as_ref()], program_id)
    }

    /// Derives the Creator Vault PDA for a given creator
    fn derive_creator_vault_pda(program_id: &Pubkey, creator: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[CREATOR_VAULT_SEED, creator.as_ref()], program_id)
    }

    /// Derives the Event Authority PDA
    fn derive_event_authority_pda(program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[EVENT_AUTHORITY_SEED], program_id)
    }

    /// Derives the Global Volume Accumulator PDA
    fn derive_global_volume_accumulator_pda(program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[GLOBAL_VOLUME_ACCUMULATOR_SEED], program_id)
    }

    /// Derives the User Volume Accumulator PDA
    fn derive_user_volume_accumulator_pda(program_id: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[USER_VOLUME_ACCUMULATOR_SEED, user.as_ref()], program_id)
    }

    /// Derives the Fee Config PDA
    fn derive_fee_config_pda(fee_program_id: &Pubkey) -> (Pubkey, u8) {
        let fee_config_pubkey = Pubkey::new_from_array(FEE_CONFIG_PUBKEY);
        Pubkey::find_program_address(
            &[FEE_CONFIG_SEED, fee_config_pubkey.as_ref()],
            fee_program_id,
        )
    }

    /// Bonding curve account data structure (from IDL)
    /// Layout:
    ///   - discriminator: 8 bytes
    ///   - virtual_token_reserves: u64 (8 bytes)
    ///   - virtual_sol_reserves: u64 (8 bytes)
    ///   - real_token_reserves: u64 (8 bytes)
    ///   - real_sol_reserves: u64 (8 bytes)
    ///   - token_total_supply: u64 (8 bytes)
    ///   - complete: bool (1 byte)
    ///   - creator: pubkey (32 bytes)
    ///   - is_mayhem_mode: bool (1 byte)
    /// Total: 82 bytes
    #[derive(Debug, Clone)]
    pub struct BondingCurveData {
        pub virtual_token_reserves: u64,
        pub virtual_sol_reserves: u64,
        pub real_token_reserves: u64,
        pub real_sol_reserves: u64,
        pub token_total_supply: u64,
        pub complete: bool,
        pub creator: Pubkey,
        pub is_mayhem_mode: bool,
    }

    impl BondingCurveData {
        /// Parse from account data bytes
        pub fn try_from_bytes(data: &[u8]) -> Option<Self> {
            // Minimum size: 8 (discriminator) + 8*5 (u64s) + 1 (bool) + 32 (pubkey) + 1 (bool) = 82
            if data.len() < 82 {
                println!("Data too short: {} bytes, need at least 82", data.len());
                return None;
            }

            let mut offset = 8; // Skip anchor discriminator

            let virtual_token_reserves =
                u64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
            offset += 8;

            let virtual_sol_reserves =
                u64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
            offset += 8;

            let real_token_reserves = u64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
            offset += 8;

            let real_sol_reserves = u64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
            offset += 8;

            let token_total_supply = u64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
            offset += 8;

            let complete = data[offset] != 0;
            offset += 1;

            let creator_bytes: [u8; 32] = data[offset..offset + 32].try_into().ok()?;
            let creator = Pubkey::new_from_array(creator_bytes);
            offset += 32;

            let is_mayhem_mode = data[offset] != 0;

            Some(Self {
                virtual_token_reserves,
                virtual_sol_reserves,
                real_token_reserves,
                real_sol_reserves,
                token_total_supply,
                complete,
                creator,
                is_mayhem_mode,
            })
        }
    }

    /// Detect token program from mint account owner
    fn detect_token_program(client: &RpcClient, mint: &Pubkey) -> Pubkey {
        match client.get_account(mint) {
            Ok(account) => {
                let owner = account.owner;
                if owner == token_2022_program_id() {
                    println!("Detected Token-2022 program for mint");
                    token_2022_program_id()
                } else {
                    println!("Detected standard Token program for mint");
                    token_program_id()
                }
            }
            Err(_) => {
                println!("Could not fetch mint, defaulting to standard Token program");
                token_program_id()
            }
        }
    }

    /// Build the buy_exact_sol_in instruction
    fn build_buy_exact_sol_in_instruction(
        user: &Pubkey,
        mint: &Pubkey,
        spendable_sol_in: u64,
        min_tokens_out: u64,
        track_volume: u8,
        bonding_curve_data: &BondingCurveData,
        token_program: &Pubkey,
    ) -> Instruction {
        let pump_program_id = Pubkey::from_str(PUMP_FUN_PROGRAM_ID).unwrap();
        let fee_recipient = Pubkey::from_str(PUMP_FUN_FEE_RECIPIENT).unwrap();
        let fee_program = Pubkey::from_str(PUMP_FUN_FEE_PROGRAM).unwrap();

        // Derive PDAs
        let (global, _) = derive_global_pda(&pump_program_id);
        let (bonding_curve, _) = derive_bonding_curve_pda(&pump_program_id, mint);

        // Associated token accounts - using the correct token program
        let associated_bonding_curve =
            get_associated_token_address_with_program_id(&bonding_curve, mint, token_program);
        let associated_user =
            get_associated_token_address_with_program_id(user, mint, token_program);

        println!("Associated Bonding Curve ATA: {}", associated_bonding_curve);
        println!("Associated User ATA: {}", associated_user);

        // Creator vault (derived from bonding curve creator)
        let creator = bonding_curve_data.creator;
        let (creator_vault, _) = derive_creator_vault_pda(&pump_program_id, &creator);

        // Other PDAs
        let (event_authority, _) = derive_event_authority_pda(&pump_program_id);
        let (global_volume_accumulator, _) = derive_global_volume_accumulator_pda(&pump_program_id);
        let (user_volume_accumulator, _) =
            derive_user_volume_accumulator_pda(&pump_program_id, user);
        let (fee_config, _) = derive_fee_config_pda(&fee_program);

        // Build instruction data: discriminator (8) + spendable_sol_in (8) + min_tokens_out (8) + track_volume (1)
        let mut instruction_data = Vec::with_capacity(25);
        instruction_data.extend_from_slice(&BUY_EXACT_SOL_IN_DISCRIMINATOR);
        instruction_data.extend_from_slice(&spendable_sol_in.to_le_bytes());
        instruction_data.extend_from_slice(&min_tokens_out.to_le_bytes());
        instruction_data.push(track_volume);

        // Build accounts (per IDL order)
        let accounts = vec![
            AccountMeta::new_readonly(global, false),
            AccountMeta::new(fee_recipient, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(bonding_curve, false),
            AccountMeta::new(associated_bonding_curve, false),
            AccountMeta::new(associated_user, false),
            AccountMeta::new(*user, true),
            AccountMeta::new_readonly(system_program_id(), false),
            AccountMeta::new_readonly(*token_program, false),
            AccountMeta::new(creator_vault, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(pump_program_id, false),
            AccountMeta::new_readonly(global_volume_accumulator, false),
            AccountMeta::new(user_volume_accumulator, false),
            AccountMeta::new_readonly(fee_config, false),
            AccountMeta::new_readonly(fee_program, false),
        ];

        Instruction::new_with_bytes(pump_program_id, &instruction_data, accounts)
    }

    /// Build an instruction to create an associated token account if it doesn't exist
    fn build_create_ata_instruction(
        payer: &Pubkey,
        owner: &Pubkey,
        mint: &Pubkey,
        token_program: &Pubkey,
    ) -> Instruction {
        let ata_program = Pubkey::from_str(ASSOCIATED_TOKEN_PROGRAM).unwrap();
        let ata = get_associated_token_address_with_program_id(owner, mint, token_program);

        let accounts = vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(ata, false),
            AccountMeta::new_readonly(*owner, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(system_program_id(), false),
            AccountMeta::new_readonly(*token_program, false),
        ];

        Instruction::new_with_bytes(ata_program, &[], accounts)
    }

    #[test]
    fn test_pda_derivation() {
        let pump_program_id = Pubkey::from_str(PUMP_FUN_PROGRAM_ID).unwrap();
        let mint = Pubkey::from_str(TEST_MINT).unwrap();

        let (global, global_bump) = derive_global_pda(&pump_program_id);
        let (bonding_curve, bc_bump) = derive_bonding_curve_pda(&pump_program_id, &mint);
        let (event_authority, ea_bump) = derive_event_authority_pda(&pump_program_id);

        println!("=== PDA Derivation Results ===");
        println!("Pump.fun Program ID: {}", pump_program_id);
        println!("Mint: {}", mint);
        println!("Global PDA: {} (bump: {})", global, global_bump);
        println!("Bonding Curve PDA: {} (bump: {})", bonding_curve, bc_bump);
        println!(
            "Event Authority PDA: {} (bump: {})",
            event_authority, ea_bump
        );

        // Verify PDAs are not the system program
        assert_ne!(global, system_program_id());
        assert_ne!(bonding_curve, system_program_id());
        assert_ne!(event_authority, system_program_id());
    }

    #[test]
    fn test_fetch_accounts_from_localnet() {
        let client = get_rpc_client();
        let keypair = load_keypair();
        let user = keypair.pubkey();

        println!("=== Fetching Accounts from Localnet ===");
        println!("User pubkey: {}", user);

        // Check user balance
        match client.get_balance(&user) {
            Ok(balance) => {
                println!(
                    "User SOL balance: {} SOL",
                    balance as f64 / LAMPORTS_PER_SOL as f64
                );
                assert!(balance > 0, "User should have some SOL for testing");
            }
            Err(e) => {
                println!("Failed to get balance (is localnet running?): {:?}", e);
                println!("Skipping test - localnet may not be running");
                return;
            }
        }

        let pump_program_id = Pubkey::from_str(PUMP_FUN_PROGRAM_ID).unwrap();
        let mint = Pubkey::from_str(TEST_MINT).unwrap();

        // Detect token program
        let token_program = detect_token_program(&client, &mint);
        println!("Token program: {}", token_program);

        // Derive and fetch bonding curve
        let (bonding_curve, _) = derive_bonding_curve_pda(&pump_program_id, &mint);
        println!("Bonding Curve PDA: {}", bonding_curve);

        match client.get_account(&bonding_curve) {
            Ok(account) => {
                println!("Bonding Curve account found!");
                println!("  Owner: {}", account.owner);
                println!("  Lamports: {}", account.lamports);
                println!("  Data length: {} bytes", account.data.len());

                if let Some(bc_data) = BondingCurveData::try_from_bytes(&account.data) {
                    println!(
                        "  Virtual token reserves: {}",
                        bc_data.virtual_token_reserves
                    );
                    println!("  Virtual SOL reserves: {}", bc_data.virtual_sol_reserves);
                    println!("  Real token reserves: {}", bc_data.real_token_reserves);
                    println!("  Real SOL reserves: {}", bc_data.real_sol_reserves);
                    println!("  Creator: {}", bc_data.creator);
                    println!("  Complete: {}", bc_data.complete);
                }
            }
            Err(e) => {
                println!("Bonding curve not found: {:?}", e);
                println!("Note: This token may not exist on localnet.");
            }
        }

        // Check if mint exists and show its program
        match client.get_account(&mint) {
            Ok(account) => {
                println!("Mint account found!");
                println!("  Owner (Token Program): {}", account.owner);
            }
            Err(e) => {
                println!("Mint not found: {:?}", e);
            }
        }

        // Check associated token accounts
        let associated_bonding_curve =
            get_associated_token_address_with_program_id(&bonding_curve, &mint, &token_program);
        println!("Associated Bonding Curve ATA: {}", associated_bonding_curve);

        match client.get_account(&associated_bonding_curve) {
            Ok(account) => {
                println!("  ✅ ATA exists! Owner: {}", account.owner);
            }
            Err(_) => {
                println!("  ❌ ATA does not exist");
            }
        }
    }

    #[test]
    #[ignore] // Remove #[ignore] to run this test (it will execute a real transaction)
    fn test_buy_exact_sol_in_on_localnet() {
        let client = get_rpc_client();
        let keypair = load_keypair();
        let user = keypair.pubkey();

        println!("=== Buy Exact SOL In Test ===");
        println!("User: {}", user);

        // Check balance first
        let balance = match client.get_balance(&user) {
            Ok(b) => b,
            Err(e) => {
                println!("Failed to get balance: {:?}", e);
                println!("Make sure localnet is running: solana-test-validator");
                return;
            }
        };

        println!(
            "User SOL balance: {} SOL",
            balance as f64 / LAMPORTS_PER_SOL as f64
        );

        if balance < LAMPORTS_PER_SOL / 10 {
            println!("Insufficient balance for test. Need at least 0.1 SOL");
            return;
        }

        let pump_program_id = Pubkey::from_str(PUMP_FUN_PROGRAM_ID).unwrap();
        let mint = Pubkey::from_str(TEST_MINT).unwrap();

        // Detect the correct token program for this mint
        let token_program = detect_token_program(&client, &mint);
        println!("Using token program: {}", token_program);

        // Fetch bonding curve data
        let (bonding_curve, _) = derive_bonding_curve_pda(&pump_program_id, &mint);
        let bonding_curve_account = match client.get_account(&bonding_curve) {
            Ok(acc) => acc,
            Err(e) => {
                println!("Bonding curve not found: {:?}", e);
                println!("This token may not exist on localnet.");
                println!("You may need to clone mainnet state or create a mock.");
                return;
            }
        };

        let bonding_curve_data = match BondingCurveData::try_from_bytes(&bonding_curve_account.data)
        {
            Some(data) => data,
            None => {
                println!("Failed to parse bonding curve data");
                return;
            }
        };

        println!("Bonding curve creator: {}", bonding_curve_data.creator);

        // Check if user's ATA exists, if not, we need to create it first
        let user_ata = get_associated_token_address_with_program_id(&user, &mint, &token_program);
        let mut instructions = Vec::new();

        match client.get_account(&user_ata) {
            Ok(_) => {
                println!("User ATA already exists: {}", user_ata);
            }
            Err(_) => {
                println!("User ATA does not exist, will create: {}", user_ata);
                instructions.push(build_create_ata_instruction(
                    &user,
                    &user,
                    &mint,
                    &token_program,
                ));
            }
        }

        // Buy parameters
        let spendable_sol_in = 10_000_000; // 0.01 SOL
        let min_tokens_out = 1; // Minimum 1 token
        let track_volume = 0u8; // false (OptionBool::None)

        // Build buy instruction
        let buy_ix = build_buy_exact_sol_in_instruction(
            &user,
            &mint,
            spendable_sol_in,
            min_tokens_out,
            track_volume,
            &bonding_curve_data,
            &token_program,
        );

        instructions.push(buy_ix);

        println!("Instructions built successfully:");
        for (i, ix) in instructions.iter().enumerate() {
            println!(
                "  [{}] Program: {}, Accounts: {}, Data: {} bytes",
                i,
                ix.program_id,
                ix.accounts.len(),
                ix.data.len()
            );
        }

        // Get recent blockhash
        let recent_blockhash = client
            .get_latest_blockhash()
            .expect("Failed to get blockhash");

        // Create and sign transaction
        let message = Message::new(&instructions, Some(&user));
        let mut tx = Transaction::new_unsigned(message);
        tx.sign(&[&keypair], recent_blockhash);

        println!("Transaction signed, sending to localnet...");

        // Send and confirm transaction
        match client.send_and_confirm_transaction(&tx) {
            Ok(signature) => {
                println!("✅ Transaction successful!");
                println!("Signature: {}", signature);

                // Check new token balance
                if let Ok(token_account) = client.get_token_account_balance(&user_ata) {
                    println!(
                        "New token balance: {} tokens",
                        token_account.ui_amount.unwrap_or(0.0)
                    );
                }
            }
            Err(e) => {
                println!("❌ Transaction failed: {:?}", e);
            }
        }
    }

    #[test]
    fn test_instruction_data_serialization() {
        // Test that instruction data is properly serialized
        let spendable_sol_in: u64 = 10_000_000; // 0.01 SOL
        let min_tokens_out: u64 = 1;
        let track_volume: u8 = 0;

        let mut instruction_data = Vec::with_capacity(25);
        instruction_data.extend_from_slice(&BUY_EXACT_SOL_IN_DISCRIMINATOR);
        instruction_data.extend_from_slice(&spendable_sol_in.to_le_bytes());
        instruction_data.extend_from_slice(&min_tokens_out.to_le_bytes());
        instruction_data.push(track_volume);

        assert_eq!(instruction_data.len(), 25);
        assert_eq!(&instruction_data[0..8], &BUY_EXACT_SOL_IN_DISCRIMINATOR);
        assert_eq!(
            u64::from_le_bytes(instruction_data[8..16].try_into().unwrap()),
            spendable_sol_in
        );
        assert_eq!(
            u64::from_le_bytes(instruction_data[16..24].try_into().unwrap()),
            min_tokens_out
        );
        assert_eq!(instruction_data[24], track_volume);

        println!("=== Instruction Data Serialization ===");
        println!("Total length: {} bytes", instruction_data.len());
        println!("Discriminator: {:?}", &instruction_data[0..8]);
        println!("Spendable SOL in: {} lamports", spendable_sol_in);
        println!("Min tokens out: {}", min_tokens_out);
        println!("Track volume: {}", track_volume);
    }

    #[test]
    fn test_verify_program_exists_on_localnet() {
        let client = get_rpc_client();

        let pump_program_id = Pubkey::from_str(PUMP_FUN_PROGRAM_ID).unwrap();

        println!("=== Verifying Pump.fun Program on Localnet ===");
        println!("Program ID: {}", pump_program_id);

        match client.get_account(&pump_program_id) {
            Ok(account) => {
                println!("✅ Program account found!");
                println!("  Owner: {}", account.owner);
                println!("  Executable: {}", account.executable);
                println!("  Data length: {} bytes", account.data.len());
            }
            Err(e) => {
                println!("❌ Program not found: {:?}", e);
                println!("");
                println!("To test against Pump.fun, you need to:");
                println!(
                    "1. Clone mainnet state: solana-test-validator --clone {} --url mainnet-beta",
                    pump_program_id
                );
                println!("2. Or use devnet/mainnet RPC instead of localnet");
            }
        }
    }

    #[test]
    fn test_ata_derivation() {
        let client = get_rpc_client();
        let pump_program_id = Pubkey::from_str(PUMP_FUN_PROGRAM_ID).unwrap();
        let mint = Pubkey::from_str(TEST_MINT).unwrap();

        println!("=== ATA Derivation Test ===");

        // Detect token program
        let token_program = detect_token_program(&client, &mint);

        // Derive bonding curve
        let (bonding_curve, _) = derive_bonding_curve_pda(&pump_program_id, &mint);
        println!("Bonding Curve: {}", bonding_curve);

        // Derive ATAs with both token programs for comparison
        let ata_token = get_associated_token_address_with_program_id(
            &bonding_curve,
            &mint,
            &token_program_id(),
        );
        let ata_token_2022 = get_associated_token_address_with_program_id(
            &bonding_curve,
            &mint,
            &token_2022_program_id(),
        );

        println!("ATA (Token Program): {}", ata_token);
        println!("ATA (Token-2022): {}", ata_token_2022);
        println!(
            "Using: {} (detected: {})",
            if token_program == token_2022_program_id() {
                "Token-2022"
            } else {
                "Token"
            },
            token_program
        );

        // Check which one actually exists on-chain
        println!("\nChecking on-chain:");
        match client.get_account(&ata_token) {
            Ok(_) => println!("  ✅ Token ATA exists"),
            Err(_) => println!("  ❌ Token ATA does not exist"),
        }
        match client.get_account(&ata_token_2022) {
            Ok(_) => println!("  ✅ Token-2022 ATA exists"),
            Err(_) => println!("  ❌ Token-2022 ATA does not exist"),
        }
    }
}
