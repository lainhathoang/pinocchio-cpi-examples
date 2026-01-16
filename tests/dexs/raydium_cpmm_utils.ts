/**
 * Shared utilities for Raydium CPMM tests
 */

import * as fs from "node:fs"
import {
	type Address,
	address,
	createKeyPairSignerFromBytes,
	createSolanaRpc,
	getAddressDecoder,
	getAddressEncoder,
	getProgramDerivedAddress,
	type TransactionSigner
} from "@solana/kit"

// ============================================================================
// Constants
// ============================================================================

// Raydium CPMM program constant
export const RAYDIUM_CPMM_PROGRAM_ID = address("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C")

// Token programs
export const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
export const TOKEN_2022_PROGRAM = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
export const SYSTEM_PROGRAM = address("11111111111111111111111111111111")
export const ASSOCIATED_TOKEN_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

// Test token (the one specified in the task)
export const TEST_TOKEN_MINT = address("92dmHZPDm4a9vXtvQVJtEYoDDZpsHYci8NWCrBk5AKgX")

// Native SOL (Wrapped SOL)
export const WSOL_MINT = address("So11111111111111111111111111111111111111112")

// Lamports per SOL
export const LAMPORTS_PER_SOL = BigInt(1_000_000_000)

// RPC endpoints
export const RPC_URL = "http://127.0.0.1:8899"
export const WSS_URL = "ws://127.0.0.1:8900"

// PDA Seeds (from Raydium CPMM IDL)
// "vault_and_lp_mint_auth_seed" = [118, 97, 117, 108, 116, 95, 97, 110, 100, 95, 108, 112, 95, 109, 105, 110, 116, 95, 97, 117, 116, 104, 95, 115, 101, 101, 100]
export const VAULT_AND_LP_MINT_AUTH_SEED = new Uint8Array([
	118, 97, 117, 108, 116, 95, 97, 110, 100, 95, 108, 112, 95, 109, 105, 110, 116, 95, 97, 117, 116,
	104, 95, 115, 101, 101, 100
])

// "pool_vault" seed = [112, 111, 111, 108, 95, 118, 97, 117, 108, 116]
export const POOL_VAULT_SEED = new Uint8Array([112, 111, 111, 108, 95, 118, 97, 117, 108, 116])

// "observation" seed = [111, 98, 115, 101, 114, 118, 97, 116, 105, 111, 110]
export const OBSERVATION_SEED = new Uint8Array([
	111, 98, 115, 101, 114, 118, 97, 116, 105, 111, 110
])

// "pool_lp_mint" seed = [112, 111, 111, 108, 95, 108, 112, 95, 109, 105, 110, 116]
export const POOL_LP_MINT_SEED = new Uint8Array([
	112, 111, 111, 108, 95, 108, 112, 95, 109, 105, 110, 116
])

// "amm_config" seed = [97, 109, 109, 95, 99, 111, 110, 102, 105, 103]
export const AMM_CONFIG_SEED = new Uint8Array([97, 109, 109, 95, 99, 111, 110, 102, 105, 103])

// ============================================================================
// Helper: Convert Address to bytes
// ============================================================================

export function addressToBytes(addr: Address): Uint8Array {
	const encoded = getAddressEncoder().encode(addr)
	return new Uint8Array(encoded)
}

export function bytesToAddress(bytes: Uint8Array): Address {
	return getAddressDecoder().decode(bytes)
}

// ============================================================================
// PDA Derivation Functions
// ============================================================================

export async function deriveAuthorityPda(programId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [VAULT_AND_LP_MINT_AUTH_SEED]
	})
	return [result[0], result[1]]
}

export async function derivePoolVaultPda(
	programId: Address,
	poolState: Address,
	tokenMint: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [POOL_VAULT_SEED, addressToBytes(poolState), addressToBytes(tokenMint)]
	})
	return [result[0], result[1]]
}

