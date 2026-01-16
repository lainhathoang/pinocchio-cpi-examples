/**
 * TypeScript unit test for Raydium CPMM swap_base_input instruction
 *
 * This instruction swaps with a fixed input amount (amount_in) and minimum expected output.
 *
 * Test: Swap SOL -> Token (WSOL -> 92dmHZPDm4a9vXtvQVJtEYoDDZpsHYci8NWCrBk5AKgX)
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
	getRaydiumCpmmSwapBaseInInstruction,
	RAYDIUM_CPMM_SWAP_BASE_IN_DISCRIMINATOR
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

function createSyncNativeInstruction(account: AddressType): Instruction {
	return {
		programAddress: TOKEN_PROGRAM,
		accounts: [{ address: account, role: 1 }],
		data: new Uint8Array([17])
	}
}

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

function createTransferSolInstruction(
	from: AddressType,
	to: AddressType,
	lamports: bigint
): Instruction {
	const data = new Uint8Array(12)
	data[0] = 2 // Transfer instruction
	const view = new DataView(data.buffer)
	view.setBigUint64(4, lamports, true)

	return {
		programAddress: SYSTEM_PROGRAM,
		accounts: [
			{ address: from, role: 3 },
			{ address: to, role: 1 }
		],
		data
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

async function testSwapBaseInput() {
	console.log("=== Raydium CPMM Swap Base Input Test ===\n")
	console.log("This test performs a swap with FIXED INPUT amount")
	console.log("Direction: SOL (WSOL) -> Token\n")

	// Create RPC connection
	const rpc = createSolanaRpc(RPC_URL)
	const rpcSubscriptions = createSolanaRpcSubscriptions(WSS_URL)

	// Load keypair
	const signer = await loadKeypair()
	const userAddress = signer.address
	console.log("User:", userAddress)

	// Check SOL balance
	const balanceResult = await rpc.getBalance(userAddress).send()
	const balance = balanceResult.value
	console.log(`User SOL balance: ${Number(balance) / Number(LAMPORTS_PER_SOL)} SOL`)

	if (balance < LAMPORTS_PER_SOL / BigInt(10)) {
		console.log("Insufficient balance for test. Need at least 0.1 SOL")
		return
	}

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

	// Swap parameters
	const amountIn = BigInt(10_000_000) // 0.01 SOL
	const minimumAmountOut = BigInt(1) // Minimum 1 token

	console.log("\n=== Swap Parameters ===")
	console.log(`Amount In: ${Number(amountIn) / 1e9} SOL (fixed input)`)
	console.log(`Minimum Amount Out: ${minimumAmountOut.toString()} tokens`)

	// Build the swap instruction
	const swapInstruction = getRaydiumCpmmSwapBaseInInstruction({
		payer: signer,
		authority: AUTHORITY,
		ammConfig: AMM_CONFIG,
		poolState: POOL_STATE,
		inputTokenAccount: userWsolAta,
		outputTokenAccount: userTokenAta,
		inputVault: TOKEN0_VAULT,
		outputVault: TOKEN1_VAULT,
		inputTokenProgram: TOKEN_PROGRAM,
		outputTokenProgram: TOKEN_PROGRAM,
		inputTokenMint: TOKEN0_MINT,
		outputTokenMint: TOKEN1_MINT,
		observationState: OBSERVATION_STATE,
		raydiumProgram: RAYDIUM_CPMM_PROGRAM_ID,
		amountIn,
		minimumAmountOut
	})

	// Patch discriminator for our CPI wrapper
	const patchedData = new Uint8Array(swapInstruction.data)
	patchedData[0] = RAYDIUM_CPMM_SWAP_BASE_IN_DISCRIMINATOR

	const patchedSwapInstruction: Instruction = {
		programAddress: swapInstruction.programAddress,
		accounts: swapInstruction.accounts,
		data: patchedData
	}

	console.log(`\nDiscriminator: ${patchedData[0]} (RaydiumCpmmSwapBaseIn)`)

	// Build instructions array
	const instructions: Instruction[] = []

	// 1. Create WSOL ATA if needed
	if (!wsolAtaExists) {
		console.log("Adding: Create WSOL ATA instruction")
		instructions.push(
			createCreateAtaInstruction(userAddress, userWsolAta, userAddress, TOKEN0_MINT, TOKEN_PROGRAM)
		)
	}

	// 2. Create Token ATA if needed
	if (!tokenAtaExists) {
		console.log("Adding: Create Token ATA instruction")
		instructions.push(
			createCreateAtaInstruction(userAddress, userTokenAta, userAddress, TOKEN1_MINT, TOKEN_PROGRAM)
		)
	}

	// 3. Transfer SOL to WSOL ATA (for wrapping)
	console.log("Adding: Transfer SOL to WSOL ATA")
	instructions.push(createTransferSolInstruction(userAddress, userWsolAta, amountIn))

	// 4. Sync native (wrap SOL)
	console.log("Adding: Sync Native (wrap SOL)")
	instructions.push(createSyncNativeInstruction(userWsolAta))

	// 5. Swap
	console.log("Adding: Swap instruction")
	instructions.push(patchedSwapInstruction)

	// 6. Close WSOL ATA to get remaining SOL back
	console.log("Adding: Close WSOL ATA")
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

		// Check new token balance
		const newTokenBalance = await getTokenBalance(rpc, userTokenAta)
		console.log(`\nNew Token Balance: ${newTokenBalance?.toString() ?? "0"}`)

		const tokensReceived = (newTokenBalance ?? BigInt(0)) - (initialTokenBalance ?? BigInt(0))
		console.log(`Tokens Received: ${tokensReceived.toString()}`)

		// Check new SOL balance
		const newSolBalance = await rpc.getBalance(userAddress).send()
		console.log(`New SOL Balance: ${Number(newSolBalance.value) / 1e9} SOL`)
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
testSwapBaseInput().catch(console.error)
