/**
 * TypeScript unit test for Raydium CPMM swap_base_output instruction
 *
 * This instruction swaps with a fixed output amount (amount_out) and maximum input.
 *
 * Test: Swap Token -> SOL (92dmHZPDm4a9vXtvQVJtEYoDDZpsHYci8NWCrBk5AKgX -> WSOL)
 *
 * Pool State: 4ooXj2GZ9H3kUeYQBfVnW722UxNCvPe2tJH1hSTNZoDi
 * Token0: WSOL (So11111111111111111111111111111111111111112)
 * Token1: 92dmHZPDm4a9vXtvQVJtEYoDDZpsHYci8NWCrBk5AKgX
 */

import {
	address,
	appendTransactionMessageInstructions,
	createSolanaRpc,
	createSolanaRpcSubscriptions,
	createTransactionMessage,
	getSignatureFromTransaction,
	type Instruction,
	isSolanaError,
	pipe,
	sendAndConfirmTransactionFactory,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners
} from "@solana/kit"
import {
	getRaydiumCpmmSwapBaseOutInstruction,
	RAYDIUM_CPMM_SWAP_BASE_OUT_DISCRIMINATOR
} from "../../clients/dexs/js/src/generated"
import {
	ASSOCIATED_TOKEN_PROGRAM,
	ataExists,
	getAssociatedTokenAddress,
	getTokenBalance,
	LAMPORTS_PER_SOL,
	loadKeypair,
	RAYDIUM_CPMM_PROGRAM_ID,
	RPC_URL,
	SYSTEM_PROGRAM,
	TOKEN_PROGRAM,
	WSS_URL
} from "./raydium_cpmm_utils"

// ============================================================================
// Pool Configuration (from the provided tx data)
// ============================================================================

const POOL_STATE = address("4ooXj2GZ9H3kUeYQBfVnW722UxNCvPe2tJH1hSTNZoDi")
const AMM_CONFIG = address("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2")
const AUTHORITY = address("GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL")
const TOKEN0_MINT = address("So11111111111111111111111111111111111111112") // WSOL
const TOKEN1_MINT = address("92dmHZPDm4a9vXtvQVJtEYoDDZpsHYci8NWCrBk5AKgX")
const TOKEN0_VAULT = address("GGGhvns7bi6vPyvo7okAWxnYD3JwYUwu899KbKLbqepn")
const TOKEN1_VAULT = address("eoTHSRxkUfwCT6Zd1rb2sMtoDsbCGf75owSWJC3hJuS")
const OBSERVATION_STATE = address("9K1rfUmumSHgUTiuJJVd3Kpnx1zrJFHGQ5hkhbkR6NTs")

// ============================================================================
// Types
// ============================================================================

type AddressType = ReturnType<typeof address>

// ============================================================================
// Helper functions for WSOL
// ============================================================================

function createCloseAccountInstruction(
	account: AddressType,
	destination: AddressType,
	owner: AddressType
): Instruction {
	return {
		programAddress: TOKEN_PROGRAM,
		accounts: [
			{ address: account, role: 1 },
			{ address: destination, role: 1 },
			{ address: owner, role: 2 }
		],
		data: new Uint8Array([9])
	}
}

function createCreateAtaInstruction(
	payer: AddressType,
	ata: AddressType,
	owner: AddressType,
	mint: AddressType,
	tokenProgram: AddressType
): Instruction {
	return {
		programAddress: ASSOCIATED_TOKEN_PROGRAM,
		accounts: [
			{ address: payer, role: 3 },
			{ address: ata, role: 1 },
			{ address: owner, role: 0 },
			{ address: mint, role: 0 },
			{ address: SYSTEM_PROGRAM, role: 0 },
			{ address: tokenProgram, role: 0 }
		],
		data: new Uint8Array([])
	}
}

// ============================================================================
// Main Test
// ============================================================================