export async function deriveObservationStatePda(
	programId: Address,
	poolState: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [OBSERVATION_SEED, addressToBytes(poolState)]
	})
	return [result[0], result[1]]
}

export async function deriveAmmConfigPda(
	programId: Address,
	index: number
): Promise<[Address, number]> {
	// Index is u16, convert to 2 bytes little-endian
	const indexBytes = new Uint8Array(2)
	indexBytes[0] = index & 0xff
	indexBytes[1] = (index >> 8) & 0xff

	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [AMM_CONFIG_SEED, indexBytes]
	})
	return [result[0], result[1]]
}

// ============================================================================
// Associated Token Account Derivation
// ============================================================================

export async function getAssociatedTokenAddress(
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
// Pool State Data Structure
// ============================================================================

export interface PoolStateData {
	ammConfig: Address
	poolCreator: Address
	token0Vault: Address
	token1Vault: Address
	lpMint: Address
	token0Mint: Address
	token1Mint: Address
	token0Program: Address
	token1Program: Address
	observationKey: Address
	authBump: number
	status: number
	lpMintDecimals: number
	mint0Decimals: number
	mint1Decimals: number
	lpSupply: bigint
	protocolFeesToken0: bigint
	protocolFeesToken1: bigint
	fundFeesToken0: bigint
	fundFeesToken1: bigint
	openTime: bigint
}

export function parsePoolStateData(data: Uint8Array): PoolStateData | null {
	// Pool state is 637 bytes according to Raydium IDL
	// Discriminator: 8 bytes
	// amm_config: 32 bytes
	// pool_creator: 32 bytes
	// token_0_vault: 32 bytes
	// token_1_vault: 32 bytes
	// lp_mint: 32 bytes
	// token_0_mint: 32 bytes
	// token_1_mint: 32 bytes
	// token_0_program: 32 bytes
	// token_1_program: 32 bytes
	// observation_key: 32 bytes
	// auth_bump: 1 byte
	// status: 1 byte
	// lp_mint_decimals: 1 byte
	// mint_0_decimals: 1 byte
	// mint_1_decimals: 1 byte
	// padding: 3 bytes
	// lp_supply: 8 bytes
	// protocol_fees_token_0: 8 bytes
	// protocol_fees_token_1: 8 bytes
	// fund_fees_token_0: 8 bytes
	// fund_fees_token_1: 8 bytes
	// open_time: 8 bytes

	if (data.length < 400) {
		console.log(`Data too short: ${data.length} bytes`)
		return null
	}

	const view = new DataView(data.buffer, data.byteOffset)
	let offset = 8 // Skip anchor discriminator

	const ammConfig = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const poolCreator = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const token0Vault = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const token1Vault = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const lpMint = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const token0Mint = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const token1Mint = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const token0Program = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const token1Program = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const observationKey = bytesToAddress(data.slice(offset, offset + 32))
	offset += 32

	const authBump = data[offset] ?? 0
	offset += 1

	const status = data[offset] ?? 0
	offset += 1

	const lpMintDecimals = data[offset] ?? 0
	offset += 1

	const mint0Decimals = data[offset] ?? 0
	offset += 1

	const mint1Decimals = data[offset] ?? 0
	offset += 4 // +1 for mint1Decimals + 3 padding bytes

	const lpSupply = view.getBigUint64(offset, true)
	offset += 8

	const protocolFeesToken0 = view.getBigUint64(offset, true)
	offset += 8

	const protocolFeesToken1 = view.getBigUint64(offset, true)
	offset += 8

	const fundFeesToken0 = view.getBigUint64(offset, true)
	offset += 8

	const fundFeesToken1 = view.getBigUint64(offset, true)
	offset += 8

	const openTime = view.getBigUint64(offset, true)

	return {
		ammConfig,
		poolCreator,
		token0Vault,
		token1Vault,
		lpMint,
		token0Mint,
		token1Mint,
		token0Program,
		token1Program,
		observationKey,
		authBump,
		status,
		lpMintDecimals,
		mint0Decimals,
		mint1Decimals,
		lpSupply,
		protocolFeesToken0,
		protocolFeesToken1,
		fundFeesToken0,
		fundFeesToken1,
		openTime
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

export async function loadKeypair(): Promise<TransactionSigner> {
	const keypairPath = `${process.env.HOME}/.config/solana/id.json`
	const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8")) as number[]
	const secretKey = new Uint8Array(keypairData)
	return await createKeyPairSignerFromBytes(secretKey)
}

export async function detectTokenProgram(
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

/**
 * Fetch and decode pool state account data
 */
export async function fetchPoolStateData(
	rpc: ReturnType<typeof createSolanaRpc>,
	poolState: Address
): Promise<{ rawData: Uint8Array; parsed: PoolStateData } | null> {
	try {
		const accountInfo = await rpc.getAccountInfo(poolState, { encoding: "base64" }).send()
		if (!accountInfo.value) {
			return null
		}

		const accountData = accountInfo.value.data
		if (Array.isArray(accountData)) {
			const rawData = new Uint8Array(Buffer.from(accountData[0], "base64"))
			const parsed = parsePoolStateData(rawData)
			if (!parsed) return null
			return { rawData, parsed }
		}
		return null
	} catch {
		return null
	}
}

/**
 * Get token balance for an account
 */
export async function getTokenBalance(
	rpc: ReturnType<typeof createSolanaRpc>,
	tokenAccount: Address
): Promise<bigint | null> {
	try {
		const balance = await rpc.getTokenAccountBalance(tokenAccount).send()
		if (balance.value.amount) {
			return BigInt(balance.value.amount)
		}
		return null
	} catch {
		return null
	}
}

/**
 * Check if ATA exists
 */
export async function ataExists(
	rpc: ReturnType<typeof createSolanaRpc>,
	ata: Address
): Promise<boolean> {
	try {
		const ataInfo = await rpc.getAccountInfo(ata).send()
		return ataInfo.value !== null
	} catch {
		return false
	}
}

/**
 * Common accounts for Raydium CPMM swap operations
 */
export interface RaydiumCpmmSwapAccounts {
	authority: Address
	ammConfig: Address
	poolState: Address
	token0Vault: Address
	token1Vault: Address
	token0Mint: Address
	token1Mint: Address
	token0Program: Address
	token1Program: Address
	observationState: Address
	userToken0Account: Address
	userToken1Account: Address
	poolStateData: PoolStateData
}

/**
 * Derive all accounts needed for Raydium CPMM swap
 * You need to provide a known pool state address
 */
export async function deriveRaydiumCpmmSwapAccounts(
	poolStateAddress: Address,
	userAddress: Address
): Promise<RaydiumCpmmSwapAccounts | null> {
	const rpc = createSolanaRpc(RPC_URL)

	// Fetch pool state
	const poolData = await fetchPoolStateData(rpc, poolStateAddress)
	if (!poolData) {
		return null
	}

	const poolStateData = poolData.parsed

	// Derive authority PDA
	const [authority] = await deriveAuthorityPda(RAYDIUM_CPMM_PROGRAM_ID)

	// Get user associated token accounts
	const userToken0Account = await getAssociatedTokenAddress(
		userAddress,
		poolStateData.token0Mint,
		poolStateData.token0Program
	)
	const userToken1Account = await getAssociatedTokenAddress(
		userAddress,
		poolStateData.token1Mint,
		poolStateData.token1Program
	)

	return {
		authority,
		ammConfig: poolStateData.ammConfig,
		poolState: poolStateAddress,
		token0Vault: poolStateData.token0Vault,
		token1Vault: poolStateData.token1Vault,
		token0Mint: poolStateData.token0Mint,
		token1Mint: poolStateData.token1Mint,
		token0Program: poolStateData.token0Program,
		token1Program: poolStateData.token1Program,
		observationState: poolStateData.observationKey,
		userToken0Account,
		userToken1Account,
		poolStateData
	}
}
