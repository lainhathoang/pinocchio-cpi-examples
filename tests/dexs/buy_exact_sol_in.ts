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

import {
	appendTransactionMessageInstruction,
	createSolanaRpc,
	createSolanaRpcSubscriptions,
	createTransactionMessage,
	getSignatureFromTransaction,
	isSolanaError,
	pipe,
	sendAndConfirmTransactionFactory,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners
} from "@solana/kit"
import {
	getPumpFunBuyExactSolInInstruction,
	PUMP_FUN_BUY_EXACT_SOL_IN_DISCRIMINATOR
} from "../../clients/dexs/js/src/generated"
import {
	ASSOCIATED_TOKEN_PROGRAM,
	ataExists,
	deriveGlobalVolumeAccumulatorPda,
	derivePumpFunAccounts,
	deriveUserVolumeAccumulatorPda,
	detectTokenProgram,
	getTokenBalance,
	LAMPORTS_PER_SOL,
	loadKeypair,
	PUMP_FUN_FEE_PROGRAM,
	PUMP_FUN_FEE_RECIPIENT,
	PUMP_FUN_PROGRAM_ID,
	RPC_URL,
	SYSTEM_PROGRAM,
	TEST_MINT,
	WSS_URL
} from "./pump_fun_utils"

// ============================================================================
// Main Test
// ============================================================================

async function testBuyExactSolIn() {
	console.log("=== Buy Exact SOL In Test (TypeScript) ===\n")

	// Create RPC connection
	const rpc = createSolanaRpc(RPC_URL)
	const rpcSubscriptions = createSolanaRpcSubscriptions(WSS_URL)

	// Load keypair
	let signer: Awaited<ReturnType<typeof loadKeypair>>
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

	// Derive all common pump.fun accounts
	const accounts = await derivePumpFunAccounts(TEST_MINT, userAddress, tokenProgram)
	if (!accounts) {
		console.log("Failed to derive pump.fun accounts")
		console.log("Bonding curve may not exist on localnet.")
		return
	}

	// Derive additional accounts needed for buy
	const [globalVolumeAccumulator] = await deriveGlobalVolumeAccumulatorPda(PUMP_FUN_PROGRAM_ID)
	const [userVolumeAccumulator] = await deriveUserVolumeAccumulatorPda(
		PUMP_FUN_PROGRAM_ID,
		userAddress
	)

	console.log("\n=== Accounts ===")
	console.log("Bonding Curve:", accounts.bondingCurve)
	console.log("Creator:", accounts.bondingCurveData.creator)
	console.log("Virtual token reserves:", accounts.bondingCurveData.virtualTokenReserves.toString())
	console.log("Virtual SOL reserves:", accounts.bondingCurveData.virtualSolReserves.toString())
	console.log("Associated User:", accounts.associatedUser)
	console.log("Associated Bonding Curve:", accounts.associatedBondingCurve)

	// Check if user's ATA exists
	const needsCreateAta = !(await ataExists(rpc, accounts.associatedUser))
	if (needsCreateAta) {
		console.log("\nUser ATA does not exist, will create it")
	} else {
		console.log("\nUser ATA already exists")
	}

	// Buy parameters
	const spendableSolIn = BigInt(10_000_000) // 0.01 SOL
	const minTokensOut = BigInt(1) // Minimum 1 token
	const trackVolume = null // None (OptionBool::None)

	// Build the instruction using generated client
	const generatedInstruction = getPumpFunBuyExactSolInInstruction({
		global: accounts.global,
		feeRecipient: PUMP_FUN_FEE_RECIPIENT,
		mint: TEST_MINT,
		bondingCurve: accounts.bondingCurve,
		associatedBondingCurve: accounts.associatedBondingCurve,
		associatedUser: accounts.associatedUser,
		user: signer,
		systemProgram: SYSTEM_PROGRAM,
		tokenProgram,
		creatorVault: accounts.creatorVault,
		eventAuthority: accounts.eventAuthority,
		program: PUMP_FUN_PROGRAM_ID,
		globalVolumeAccumulator,
		userVolumeAccumulator,
		feeConfig: accounts.feeConfig,
		feeProgram: PUMP_FUN_FEE_PROGRAM,
		bump: accounts.bcBump,
		spendableSolIn,
		minTokensOut,
		trackVolume
	})

	// Patch the discriminator
	const patchedData = new Uint8Array(generatedInstruction.data)
	patchedData[0] = PUMP_FUN_BUY_EXACT_SOL_IN_DISCRIMINATOR

	const buyInstruction = {
		...generatedInstruction,
		data: patchedData
	}

	console.log("\n=== Building Transaction ===")
	console.log(`Spending: ${Number(spendableSolIn) / 1e9} SOL`)
	console.log(`Min tokens out: ${minTokensOut}`)
	console.log(`Discriminator: ${patchedData[0]} (PumpFunBuyExactSolIn)`)

	// Get recent blockhash
	const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

	// Build transaction - start with the base message
	const baseMessage = pipe(
		createTransactionMessage({ version: 0 }),
		tx => setTransactionMessageFeePayerSigner(signer, tx),
		tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
	)

	// Build the final transaction message with all instructions
	const transactionMessage = needsCreateAta
		? pipe(
				baseMessage,
				tx => {
					console.log("Adding Create ATA instruction...")
					const createAtaIx = {
						programAddress: ASSOCIATED_TOKEN_PROGRAM,
						accounts: [
							{ address: userAddress, role: 3 as const },
							{ address: accounts.associatedUser, role: 1 as const },
							{ address: userAddress, role: 0 as const },
							{ address: TEST_MINT, role: 0 as const },
							{ address: SYSTEM_PROGRAM, role: 0 as const },
							{ address: tokenProgram, role: 0 as const }
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
		const tokenBalance = await getTokenBalance(rpc, accounts.associatedUser)
		console.log(`New token balance: ${tokenBalance?.toString() ?? "0"} tokens`)
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
			const errorStr = JSON.stringify(e, Object.getOwnPropertyNames(e), 2)
			console.error("Full error:", errorStr)
		} else {
			console.error("Unknown error:", e)
		}
	}
}

// Run the test
testBuyExactSolIn().catch(console.error)
