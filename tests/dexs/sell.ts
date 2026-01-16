/**
 * TypeScript unit test for Pump.fun sell instruction
 *
 * Migrated from: advances/dexs/tests/pump_fun.rs
 *
 * Prerequisites:
 * - Run a local Solana validator: `solana-test-validator`
 * - Ensure the keypair at `~/.config/solana/id.json` has sufficient SOL
 * - Ensure the user has tokens to sell (run buy_exact_sol_in.ts first)
 *
 * Test token: EtxQtkw2Xpwm1Hn1jMgMSJMFtX97eyQ3E3JrqXeYpump
 */

import {
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
	getPumpFunSellInstruction,
	PUMP_FUN_SELL_DISCRIMINATOR
} from "../../clients/dexs/js/src/generated"
import {
	derivePumpFunAccounts,
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

async function testSell() {
	console.log("=== Pump.fun Sell Test (TypeScript) ===\n")

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

	if (balance < LAMPORTS_PER_SOL / BigInt(100)) {
		console.log("Insufficient SOL balance for test. Need at least 0.01 SOL")
		return
	}

	// Detect the correct token program for this mint
	const tokenProgram = await detectTokenProgram(rpc, TEST_MINT)
	console.log("Using token program:", tokenProgram)

	// Derive all pump.fun accounts
	const accounts = await derivePumpFunAccounts(TEST_MINT, userAddress, tokenProgram)
	if (!accounts) {
		console.log("Failed to derive pump.fun accounts")
		console.log("Bonding curve may not exist on localnet.")
		return
	}

	console.log("\n=== Accounts ===")
	console.log("Bonding Curve:", accounts.bondingCurve)
	console.log("Creator:", accounts.bondingCurveData.creator)
	console.log("Associated User:", accounts.associatedUser)
	console.log("Associated Bonding Curve:", accounts.associatedBondingCurve)

	// Get token balance
	const tokenBalance = await getTokenBalance(rpc, accounts.associatedUser)
	if (tokenBalance === null || tokenBalance === BigInt(0)) {
		console.log("\n❌ No tokens to sell!")
		console.log("Run the buy_exact_sol_in test first to get some tokens.")
		return
	}

	console.log(`\nToken balance: ${tokenBalance.toString()} tokens`)

	// Sell all tokens
	const amountToSell = tokenBalance
	const minSolOutput = BigInt(1) // Minimum 1 lamport

	console.log("\n=== Sell Parameters ===")
	console.log(`Selling: ${amountToSell.toString()} tokens`)
	console.log(`Min SOL output: ${Number(minSolOutput) / 1e9} SOL`)

	// Build the instruction using generated client
	const generatedInstruction = getPumpFunSellInstruction({
		global: accounts.global,
		feeRecipient: PUMP_FUN_FEE_RECIPIENT,
		mint: TEST_MINT,
		bondingCurve: accounts.bondingCurve,
		associatedBondingCurve: accounts.associatedBondingCurve,
		associatedUser: accounts.associatedUser,
		user: signer,
		systemProgram: SYSTEM_PROGRAM,
		creatorVault: accounts.creatorVault,
		tokenProgram,
		eventAuthority: accounts.eventAuthority,
		program: PUMP_FUN_PROGRAM_ID,
		feeConfig: accounts.feeConfig,
		feeProgram: PUMP_FUN_FEE_PROGRAM,
		amount: amountToSell,
		minSolOutput
	})

	// Patch the discriminator
	const patchedData = new Uint8Array(generatedInstruction.data)
	patchedData[0] = PUMP_FUN_SELL_DISCRIMINATOR

	const sellInstruction: Instruction = {
		programAddress: generatedInstruction.programAddress,
		accounts: generatedInstruction.accounts,
		data: patchedData
	}

	console.log(`Discriminator: ${patchedData[0]} (PumpFunSell)`)

	// Get recent blockhash
	const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

	// Build transaction
	const transactionMessage = pipe(
		createTransactionMessage({ version: 0 }),
		tx => setTransactionMessageFeePayerSigner(signer, tx),
		tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
		tx => appendTransactionMessageInstructions([sellInstruction], tx)
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
		const newTokenBalance = await getTokenBalance(rpc, accounts.associatedUser)
		console.log(`New token balance: ${newTokenBalance?.toString() ?? "0"} tokens`)

		const newSolBalance = await rpc.getBalance(userAddress).send()
		console.log(`New SOL balance: ${Number(newSolBalance.value) / Number(LAMPORTS_PER_SOL)} SOL`)
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
testSell().catch(console.error)
