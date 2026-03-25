import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from "@stacks/network";
import { fetchCallReadOnlyFunction, cvToValue, uintCV, principalCV, ClarityValue } from "@stacks/transactions";
import {
    CONTRACT_ADDRESS,
    CONTRACT_NAME,
    DEFAULT_NETWORK,
    NETWORK_CONFIG,
    STACKS_API_BASE_URL,
    NetworkConfig,
} from "./constants";

// Use network based on environment
const network: StacksNetwork = DEFAULT_NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;

export interface Pool {
    id: number;
    title: string;
    description: string;
    creator: string;
    outcomeA: string;
    outcomeB: string;
    totalA: number;
    totalB: number;
    settled: boolean;
    winningOutcome: number | null;
    expiry: number;
}

export async function getPoolCount(): Promise<number> {
    try {
        const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-pool-count',
            functionArgs: [],
            senderAddress: CONTRACT_ADDRESS,
            network,
        });

        const value = cvToValue(result);
        return Number(value);
    } catch (e) {
        console.error("Failed to fetch pool count", e);
        return 0;
    }
}

export async function getPool(poolId: number): Promise<Pool | null> {
    try {
        const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-pool',
            functionArgs: [uintCV(poolId)],
            senderAddress: CONTRACT_ADDRESS,
            network,
        });

        const value = cvToValue(result, true); // true for readable format
        if (!value) return null;

        // Handle (some {...}) vs (none)
        // cvToValue with readable=true returns null for none, object for some
        return {
            id: poolId,
            title: value.title,
            description: value.description,
            creator: value.creator,
            outcomeA: value['outcome-a-name'],
            outcomeB: value['outcome-b-name'],
            totalA: Number(value['total-a']),
            totalB: Number(value['total-b']),
            settled: value.settled,
            winningOutcome: value['winning-outcome'] ?? null,
            expiry: Number(value.expiry ?? 0),
        };
    } catch (e) {
        console.error(`Failed to fetch pool ${poolId}`, e);
        return null;
    }
}

export async function fetchActivePools(): Promise<Pool[]> {
    const count = await getPoolCount();
    const pools: Pool[] = [];

    for (let i = count - 1; i >= 0; i--) {
        const pool = await getPool(i);
        if (pool) pools.push(pool);
    }
    return pools;
}

export interface UserBetData {
    amountA: number;
    amountB: number;
    totalBet: number;
}

export async function getUserBet(poolId: number, userAddress: string): Promise<UserBetData | null> {
    try {
        const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-user-bet',
            functionArgs: [uintCV(poolId), principalCV(userAddress)],
            senderAddress: CONTRACT_ADDRESS,
            network,
        });

        const value = cvToValue(result, true);
        if (!value) return null;

        return {
            amountA: Number(value['amount-a']),
            amountB: Number(value['amount-b']),
            totalBet: Number(value['total-bet']),
        };
    } catch (e) {
        console.error(`Failed to fetch user bet for pool ${poolId}`, e);
        return null;
    }
}

// --- Activity Feed ---

export interface ActivityEvent {
    type: 'bet' | 'pool-creation' | 'settlement' | 'claim';
    poolId?: number;
    poolTitle?: string;
    amount?: number;
    outcome?: string;
    winnerAmount?: number;
}

export interface ActivityItem {
    txId: string;
    type: 'bet-placed' | 'winnings-claimed' | 'pool-created' | 'contract-call';
    functionName: string;
    timestamp: number;
    status: 'success' | 'pending' | 'failed';
    amount?: number;
    poolId?: number;
    poolTitle?: string;
    explorerUrl: string;
    event?: ActivityEvent;
}

