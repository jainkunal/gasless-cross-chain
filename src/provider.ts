import { providers } from "ethers";
import { WalletClient } from "viem";
import { getWalletClient } from "wagmi/actions";

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain!.id,
    name: chain!.name,
    ensAddress: chain!.contracts?.ensRegistry?.address,
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account!.address);
  return signer;
}

/** Action to convert a viem Public Client to an ethers.js Provider. */
export async function getEthersSigner({ chainId }: { chainId?: number } = {}) {
  const walletClient = await getWalletClient({ chainId });
  if (!walletClient) return undefined;
  return walletClientToSigner(walletClient);
}
