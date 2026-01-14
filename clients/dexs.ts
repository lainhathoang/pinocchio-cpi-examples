/**
 * TypeScript unit test for Pump.fun buy_exact_sol_in instruction
 *
 * Migrated from: advances/dexs/tests/pump_fun.rs
 *
 * Prerequisites:
 * - Run a local Solana validator: `solana-test-validator`
 * - Ensure the keypair at `~/.config/solana/id.json` has sufficient SOL
 *
 * Test token: EtxQtkw2Xpwm1Hn1jMgMSJMFtX97eyQ3E3JrqXeYpump
 */

import * as fs from "node:fs"
import {
	type Address,
	address,
	appendTransactionMessageInstruction,
	createKeyPairSignerFromBytes,
	createSolanaRpc,
	createSolanaRpcSubscriptions,
	createTransactionMessage,
	getAddressDecoder,
	getAddressEncoder,
	getProgramDerivedAddress,
	getSignatureFromTransaction,
	isSolanaError,
	pipe,
	sendAndConfirmTransactionFactory,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
	type TransactionSigner
} from "@solana/kit"
import {
	getPumpFunBuyExactSolInInstruction,
	PUMP_FUN_BUY_EXACT_SOL_IN_DISCRIMINATOR
} from "./dexs/js/src/generated"

// ============================================================================
// Constants
// ============================================================================

// Pump.fun program constants
const PUMP_FUN_PROGRAM_ID = address("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
const PUMP_FUN_FEE_RECIPIENT = address("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV")
const PUMP_FUN_FEE_PROGRAM = address("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ")
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const TOKEN_2022_PROGRAM = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
const SYSTEM_PROGRAM = address("11111111111111111111111111111111")
const ASSOCIATED_TOKEN_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

// Test token
const TEST_MINT = address("EtxQtkw2Xpwm1Hn1jMgMSJMFtX97eyQ3E3JrqXeYpump")

// Seeds for PDA derivation (from IDL)
const GLOBAL_SEED = new TextEncoder().encode("global")
const BONDING_CURVE_SEED = new TextEncoder().encode("bonding-curve")
const CREATOR_VAULT_SEED = new TextEncoder().encode("creator-vault")
const EVENT_AUTHORITY_SEED = new TextEncoder().encode("__event_authority")
const GLOBAL_VOLUME_ACCUMULATOR_SEED = new TextEncoder().encode("global_volume_accumulator")
const USER_VOLUME_ACCUMULATOR_SEED = new TextEncoder().encode("user_volume_accumulator")
const FEE_CONFIG_SEED = new TextEncoder().encode("fee_config")

// Fee config pubkey constant (from IDL)
const FEE_CONFIG_PUBKEY = new Uint8Array([
	1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81, 137, 203, 151, 245,
	210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176
])

// Lamports per SOL
const LAMPORTS_PER_SOL = BigInt(1_000_000_000)

// RPC endpoints
const RPC_URL = "http://127.0.0.1:8899"
const WSS_URL = "ws://127.0.0.1:8900"

// ============================================================================
// Helper: Convert Address to bytes
// ============================================================================

function addressToBytes(addr: Address): Uint8Array {
	const encoded = getAddressEncoder().encode(addr)
	return new Uint8Array(encoded)
}

function bytesToAddress(bytes: Uint8Array): Address {
	return getAddressDecoder().decode(bytes)
}

// ============================================================================
// PDA Derivation Functions
// ============================================================================

async function deriveGlobalPda(programId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [GLOBAL_SEED]
	})
	return [result[0], result[1]]
}

async function deriveBondingCurvePda(
	programId: Address,
	mint: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [BONDING_CURVE_SEED, addressToBytes(mint)]
	})
	return [result[0], result[1]]
}

async function deriveCreatorVaultPda(
	programId: Address,
	creator: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [CREATOR_VAULT_SEED, addressToBytes(creator)]
	})
	return [result[0], result[1]]
}

async function deriveEventAuthorityPda(programId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [EVENT_AUTHORITY_SEED]
	})
	return [result[0], result[1]]
}

async function deriveGlobalVolumeAccumulatorPda(programId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [GLOBAL_VOLUME_ACCUMULATOR_SEED]
	})
	return [result[0], result[1]]
}