function parseContractEvents(tx: any): ActivityEvent | undefined {
    const events = tx.events || [];
    
    for (const event of events) {
        if (event.type === 'smart_contract_event') {
            const eventData = event.smart_contract_event;
            const eventName = eventData?.event_name;
            
            if (eventName === 'bet-placed') {
                const parsed = eventData?.event_data || {};
                return {
                    type: 'bet',
                    poolId: parsed.pool_id,
                    amount: parsed.amount,
                    outcome: parsed.outcome,
                };
            }
            
            if (eventName === 'pool-created') {
                const parsed = eventData?.event_data || {};
                return {
                    type: 'pool-creation',
                    poolId: parsed.pool_id,
                    poolTitle: parsed.title,
                };
            }
            
            if (eventName === 'pool-settled') {
                const parsed = eventData?.event_data || {};
                return {
                    type: 'settlement',
                    poolId: parsed.pool_id,
                    outcome: parsed.winning_outcome,
                };
            }
            
            if (eventName === 'winnings-claimed') {
                const parsed = eventData?.event_data || {};
                return {
                    type: 'claim',
                    poolId: parsed.pool_id,
                    winnerAmount: parsed.amount,
                };
            }
        }
    }
    
    return undefined;
}

function extractPoolInfo(args: any[]): { amount?: number; poolId?: number } {
    let amount: number | undefined;
    let poolId: number | undefined;

    for (const arg of args) {
        if (arg.name === 'amount' && arg.repr) {
            amount = Number(arg.repr.replace('u', ''));
        }
        if (arg.name === 'pool-id' && arg.repr) {
            poolId = Number(arg.repr.replace('u', ''));
        }
    }
    
    return { amount, poolId };
}

/**
 * Injectable configuration for getUserActivity, enabling test isolation.
 */
export interface ActivityConfig {
    /** Base URL for the Stacks API, e.g. https://api.testnet.hiro.so */
    apiBaseUrl: string;
    /** Explorer base URL used to build transaction links */
    explorerUrl: string;
    /** Contract address used to filter Predinex transactions */
    contractAddress: string;
}

/**
 * Fetches recent on-chain activity for a user address by querying the
 * Stacks blockchain API for contract-call transactions targeting the
 * Predinex contract. Uses contract events when available for richer data.
 *
 * @param userAddress - Stacks principal to query
 * @param limit       - Maximum number of transactions to fetch (default 20)
 * @param config      - Optional injectable config; falls back to module-level constants
 */
export async function getUserActivity(
    userAddress: string,
    limit: number = 20,
    config?: Partial<ActivityConfig>
): Promise<ActivityItem[]> {
    try {
        const explorerBase =
            config?.explorerUrl ?? NETWORK_CONFIG[DEFAULT_NETWORK]?.explorerUrl;

        if (!explorerBase) {
            console.error('getUserActivity: explorerUrl is not configured');
            return [];
        }

        const apiBase = config?.apiBaseUrl ?? STACKS_API_BASE_URL;
        const contractAddr = config?.contractAddress ?? CONTRACT_ADDRESS;

        const url = `${apiBase}/extended/v1/address/${userAddress}/transactions?limit=${limit}&type=contract_call`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Stacks API error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const results: any[] = data.results || [];

        const predinexTxs = results.filter((tx: any) => {
            const callInfo = tx.contract_call;
            if (!callInfo) return false;
            return callInfo.contract_id?.includes(contractAddr);
        });

        return predinexTxs.map((tx: any): ActivityItem => {
            const callInfo = tx.contract_call;
            const fnName: string = callInfo?.function_name || 'unknown';

            let type: ActivityItem['type'] = 'contract-call';
            if (fnName === 'place-bet') type = 'bet-placed';
            else if (fnName === 'claim-winnings') type = 'winnings-claimed';
            else if (fnName === 'create-pool') type = 'pool-created';

            let status: ActivityItem['status'] = 'pending';
            if (tx.tx_status === 'success') status = 'success';
            else if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') status = 'failed';

            const args: any[] = callInfo?.function_args || [];
            const { amount, poolId } = extractPoolInfo(args);

            const event = parseContractEvents(tx);

            return {
                txId: tx.tx_id,
                type,
                functionName: fnName,
                timestamp: tx.burn_block_time || Math.floor(Date.now() / 1000),
                status,
                amount: event?.amount || event?.winnerAmount || amount,
                poolId: event?.poolId || poolId,
                poolTitle: event?.poolTitle,
                explorerUrl: `${explorerBase}/txid/${tx.tx_id}`,
                event,
            };
        });
    } catch (e) {
        console.error('Failed to fetch user activity', e);
        return [];
    }
}
