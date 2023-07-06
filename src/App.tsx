import './App.css'
import { useState, useEffect } from 'react'

import { ChainId } from "@biconomy/core-types";
import { ethers } from 'ethers'
import SmartAccount from "@biconomy/smart-account";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GaslessType, approve, getBalances, quote } from "wido";

import { BiconomyPaymasterAPI } from 'wido';
import { getEthersSigner } from './provider';
import { disconnect, watchAccount } from 'wagmi/actions';

const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const VAULT_ARBITRUM = "0x562Ae83d17590d9681D5445EcfC0F56517e49f24";

function App() {
  const [smartAccount, setSmartAccount] = useState<SmartAccount | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [polygonUSDCBalance, setPolygonUSDCBalance] = useState<string>("0");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("0");
  const [arbitrumVaultBalance, setArbitrumVaultBalance] = useState<string>("0");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watchAccount((_account) => setupSmartAccount());


  useEffect(() => {
    async function fetchData() {
      const bal = await getBalances(smartAccount!.address, [ChainId.POLYGON_MAINNET, ChainId.ARBITRUM_ONE_MAINNET]);
      for (const b of bal) {
        if (b.chainId == ChainId.POLYGON_MAINNET && b.address === USDC_POLYGON) {
          setPolygonUSDCBalance(ethers.utils.formatUnits(b.balance, 6));
          setDepositAmount(ethers.utils.formatUnits(b.balance, 6));
        } else if (b.chainId == ChainId.ARBITRUM_ONE_MAINNET && b.address === VAULT_ARBITRUM) {
          setArbitrumVaultBalance(ethers.utils.formatUnits(b.balance, 18));
          setWithdrawAmount(ethers.utils.formatUnits(b.balance, 18));
        }
      }
    }
    if (smartAccount) {
      fetchData();
    }
  }, [smartAccount])


  async function setupSmartAccount() {
    const web3Signer = await getEthersSigner({ chainId: ChainId.POLYGON_MAINNET });
    if (!web3Signer) return
    console.log("setting up smart account...")
    setLoading(true)
    try {
      const smartAccount = new SmartAccount(web3Signer, {
        activeNetworkId: ChainId.POLYGON_MAINNET,
        supportedNetworksIds: [ChainId.POLYGON_MAINNET, ChainId.ARBITRUM_ONE_MAINNET],
        networkConfig: [
          {
            chainId: ChainId.POLYGON_MAINNET,
            customPaymasterAPI: new BiconomyPaymasterAPI(ChainId.POLYGON_MAINNET),
            dappAPIKey: "oEHNi7Cc9.f1b032c0-b868-43e9-aef0-27b6ec8b1b24",
          },
          {
            chainId: ChainId.ARBITRUM_ONE_MAINNET,
            customPaymasterAPI: new BiconomyPaymasterAPI(ChainId.ARBITRUM_ONE_MAINNET),
            dappAPIKey: "7mpOBM7HL.e1acc8ce-1125-4831-8a23-7a37f1e45a66",
          },
        ],
      })
      await smartAccount.init()
      setSmartAccount(smartAccount)
      setLoading(false)
    } catch (err) {
      console.log('error setting up smart account... ', err)
    }
  }

  const logout = async () => {
    await disconnect();
    setSmartAccount(null)
  }


  async function depositPolygonUSDCToArbitrumVault() {
    if (!smartAccount) return

    smartAccount.setActiveChain(ChainId.POLYGON_MAINNET);

    const sas = await smartAccount.getSmartAccountState();
    console.log(`Entrypoint address: ${sas.entryPointAddress}`);

    const amount = ethers.utils.parseUnits(depositAmount, 6);

    console.log("Getting approve info...")
    // Get approve transaction
    const { to: approveTo, data: approveCalldata } = await approve({
      chainId: ChainId.POLYGON_MAINNET,
      fromToken: USDC_POLYGON,
      toChainId: ChainId.ARBITRUM_ONE_MAINNET,
      toToken: VAULT_ARBITRUM,
      amount: amount.toString(),
    });
    // console.log(approveTo)
    // console.log(approveCalldata)

    console.log("Getting Quote...")
    // Get deposit transaction
    const { to: quoteTo, data: quoteCalldata } = await quote({
      user: smartAccount.address,
      fromChainId: ChainId.POLYGON_MAINNET,
      fromToken: USDC_POLYGON,
      toChainId: ChainId.ARBITRUM_ONE_MAINNET,
      toToken: VAULT_ARBITRUM,
      amount: amount.toString(),
      gaslessType: GaslessType.ERC4337,
    });
    console.log("Fetched Quote...")
    // console.log(quoteTo);
    // console.log(quoteCalldata);

    const txResponse = await smartAccount.sendTransactionBatch({
      transactions: [
        {
          to: approveTo,
          data: approveCalldata,
        },
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          to: quoteTo!,
          data: quoteCalldata,
        }
      ],
      chainId: ChainId.POLYGON_MAINNET,
    });

    const txHash = await txResponse.wait();
    console.log(txHash)
  }

  async function withdrawArbitrumVaultToPolygonUSDC() {
    if (!smartAccount) return

    smartAccount.setActiveChain(ChainId.ARBITRUM_ONE_MAINNET);

    const sas = await smartAccount.getSmartAccountState();
    console.log(`Entrypoint address: ${sas.entryPointAddress}`);

    const amount = ethers.utils.parseUnits(withdrawAmount, 18);

    console.log("Getting approve info...")
    // Get approve transaction
    const { to: approveTo, data: approveCalldata } = await approve({
      chainId: ChainId.ARBITRUM_ONE_MAINNET,
      fromToken: VAULT_ARBITRUM,
      toChainId: ChainId.POLYGON_MAINNET,
      toToken: USDC_POLYGON,
      amount: amount.toString(),
    });
    // console.log(approveTo)
    // console.log(approveCalldata)

    console.log("Getting Quote...")
    // Get deposit transaction
    const { to: quoteTo, data: quoteCalldata } = await quote({
      user: smartAccount.address,
      toChainId: ChainId.POLYGON_MAINNET,
      toToken: USDC_POLYGON,
      fromChainId: ChainId.ARBITRUM_ONE_MAINNET,
      fromToken: VAULT_ARBITRUM,
      amount: amount.toString(),
      gaslessType: GaslessType.ERC4337,
    });
    console.log("Fetched Quote...")
    // console.log(quoteTo);
    // console.log(quoteCalldata);

    const txResponse = await smartAccount.sendTransactionBatch({
      transactions: [
        {
          to: approveTo,
          data: approveCalldata,
        },
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          to: quoteTo!,
          data: quoteCalldata,
        }
      ],
      chainId: ChainId.ARBITRUM_ONE_MAINNET,
    });

    const txHash = await txResponse.wait();
    console.log(txHash)
  }

  return (
    <>
      <div>
        <h1>Wido Gasless for Smart Contract Accounts</h1>
        <p>This demo shows depositing USDC on Polygon to <a href="https://arbiscan.io/address/0x562ae83d17590d9681d5445ecfc0f56517e49f24">Stargate Beefy Vault</a> on Arbitrum. Any token pair between any Wido supported chain can be used for Gasless transactions.</p>
        <p>Please connect your <b>EOA</b> to create or reuse existing Smart Account wallet. Directly connecting Smart Wallet is not supported in this demo.</p>
        <div style={{ height: "70px" }}></div>
        {
          !smartAccount && !loading && <ConnectButton />
        }
        {
          loading && <p>Loading account details...</p>
        }
        {
          !!smartAccount && (
            <>
              <div className="buttonWrapper">
                <h3>Smart account address:</h3>
                <p>{smartAccount.address}</p>
                <button onClick={logout}>Logout</button>
              </div>
              <div style={{ columnCount: 2, columnGap: "40px", height: "100vh" }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: "100vh" }}>
                  <p>Balance: {polygonUSDCBalance}</p>
                  <input type="text" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                  <button onClick={depositPolygonUSDCToArbitrumVault}>Deposit Polygon USDC to Arbitrum Vault</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', height: "100vh" }}>
                  <p>Balance: {arbitrumVaultBalance}</p>
                  <input type="text" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                  <button onClick={withdrawArbitrumVaultToPolygonUSDC}>Withdraw Arbitrum Vault to Polygon USDC</button>
                </div>
              </div>
            </>
          )
        }
      </div>
    </>
  )
}

export default App
