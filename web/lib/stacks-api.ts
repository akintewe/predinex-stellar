import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  uintCV,
  ClarityValue,
  ClarityType
} from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { CONTRACT_ADDRESS as CONST_ADDRESS, CONTRACT_NAME as CONST_NAME } from './constants';

const NETWORK = STACKS_MAINNET;
const CONTRACT_ADDRESS = CONST_ADDRESS;
const CONTRACT_NAME = CONST_NAME;

export interface Pool {
  id: number;
  title: string;
  description: string;
  creator: string;
  outcomeA: string;
  outcomeB: string;
  totalA: number;
  totalB: number;
  expiry: number;
  settled: boolean;
  winningOutcome?: number;
  status: 'active' | 'settled' | 'expired';
}

function parsePoolCV(poolCV: any, id: number): Pool {
  const data = poolCV.value.data;
  const burnHeight = 1000000; // Mock current block height if needed, or fetch it

  const expiry = Number(data.expiry.value);
  const settled = data.settled.type === ClarityType.BoolTrue;
  const winningOutcomeCV = data['winning-outcome'];
  let winningOutcome: number | undefined = undefined;

  if (winningOutcomeCV && winningOutcomeCV.type === ClarityType.OptionalSome) {
    winningOutcome = Number(winningOutcomeCV.value.value);
  }

  let status: 'active' | 'settled' | 'expired' = 'active';
  if (settled) status = 'settled';

  return {
    id,
    title: data.title.value,
    description: data.description.value,
    creator: data.creator.value,
    outcomeA: data['outcome-a-name'].value,
    outcomeB: data['outcome-b-name'].value,
    totalA: Number(data['total-a'].value),
    totalB: Number(data['total-b'].value),
    expiry: expiry,
    settled: settled,
    winningOutcome: winningOutcome,
    status: status
  };
}

export async function getPool(id: number): Promise<Pool | null> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pool-details',
      functionArgs: [uintCV(id)],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    if (result.type === ClarityType.OptionalSome) {
      return parsePoolCV(result, id);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching pool ${id}:`, error);
    return null;
  }
}

export async function getMarkets(filter: string): Promise<Pool[]> {
  try {
    const counterResult = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pool-counter',
      functionArgs: [],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    let count = 0;
    if (counterResult.type === ClarityType.ResponseOk) {
      // @ts-ignore
      count = Number(counterResult.value.value);
    } else {
      // Fallback to manual probing if counter fails
      count = 20;
    }

    const pools: Pool[] = [];
    // pool-id starts from 1 in the contract
    for (let i = 1; i < count; i++) {
      const pool = await getPool(i);
      if (pool) {
        pools.push(pool);
      }
    }

    if (filter === 'active') return pools.filter(p => !p.settled);
    if (filter === 'settled') return pools.filter(p => p.settled);

    return pools;
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}
export async function getTotalVolume(): Promise<number> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-total-volume',
      functionArgs: [],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    if (result.type === ClarityType.ResponseOk) {
      // @ts-ignore
      return Number(result.value.value);
    }
    return 0;
  } catch (error) {
    console.error("Error fetching total volume:", error);
    return 0;
  }
}

export async function getPoolCount(): Promise<number> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pool-count',
      functionArgs: [],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    if (result.type === ClarityType.ResponseOk) {
      return Number((result as any).value.value);
    }
    return 0;
  } catch (e) {
    console.error("Failed to fetch pool count", e);
    return 0;
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

export async function getUserActivity(
  userAddress: string,
  limit: number = 20
): Promise<ActivityItem[]> {
  try {
    const { STACKS_API_BASE_URL, NETWORK_CONFIG, DEFAULT_NETWORK } = await import('./constants');
    const explorerBase = NETWORK_CONFIG[DEFAULT_NETWORK].explorerUrl;

    const url = `${STACKS_API_BASE_URL}/extended/v1/address/${userAddress}/transactions?limit=${limit}&type=contract_call`;
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
      return callInfo.contract_id?.includes(CONTRACT_ADDRESS);
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

export interface ClaimInfo {
  claimed: boolean;
  eligible: boolean;
  claimableAmount: number;
}

export async function getClaimInfo(poolId: number, userAddress: string): Promise<ClaimInfo> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-claim-info',
      functionArgs: [uintCV(poolId), cvFromAddress(userAddress)],
      network: NETWORK,
      senderAddress: userAddress,
    });

    if (result.type === ClarityType.Tuple) {
      const data = cvToJSON(result);
      return {
        claimed: data.value.claimed.value === true,
        eligible: data.value.eligible.value === true,
        claimableAmount: Number(data.value.claimable.value),
      };
    }
    return { claimed: false, eligible: false, claimableAmount: 0 };
  } catch (error) {
    console.error(`Error fetching claim info for pool ${poolId}:`, error);
    return { claimed: false, eligible: false, claimableAmount: 0 };
  }
}

export interface UserBetInfo {
  amountA: number;
  amountB: number;
  totalBet: number;
}

export async function getUserBet(poolId: number, userAddress: string): Promise<UserBetInfo | null> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-user-bet',
      functionArgs: [uintCV(poolId), cvFromAddress(userAddress)],
      network: NETWORK,
      senderAddress: userAddress,
    });

    if (result.type === ClarityType.OptionalSome) {
      const data = result.value.data;
      return {
        amountA: Number(data['amount-a'].value),
        amountB: Number(data['amount-b'].value),
        totalBet: Number(data['total-bet'].value),
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user bet for pool ${poolId}:`, error);
    return null;
  }
}

function cvFromAddress(address: string): ClarityValue {
  return {
    type: ClarityType.Address,
    address: {
      type: ClarityType.Address,
      value: address,
    },
  } as ClarityValue;
}