async function testSwapBaseOutput() {
	console.log("=== Raydium CPMM Swap Base Output Test ===\n")
	console.log("This test performs a swap with FIXED OUTPUT amount")
	console.log("Direction: Token -> SOL (Token1 -> WSOL)\n")

	// Create RPC connection
	const rpc = createSolanaRpc(RPC_URL)
	const rpcSubscriptions = createSolanaRpcSubscriptions(WSS_URL)

	// Load keypair
	const signer = await loadKeypair()
	const userAddress = signer.address
	console.log("User:", userAddress)

	// Check SOL balance
	const balanceResult = await rpc.getBalance(userAddress).send()
	const initialSolBalance = balanceResult.value
	console.log(`User SOL balance: ${Number(initialSolBalance) / Number(LAMPORTS_PER_SOL)} SOL`)

	// Derive user's ATAs
	const userWsolAta = await getAssociatedTokenAddress(userAddress, TOKEN0_MINT, TOKEN_PROGRAM)
	const userTokenAta = await getAssociatedTokenAddress(userAddress, TOKEN1_MINT, TOKEN_PROGRAM)

	console.log("\n=== Accounts ===")
	console.log("Pool State:", POOL_STATE)
	console.log("AMM Config:", AMM_CONFIG)
	console.log("Authority:", AUTHORITY)
	console.log("Token0 (WSOL):", TOKEN0_MINT)
	console.log("Token1:", TOKEN1_MINT)
	console.log("User WSOL ATA:", userWsolAta)
	console.log("User Token ATA:", userTokenAta)

	// Check if ATAs exist
	const wsolAtaExists = await ataExists(rpc, userWsolAta)
	const tokenAtaExists = await ataExists(rpc, userTokenAta)

	console.log(`\nWSOL ATA exists: ${wsolAtaExists}`)
	console.log(`Token ATA exists: ${tokenAtaExists}`)

	// Get initial balances
	const initialTokenBalance = tokenAtaExists ? await getTokenBalance(rpc, userTokenAta) : BigInt(0)
	console.log(`Initial Token Balance: ${initialTokenBalance?.toString() ?? "0"}`)

	if (!tokenAtaExists || (initialTokenBalance ?? BigInt(0)) === BigInt(0)) {
		console.log("\n❌ No tokens to swap!")
		console.log("Please run the swap_base_input test first to get some tokens.")
		return
	}

	// Swap parameters for swap_base_output
	// Input: Token1, Output: WSOL
	const amountOut = BigInt(5_000_000) // 0.005 SOL (fixed output)
	const maxAmountIn = initialTokenBalance ?? BigInt(0) // Use all tokens as max

	console.log("\n=== Swap Parameters (Base Output) ===")
	console.log(`Amount Out: ${Number(amountOut) / 1e9} SOL (fixed output)`)
	console.log(`Max Amount In: ${maxAmountIn.toString()} tokens (maximum willing to spend)`)

	// Build the swap instruction
	const swapInstruction = getRaydiumCpmmSwapBaseOutInstruction({
		payer: signer,
		authority: AUTHORITY,
		ammConfig: AMM_CONFIG,
		poolState: POOL_STATE,
		inputTokenAccount: userTokenAta,
		outputTokenAccount: userWsolAta,
		inputVault: TOKEN1_VAULT,
		outputVault: TOKEN0_VAULT,
		inputTokenProgram: TOKEN_PROGRAM,
		outputTokenProgram: TOKEN_PROGRAM,
		inputTokenMint: TOKEN1_MINT,
		outputTokenMint: TOKEN0_MINT,
		observationState: OBSERVATION_STATE,
		raydiumProgram: RAYDIUM_CPMM_PROGRAM_ID,
		maxAmountIn,
		amountOut
	})

	// Patch discriminator for our CPI wrapper
	const patchedData = new Uint8Array(swapInstruction.data)
	patchedData[0] = RAYDIUM_CPMM_SWAP_BASE_OUT_DISCRIMINATOR

	const patchedSwapInstruction: Instruction = {
		programAddress: swapInstruction.programAddress,
		accounts: swapInstruction.accounts,
		data: patchedData
	}

	console.log(`\nDiscriminator: ${patchedData[0]} (RaydiumCpmmSwapBaseOut)`)

	// Build instructions array
	const instructions: Instruction[] = []

	// 1. Create WSOL ATA if needed (to receive the WSOL output)
	if (!wsolAtaExists) {
		console.log("Adding: Create WSOL ATA instruction")
		instructions.push(
			createCreateAtaInstruction(userAddress, userWsolAta, userAddress, TOKEN0_MINT, TOKEN_PROGRAM)
		)
	}

	// 2. Swap (Token -> WSOL)
	console.log("Adding: Swap instruction")
	instructions.push(patchedSwapInstruction)

	// 3. Close WSOL ATA to unwrap SOL
	console.log("Adding: Close WSOL ATA (unwrap SOL)")
	instructions.push(createCloseAccountInstruction(userWsolAta, userAddress, userAddress))

	// Get recent blockhash
	const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

	// Build transaction message
	const transactionMessage = pipe(
		createTransactionMessage({ version: 0 }),
		tx => setTransactionMessageFeePayerSigner(signer, tx),
		tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
		tx => appendTransactionMessageInstructions(instructions, tx)
	)

	// Sign transaction
	const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)

	console.log("\nTransaction signed, sending to localnet...")

	// Send and confirm
	try {
		const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
			rpc,
			rpcSubscriptions
		})

		await (
			sendAndConfirmTransaction as (tx: unknown, opts: { commitment: string }) => Promise<void>
		)(signedTransaction, { commitment: "confirmed" })

		const signature = getSignatureFromTransaction(signedTransaction)
		console.log("\n✅ Transaction successful!")
		console.log("Signature:", signature)

		// Check new balances
		const newTokenBalance = await getTokenBalance(rpc, userTokenAta)
		console.log(`\nNew Token Balance: ${newTokenBalance?.toString() ?? "0"}`)

		const tokensSpent = (initialTokenBalance ?? BigInt(0)) - (newTokenBalance ?? BigInt(0))
		console.log(`Tokens Spent: ${tokensSpent.toString()}`)

		// Check new SOL balance
		const newSolBalance = await rpc.getBalance(userAddress).send()
		console.log(`New SOL Balance: ${Number(newSolBalance.value) / 1e9} SOL`)

		const solReceived = Number(newSolBalance.value - initialSolBalance) / 1e9
		console.log(`SOL Received (approx): ${solReceived.toFixed(6)} SOL`)
	} catch (e: unknown) {
		console.error("\n❌ Transaction failed:")
		if (isSolanaError(e)) {
			console.error("Solana error:", e.message)
			if ("context" in e && e.context) {
				const replacer = (_key: string, value: unknown) =>
					typeof value === "bigint" ? value.toString() : value
				console.error("Error context:", JSON.stringify(e.context, replacer, 2))
			}
		} else if (e instanceof Error) {
			console.error("Error:", e.message)
			console.error("Full error:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2))
		} else {
			console.error("Unknown error:", e)
		}
	}
}

// Run the test
testSwapBaseOutput().catch(console.error)
