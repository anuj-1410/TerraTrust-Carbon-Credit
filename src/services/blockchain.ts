import {ethers} from 'ethers';
import Config from 'react-native-config';

const ERC1155_BALANCE_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

// Token ID 1 = Carbon Credit Token per SRS Section 10.7
const CTT_TOKEN_ID = 1;

export async function getCTTBalance(walletAddress: string): Promise<number> {
  const provider = new ethers.JsonRpcProvider(Config.ALCHEMY_POLYGON_AMOY_URL);

  const contract = new ethers.Contract(
    Config.CONTRACT_ADDRESS,
    ERC1155_BALANCE_ABI,
    provider,
  );

  const balance: bigint = await contract.balanceOf(walletAddress, CTT_TOKEN_ID);
  return Number(balance);
}
