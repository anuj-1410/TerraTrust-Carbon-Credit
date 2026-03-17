import {ethers} from 'ethers';
import Config from 'react-native-config';

const CTT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Replace with deployed CTT contract address

const ERC20_BALANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

export async function getCTTBalance(walletAddress: string): Promise<number> {
  const provider = new ethers.JsonRpcProvider(
    Config.API_BASE_URL?.replace('/api/v1', '') ||
      'https://polygon-rpc.com',
  );

  const contract = new ethers.Contract(
    CTT_CONTRACT_ADDRESS,
    ERC20_BALANCE_ABI,
    provider,
  );

  const balance: bigint = await contract.balanceOf(walletAddress);
  return Number(ethers.formatUnits(balance, 18));
}
