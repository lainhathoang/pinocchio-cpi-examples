/**
 * Shared utilities for Pump.fun tests
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

// Pump.fun program constants
export const PUMP_FUN_PROGRAM_ID = address("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
export const PUMP_FUN_FEE_RECIPIENT = address("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV")
export const PUMP_FUN_FEE_PROGRAM = address("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ")
export const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
export const TOKEN_2022_PROGRAM = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
export const SYSTEM_PROGRAM = address("11111111111111111111111111111111")
export const ASSOCIATED_TOKEN_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

// Test token
export const TEST_MINT = address("EtxQtkw2Xpwm1Hn1jMgMSJMFtX97eyQ3E3JrqXeYpump")

// Seeds for PDA derivation (from IDL)
export const GLOBAL_SEED = new TextEncoder().encode("global")
export const BONDING_CURVE_SEED = new TextEncoder().encode("bonding-curve")
export const CREATOR_VAULT_SEED = new TextEncoder().encode("creator-vault")
export const EVENT_AUTHORITY_SEED = new TextEncoder().encode("__event_authority")
export const GLOBAL_VOLUME_ACCUMULATOR_SEED = new TextEncoder().encode("global_volume_accumulator")
export const USER_VOLUME_ACCUMULATOR_SEED = new TextEncoder().encode("user_volume_accumulator")
export const FEE_CONFIG_SEED = new TextEncoder().encode("fee_config")

// Fee config pubkey constant (from IDL)
export const FEE_CONFIG_PUBKEY = new Uint8Array([
	1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81, 137, 203, 151, 245,
	210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176
])

// Lamports per SOL
export const LAMPORTS_PER_SOL = BigInt(1_000_000_000)

// RPC endpoints
export const RPC_URL = "http://127.0.0.1:8899"
export const WSS_URL = "ws://127.0.0.1:8900"

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

export async function deriveGlobalPda(programId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [GLOBAL_SEED]
	})
	return [result[0], result[1]]
}

export async function deriveBondingCurvePda(
	programId: Address,
	mint: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [BONDING_CURVE_SEED, addressToBytes(mint)]
	})
	return [result[0], result[1]]
}

export async function deriveCreatorVaultPda(
	programId: Address,
	creator: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [CREATOR_VAULT_SEED, addressToBytes(creator)]
	})
	return [result[0], result[1]]
}

export async function deriveEventAuthorityPda(programId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [EVENT_AUTHORITY_SEED]
	})
	return [result[0], result[1]]
}

export async function deriveGlobalVolumeAccumulatorPda(
	programId: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [GLOBAL_VOLUME_ACCUMULATOR_SEED]
	})
	return [result[0], result[1]]
}

export async function deriveUserVolumeAccumulatorPda(
	programId: Address,
	user: Address
): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [USER_VOLUME_ACCUMULATOR_SEED, addressToBytes(user)]
	})
	return [result[0], result[1]]
}

export async function deriveFeeConfigPda(feeProgramId: Address): Promise<[Address, number]> {
	const result = await getProgramDerivedAddress({
		programAddress: feeProgramId,
		seeds: [FEE_CONFIG_SEED, FEE_CONFIG_PUBKEY]
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
// Bonding Curve Data Structure
// ============================================================================

export interface BondingCurveData {
	virtualTokenReserves: bigint
	virtualSolReserves: bigint
	realTokenReserves: bigint
	realSolReserves: bigint
	tokenTotalSupply: bigint
	complete: boolean
	creator: Address
	isMayhemMode: boolean
}

export function parseBondingCurveData(data: Uint8Array): BondingCurveData | null {
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
 * Fetch and decode bonding curve account data
 */
export async function fetchBondingCurveData(
	rpc: ReturnType<typeof createSolanaRpc>,
	bondingCurve: Address
): Promise<{ rawData: Uint8Array; parsed: BondingCurveData } | null> {
	try {
		const accountInfo = await rpc.getAccountInfo(bondingCurve, { encoding: "base64" }).send()
		if (!accountInfo.value) {
			return null
		}

		const accountData = accountInfo.value.data
		if (Array.isArray(accountData)) {
			const rawData = new Uint8Array(Buffer.from(accountData[0], "base64"))
			const parsed = parseBondingCurveData(rawData)
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
 * Common accounts for pump.fun operations
 */
export interface PumpFunCommonAccounts {
	global: Address
	bondingCurve: Address
	bcBump: number
	creatorVault: Address
	eventAuthority: Address
	feeConfig: Address
	associatedBondingCurve: Address
	associatedUser: Address
	bondingCurveData: BondingCurveData
}

/**
 * Derive all common PDAs for pump.fun operations
 */
export async function derivePumpFunAccounts(
	mint: Address,
	userAddress: Address,
	tokenProgram: Address
): Promise<PumpFunCommonAccounts | null> {
	const [bondingCurve, bcBump] = await deriveBondingCurvePda(PUMP_FUN_PROGRAM_ID, mint)
	const [global] = await deriveGlobalPda(PUMP_FUN_PROGRAM_ID)
	const [eventAuthority] = await deriveEventAuthorityPda(PUMP_FUN_PROGRAM_ID)
	const [feeConfig] = await deriveFeeConfigPda(PUMP_FUN_FEE_PROGRAM)

	const associatedBondingCurve = await getAssociatedTokenAddress(bondingCurve, mint, tokenProgram)
	const associatedUser = await getAssociatedTokenAddress(userAddress, mint, tokenProgram)

	// We need to fetch bonding curve to get the creator
	const rpc = createSolanaRpc(RPC_URL)
	const bcData = await fetchBondingCurveData(rpc, bondingCurve)
	if (!bcData) {
		return null
	}

	const [creatorVault] = await deriveCreatorVaultPda(PUMP_FUN_PROGRAM_ID, bcData.parsed.creator)

	return {
		global,
		bondingCurve,
		bcBump,
		creatorVault,
		eventAuthority,
		feeConfig,
		associatedBondingCurve,
		associatedUser,
		bondingCurveData: bcData.parsed
	}
}