async function deriveUserVolumeAccumulatorPda(
	programId: Address,
	user: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [USER_VOLUME_ACCUMULATOR_SEED, addressToBytes(user)]
	})
	return [result[0], result[1]]
}

async function deriveFeeConfigPda(feeProgramId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: feeProgramId,
		seeds: [FEE_CONFIG_SEED, FEE_CONFIG_PUBKEY]
	})
	return [result[0], result[1]]
}

// ============================================================================
// Associated Token Account Derivation
// ============================================================================

async function getAssociatedTokenAddress(
	owner: Address,
	mint: Address,
	tokenProgram: Address
): Promise<Address> {
	const [ata] = await getProgramDerivedAddress({
		programAddress: ASSOCIATED_TOKEN_PROGRAM,
		seeds: [addressToBytes(owner), addressToBytes(tokenProgram), addressToBytes(mint)]
	})
	return ata
}

// ============================================================================
// Bonding Curve Data Structure
// ============================================================================

interface BondingCurveData {
	virtualTokenReserves: bigint
	virtualSolReserves: bigint
	realTokenReserves: bigint
	realSolReserves: bigint
	tokenTotalSupply: bigint
	complete: boolean
	creator: Address
	isMayhemMode: boolean
}

function parseBondingCurveData(data: Uint8Array): BondingCurveData | null {
	// Minimum size: 8 (discriminator) + 8*5 (u64s) + 1 (bool) + 32 (pubkey) + 1 (bool) = 82
	if (data.length < 82) {
		console.log(`Data too short: ${data.length} bytes, need at least 82`)
		return null
	}

	const view = new DataView(data.buffer, data.byteOffset)
	let offset = 8 // Skip anchor discriminator

	const virtualTokenReserves = view.getBigUint64(offset, true)
	offset += 8

	const virtualSolReserves = view.getBigUint64(offset, true)
	offset += 8

	const realTokenReserves = view.getBigUint64(offset, true)
	offset += 8

	const realSolReserves = view.getBigUint64(offset, true)
	offset += 8

	const tokenTotalSupply = view.getBigUint64(offset, true)
	offset += 8

	const complete = data[offset] !== 0
	offset += 1

	const creatorBytes = data.slice(offset, offset + 32)
	const creator = bytesToAddress(creatorBytes)
	offset += 32

	const isMayhemMode = data[offset] !== 0

	return {
		virtualTokenReserves,
		virtualSolReserves,
		realTokenReserves,
		realSolReserves,
		tokenTotalSupply,
		complete,
		creator,
		isMayhemMode
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

async function loadKeypair(): Promise<TransactionSigner> {
	const keypairPath = `${process.env.HOME}/.config/solana/id.json`
	const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8")) as number[]
	const secretKey = new Uint8Array(keypairData)
	return await createKeyPairSignerFromBytes(secretKey)
}

async function detectTokenProgram(
	rpc: ReturnType<typeof createSolanaRpc>,
	mint: Address
): Promise<Address> {
	try {
		const accountInfo = await rpc.getAccountInfo(mint, { encoding: "base64" }).send()
		if (accountInfo.value) {
			const owner = accountInfo.value.owner
			if (owner === TOKEN_2022_PROGRAM) {
				console.log("Detected Token-2022 program for mint")
				return TOKEN_2022_PROGRAM
			}
		}
		console.log("Detected standard Token program for mint")
		return TOKEN_PROGRAM
	} catch {
		console.log("Could not fetch mint, defaulting to standard Token program")
		return TOKEN_PROGRAM
	}
}

// ============================================================================
// Main Test
// ============================================================================

async function testBuyExactSolIn() {
	console.log("=== Buy Exact SOL In Test (TypeScript) ===\n")

	// Create RPC connection
	const rpc = createSolanaRpc(RPC_URL)
	const rpcSubscriptions = createSolanaRpcSubscriptions(WSS_URL)

	// Load keypair
	let signer: TransactionSigner
	try {
		signer = await loadKeypair()
	} catch (e) {
		console.error("Failed to load keypair:", e)
		console.log("Ensure ~/.config/solana/id.json exists")
		return
	}

	const userAddress = signer.address
	console.log("User:", userAddress)

	// Check balance
	let balance: bigint
	try {
		const balanceResult = await rpc.getBalance(userAddress).send()
		balance = balanceResult.value
	} catch (e) {
		console.error("Failed to get balance:", e)
		console.log("Make sure localnet is running: solana-test-validator")
		return
	}

	console.log(`User SOL balance: ${Number(balance) / Number(LAMPORTS_PER_SOL)} SOL`)

	if (balance < LAMPORTS_PER_SOL / BigInt(10)) {
		console.log("Insufficient balance for test. Need at least 0.1 SOL")
		return
	}

	// Detect the correct token program for this mint
	const tokenProgram = await detectTokenProgram(rpc, TEST_MINT)
	console.log("Using token program:", tokenProgram)

	// Fetch bonding curve data
	const [bondingCurve, bcBump] = await deriveBondingCurvePda(PUMP_FUN_PROGRAM_ID, TEST_MINT)
	console.log("Bonding Curve PDA:", bondingCurve)

	let bondingCurveRawData: Uint8Array
	try {
		const bondingCurveAccountInfo = await rpc
			.getAccountInfo(bondingCurve, { encoding: "base64" })
			.send()
		if (!bondingCurveAccountInfo.value) {
			console.log("Bonding curve not found")
			console.log("This token may not exist on localnet.")
			console.log("You may need to clone mainnet state or create a mock.")
			return
		}

		// Decode base64 account data
		const accountData = bondingCurveAccountInfo.value.data
		if (Array.isArray(accountData)) {
			// [base64Data, encoding]
			bondingCurveRawData = new Uint8Array(Buffer.from(accountData[0], "base64"))
		} else {
			console.log("Unexpected account data format")
			return
		}
	} catch (e) {
		console.error("Failed to fetch bonding curve:", e)
		return
	}

	const bondingCurveData = parseBondingCurveData(bondingCurveRawData)
	if (!bondingCurveData) {
		console.log("Failed to parse bonding curve data")
		return
	}

	console.log("Bonding curve creator:", bondingCurveData.creator)
	console.log("Virtual token reserves:", bondingCurveData.virtualTokenReserves.toString())
	console.log("Virtual SOL reserves:", bondingCurveData.virtualSolReserves.toString())

	// Derive all required PDAs
	const [global] = await deriveGlobalPda(PUMP_FUN_PROGRAM_ID)
	const [creatorVault] = await deriveCreatorVaultPda(PUMP_FUN_PROGRAM_ID, bondingCurveData.creator)
	const [eventAuthority] = await deriveEventAuthorityPda(PUMP_FUN_PROGRAM_ID)
	const [globalVolumeAccumulator] = await deriveGlobalVolumeAccumulatorPda(PUMP_FUN_PROGRAM_ID)
	const [userVolumeAccumulator] = await deriveUserVolumeAccumulatorPda(
		PUMP_FUN_PROGRAM_ID,
		userAddress
	)
	const [feeConfig] = await deriveFeeConfigPda(PUMP_FUN_FEE_PROGRAM)

	// Derive ATAs
	const associatedBondingCurve = await getAssociatedTokenAddress(
		bondingCurve,
		TEST_MINT,
		tokenProgram
	)
	const associatedUser = await getAssociatedTokenAddress(userAddress, TEST_MINT, tokenProgram)

	console.log("\n=== PDAs ===")
	console.log("Global:", global)
	console.log("Creator Vault:", creatorVault)
	console.log("Event Authority:", eventAuthority)
	console.log("Global Volume Accumulator:", globalVolumeAccumulator)
	console.log("User Volume Accumulator:", userVolumeAccumulator)
	console.log("Fee Config:", feeConfig)
	console.log("Associated Bonding Curve:", associatedBondingCurve)
	console.log("Associated User:", associatedUser)

	// Check if user's ATA exists, track if we need to create it
	let needsCreateAta = false
	try {
		const ataInfo = await rpc.getAccountInfo(associatedUser).send()
		if (!ataInfo.value) {
			needsCreateAta = true
			console.log("\nUser ATA does not exist, will create it")
		} else {
			console.log("\nUser ATA already exists")
		}
	} catch {
		needsCreateAta = true
		console.log("\nUser ATA does not exist, will create it")
	}

	// Buy parameters
	const spendableSolIn = BigInt(10_000_000) // 0.01 SOL
	const minTokensOut = BigInt(1) // Minimum 1 token
	const trackVolume = null // None (OptionBool::None)

	// Build the instruction using generated client
	// Note: The generated client uses discriminator 0, but our program expects 12
	// We need to patch the instruction data
	const generatedInstruction = getPumpFunBuyExactSolInInstruction({
		global,
		feeRecipient: PUMP_FUN_FEE_RECIPIENT,
		mint: TEST_MINT,
		bondingCurve,
		associatedBondingCurve,
		associatedUser,
		user: signer,
		systemProgram: SYSTEM_PROGRAM,
		tokenProgram,
		creatorVault,
		eventAuthority,
		program: PUMP_FUN_PROGRAM_ID,
		globalVolumeAccumulator,
		userVolumeAccumulator,
		feeConfig,
		feeProgram: PUMP_FUN_FEE_PROGRAM,
		bump: bcBump,
		spendableSolIn,
		minTokensOut,
		trackVolume
	})

	// Fix the discriminator: program expects 1 (PumpFunBuyExactSolIn), generated uses 0
	const patchedData = new Uint8Array(generatedInstruction.data)
	patchedData[0] = PUMP_FUN_BUY_EXACT_SOL_IN_DISCRIMINATOR

	const buyInstruction = {
		...generatedInstruction,
		data: patchedData
	}

	console.log("\n=== Building Transaction ===")
	console.log(`Spending: ${Number(spendableSolIn) / 1e9} SOL`)
	console.log(`Min tokens out: ${minTokensOut}`)
	console.log(`Discriminator: ${patchedData[0]} (patched from 0 to 1)`)

	// Get recent blockhash
	const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

	// Build transaction - start with the base message
	const baseMessage = pipe(
		createTransactionMessage({ version: 0 }),
		tx => setTransactionMessageFeePayerSigner(signer, tx),
		tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
	)

	// Build the final transaction message with all instructions
	// We need to add create ATA instruction first if needed, then the buy instruction
	const transactionMessage = needsCreateAta
		? pipe(
				baseMessage,
				tx => {
					console.log("Adding Create ATA instruction...")
					// Create ATA instruction
					const createAtaIx = {
						programAddress: ASSOCIATED_TOKEN_PROGRAM,
						accounts: [
							{ address: userAddress, role: 3 as const }, // payer (writable, signer)
							{ address: associatedUser, role: 1 as const }, // ata (writable)
							{ address: userAddress, role: 0 as const }, // owner (readonly)
							{ address: TEST_MINT, role: 0 as const }, // mint (readonly)
							{ address: SYSTEM_PROGRAM, role: 0 as const }, // system program
							{ address: tokenProgram, role: 0 as const } // token program
						],
						data: new Uint8Array([])
					}
					return appendTransactionMessageInstruction(createAtaIx, tx)
				},
				tx => appendTransactionMessageInstruction(buyInstruction, tx)
			)
		: appendTransactionMessageInstruction(buyInstruction, baseMessage)

	// Sign transaction
	const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)

	console.log("\nTransaction signed, sending to localnet...")

	// Send and confirm
	try {
		const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
			rpc,
			rpcSubscriptions
		})

		// @ts-expect-error - Type compatibility issue with @solana/kit transaction types
		await sendAndConfirmTransaction(signedTransaction, {
			commitment: "confirmed"
		})

		const signature = getSignatureFromTransaction(signedTransaction)
		console.log("\n✅ Transaction successful!")
		console.log("Signature:", signature)

		// Check new token balance
		try {
			const tokenBalance = await rpc.getTokenAccountBalance(associatedUser).send()
			console.log(`New token balance: ${tokenBalance.value.uiAmountString} tokens`)
		} catch {
			console.log("Could not fetch token balance")
		}
	} catch (e: unknown) {
		console.error("\n❌ Transaction failed:")
		if (isSolanaError(e)) {
			console.error("Solana error:", e.message)
			// Print full error context if available
			if ("context" in e && e.context) {
				const replacer = (_key: string, value: unknown) =>
					typeof value === "bigint" ? value.toString() : value
				console.error("Error context:", JSON.stringify(e.context, replacer, 2))
			}
		} else if (e instanceof Error) {
			console.error("Error:", e.message)
			// Try to extract more info from the error
			const errorStr = JSON.stringify(e, Object.getOwnPropertyNames(e), 2)
			console.error("Full error:", errorStr)
		} else {
			console.error("Unknown error:", e)
		}
	}
}

// Run the test
testBuyExactSolIn().catch(console.error)
