import './App.css'
import { useState, useEffect, useRef } from 'react'
import SocialLogin from "@biconomy/web3-auth"

import { ChainId } from "@biconomy/core-types";
import { ethers } from 'ethers'
import SmartAccount from "@biconomy/smart-account";
import { useLocalApi, GaslessType, approve, getBalances, quote } from "wido";

import { BiconomyPaymasterAPI } from 'wido';

const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const VAULT_ARBITRUM = "0x562Ae83d17590d9681D5445EcfC0F56517e49f24";

function App() {
  useLocalApi();

  const [smartAccount, setSmartAccount] = useState<SmartAccount | null>(null)
  const [interval, enableInterval] = useState(false)
  const sdkRef = useRef<SocialLogin | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [, setProvider] = useState<any>(null)

  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [polygonUSDCBalance, setPolygonUSDCBalance] = useState<string>("0");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("0");
  const [arbitrumVaultBalance, setArbitrumVaultBalance] = useState<string>("0");

  // const [fromTokens, setFromTokens] = useState([]);
  // const [toTokens, setToTokens] = useState([]);

  useEffect(() => {
    let configureLogin: any
    if (interval) {
      configureLogin = setInterval(() => {
        if (!!sdkRef.current?.provider) {
          setupSmartAccount()
          clearInterval(configureLogin)
        }
      }, 1000)
    }
  }, [interval])

  useEffect(() => {
    async function fetchData() {
      const bal = await getBalances(smartAccount!.address, [ChainId.POLYGON_MAINNET, ChainId.ARBITRUM_ONE_MAINNET]);
      console.log(bal);
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

  // useEffect(() => {
  //   getSupportedTokens({
  //     chainId: [5, 80001],
  //   }).then((f) => {
  //     setFromTokens(f);
  //     setToTokens(f);
  //   });
  // }, [setFromTokens, setToTokens]);

  async function login() {
    if (!sdkRef.current) {
      const socialLoginSDK = new SocialLogin()
      const signature1 = await socialLoginSDK.whitelistUrl('http://127.0.0.1:5173/')
      await socialLoginSDK.init({
        chainId: ethers.utils.hexValue(ChainId.POLYGON_MAINNET).toString(),
        network: "mainnet",
        whitelistUrls: {
          'http://127.0.0.1:5173/': signature1,
        }
      })
      console.log(socialLoginSDK);
      sdkRef.current = socialLoginSDK
    }
    if (!sdkRef.current.provider) {
      sdkRef.current.showWallet()
      enableInterval(true)
    } else {
      setupSmartAccount()
    }
  }

  async function setupSmartAccount() {
    if (!sdkRef?.current?.provider) return
    console.log("setting up smart account...")
    sdkRef.current.hideWallet()
    setLoading(true)
    const web3Provider = new ethers.providers.Web3Provider(
      sdkRef.current.provider
    )
    setProvider(web3Provider)

    console.log(web3Provider);
    try {
      const smartAccount = new SmartAccount(web3Provider, {
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
    if (!sdkRef.current) {
      console.error('Web3Modal not initialized.')
      return
    }
    await sdkRef.current.logout()
    sdkRef.current.hideWallet()
    setSmartAccount(null)
    enableInterval(false)
  }


  async function depositPolygonUSDCToArbitrumVault() {
    if (!smartAccount) return

    smartAccount.setActiveChain(ChainId.POLYGON_MAINNET);

    const sas = await smartAccount.getSmartAccountState();
    console.log(`Entrypoint address: ${sas.entryPointAddress}`);

    const amount = ethers.utils.parseUnits(depositAmount, 6);
    console.log(amount);

    // Get approve transaction
    const { to: approveTo, data: approveCalldata } = await approve({
      chainId: ChainId.POLYGON_MAINNET,
      fromToken: USDC_POLYGON,
      toChainId: ChainId.ARBITRUM_ONE_MAINNET,
      toToken: VAULT_ARBITRUM,
      amount: amount.toString(),
    });
    console.log(approveTo)
    console.log(approveCalldata)

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
    console.log(quoteTo);
    console.log(quoteCalldata);

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

    // Get approve transaction
    const { to: approveTo, data: approveCalldata } = await approve({
      chainId: ChainId.ARBITRUM_ONE_MAINNET,
      fromToken: VAULT_ARBITRUM,
      toChainId: ChainId.POLYGON_MAINNET,
      toToken: USDC_POLYGON,
      amount: amount.toString(),
    });
    console.log(approveTo)
    console.log(approveCalldata)

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
    console.log(quoteTo);
    console.log(quoteCalldata);

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
          !smartAccount && !loading && <button onClick={login}>Login</button>
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
