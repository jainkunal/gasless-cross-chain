import './App.css'
import { useState, useEffect, useRef } from 'react'
import SocialLogin from "@biconomy/web3-auth"

import { ChainId } from "@biconomy/core-types";
import { ethers } from 'ethers'
import SmartAccount from "@biconomy/smart-account";
import { approve } from "wido";

import abi from "./erc20abi.json"
import { WidoPaymasterAPI } from './WidoPaymasterAPI';


const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const VAULT_ARBITRUM = "0x562Ae83d17590d9681D5445EcfC0F56517e49f24";


function App() {
  const [smartAccount, setSmartAccount] = useState<SmartAccount | null>(null)
  const [interval, enableInterval] = useState(false)
  const sdkRef = useRef<SocialLogin | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [provider, setProvider] = useState<any>(null)

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
            customPaymasterAPI: new WidoPaymasterAPI(),
            dappAPIKey: "oEHNi7Cc9.f1b032c0-b868-43e9-aef0-27b6ec8b1b24",
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

  // async function sendERC20() {
  //   if (!smartAccount) return

  //   const sas = await smartAccount.getSmartAccountState();
  //   console.log(`Entrypoint address: ${sas.entryPointAddress}`);

  //   const contract = new ethers.Contract(
  //     "0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1",
  //     abi,
  //     provider,
  //   )
  //   const transferTx = await contract.populateTransaction.transfer("0x116F609A03425c210cD28391497e7b03D31fC051", ethers.utils.parseEther('0.01'))

  //   const txResponse = await smartAccount.sendTransaction({
  //     transaction: {
  //       to: '0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1',
  //       data: transferTx.data,
  //       value: 1
  //     },
  //     chainId: ChainId.POLYGON_MUMBAI,
  //   })

  //   const txHash = await txResponse.wait();
  //   console.log(txHash)
  // }

  async function depositPolygonUSDCToArbitrumVault() {
    if (!smartAccount) return

    const sas = await smartAccount.getSmartAccountState();
    console.log(`Entrypoint address: ${sas.entryPointAddress}`);

    const amount = ethers.utils.parseUnits('10', 6);
    console.log(amount);

    // Get approve transaction
    const { to: approveTo, data: approveCalldata } = await approve({
      chainId: ChainId.POLYGON_MAINNET,
      fromToken: USDC_POLYGON,
      // TODO: Fix the SDK
      // toChainId: ChainId.ARBITRUM_ONE_MAINNET,
      toToken: VAULT_ARBITRUM,
      amount: amount.toString(),
    });
    console.log(approveTo)
    console.log(approveCalldata)

    // Get deposit transaction


    const txResponse = await smartAccount.sendTransactionBatch({
      transactions: [
        {
          to: approveTo,
          data: approveCalldata,
        },
      ],
      chainId: ChainId.POLYGON_MAINNET,
    });

    const txHash = await txResponse.wait();
    console.log(txHash)
  }

  async function withdrawArbitrumVaultToPolygonUSDC() {
  }

  return (
    <>
      <div>
        <h1>Wido Gasless for Smart Contract Accounts</h1>
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
                {/* <Counter smartAccount={smartAccount} provider={provider} /> */}
                <button onClick={logout}>Logout</button>
              </div>
              <div>
                <button onClick={depositPolygonUSDCToArbitrumVault}>Deposit Polygon USDC to Arbitrum Vault</button>
                <button onClick={withdrawArbitrumVaultToPolygonUSDC}>Withdraw Arbitrum Vault to Polygon USDC</button>
                {/* <button onClick={sendERC20}>Send ERC20</button> */}
                {/* <WidoWidget ethProvider={provider} onSwitchChain={(p) => {
                  console.log('switching chain');
                  console.log(p);
                  const chainIdNum = parseInt(p.chainId);
                  console.log(chainIdNum);
                  smartAccount.setActiveChain(ChainId[chainIdNum]);
                  console.log(smartAccount);
                }} fromTokens={fromTokens} toTokens={toTokens} /> */}
              </div>
            </>
          )
        }
      </div>
    </>
  )
}

export default App
