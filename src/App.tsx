import './App.css'
import { useState, useEffect } from 'react'

import { ChainId } from "@biconomy/core-types";
import { ethers } from 'ethers'
import { BiconomySmartAccount, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GaslessType, approve, getBalances, quote } from "wido";

import { BiconomyPaymaster } from 'wido';
import { getEthersSigner } from './provider';
import { disconnect, watchAccount } from 'wagmi/actions';
import { Bundler } from '@biconomy/bundler';

const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const VAULT_ARBITRUM = "0x562Ae83d17590d9681D5445EcfC0F56517e49f24";
const SMART_ACCOUNT_INDEX = 0;

type ChainIds = 137 | 42161;

function App() {
  const [smartAccount, setSmartAccount] = useState<{ [key in ChainIds]: BiconomySmartAccount | null }>({
    [ChainId.POLYGON_MAINNET]: null,
    [ChainId.ARBITRUM_ONE_MAINNET]: null,
  })
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false)

  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [polygonUSDCBalance, setPolygonUSDCBalance] = useState<string>("0");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("0");
  const [arbitrumVaultBalance, setArbitrumVaultBalance] = useState<string>("0");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watchAccount((_account) => setupSmartAccount());


  useEffect(() => {
    async function fetchData() {
      if (!smartAccountAddress) return
      const bal = await getBalances(smartAccountAddress, [ChainId.POLYGON_MAINNET, ChainId.ARBITRUM_ONE_MAINNET]);
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
  }, [smartAccount, smartAccountAddress])


  async function setupSmartAccount() {
    const web3Signer = await getEthersSigner({ chainId: ChainId.POLYGON_MAINNET });
    if (!web3Signer) return
    console.log("Setting up smart account...")
    setLoading(true)


    const bundlerPolygon = new Bundler({
      bundlerUrl: "https://bundler.biconomy.io/api/v2/137/oEHNi7Cc9.f1b032c0-b868-43e9-aef0-27b6ec8b1b24",
      chainId: ChainId.POLYGON_MAINNET,
      entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    });

    const bundlerArbitrum = new Bundler({
      bundlerUrl: "https://bundler.biconomy.io/api/v2/42161/7mpOBM7HL.e1acc8ce-1125-4831-8a23-7a37f1e45a66",
      chainId: ChainId.ARBITRUM_ONE_MAINNET,
      entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    });

    const biconomySmartAccountConfigPolygon = {
      signer: web3Signer,
      chainId: ChainId.POLYGON_MAINNET,
      paymaster: new BiconomyPaymaster(ChainId.POLYGON_MAINNET),
      bundler: bundlerPolygon,
    }

    const biconomySmartAccountConfigArbitrum = {
      signer: web3Signer,
      chainId: ChainId.ARBITRUM_ONE_MAINNET,
      paymaster: new BiconomyPaymaster(ChainId.ARBITRUM_ONE_MAINNET),
      bundler: bundlerArbitrum,
    }

    const biconomyAccountPolygon = new BiconomySmartAccount(biconomySmartAccountConfigPolygon);
    const biconomyAccountArbitrum = new BiconomySmartAccount(biconomySmartAccountConfigArbitrum);
    const biconomySmartAccountPolygon = await biconomyAccountPolygon.init({ accountIndex: SMART_ACCOUNT_INDEX });
    const biconomySmartAccountArbitrum = await biconomyAccountArbitrum.init({ accountIndex: SMART_ACCOUNT_INDEX });

    setSmartAccount({
      [ChainId.POLYGON_MAINNET]: biconomySmartAccountPolygon,
      [ChainId.ARBITRUM_ONE_MAINNET]: biconomySmartAccountArbitrum,
    });

    setSmartAccountAddress(await biconomySmartAccountPolygon.getSmartAccountAddress(SMART_ACCOUNT_INDEX));

    setLoading(false)
  }

  const logout = async () => {
    await disconnect();
    setSmartAccount({
      [ChainId.POLYGON_MAINNET]: null,
      [ChainId.ARBITRUM_ONE_MAINNET]: null,
    });
    setSmartAccountAddress("")
  }


  async function depositPolygonUSDCToArbitrumVault() {
    if (!smartAccount[ChainId.POLYGON_MAINNET]) return

    const account = smartAccount[ChainId.POLYGON_MAINNET];
    console.log(`Account address: ${smartAccountAddress}`);

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

    console.log("Getting Quote...")
    // Get deposit transaction
    const { to: quoteTo, data: quoteCalldata } = await quote({
      user: smartAccountAddress,
      fromChainId: ChainId.POLYGON_MAINNET,
      fromToken: USDC_POLYGON,
      toChainId: ChainId.ARBITRUM_ONE_MAINNET,
      toToken: VAULT_ARBITRUM,
      amount: amount.toString(),
      gaslessType: GaslessType.ERC4337,
    });
    console.log("Fetched Quote...")

    let partialUserOp = await account.buildUserOp([
      {
        to: approveTo,
        data: approveCalldata,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        to: quoteTo!,
        data: quoteCalldata,
      }
    ]);

    if (!await account.isAccountDeployed(smartAccountAddress)) {
      // Gas estimation is an issue if the contract is not deployed.
      // We manually set the gas limit.
      console.log("Account not deployed setting callGasLimit manually...")
      partialUserOp = await account.estimateUserOpGas(partialUserOp);
      partialUserOp.callGasLimit = 2000000;
    }

    console.log("Fetching paymaster data");
    const paymasterAndDataResponse =
      await account.getPaymasterAndData(
        partialUserOp
      );
    partialUserOp.paymasterAndData = paymasterAndDataResponse;

    console.log(partialUserOp);

    const userOpResponse = await account.sendUserOp(partialUserOp);
    console.log(`userOp Hash: ${userOpResponse.userOpHash}`);
    const transactionDetails = await userOpResponse.wait();
    console.log(
      `transactionDetails: ${JSON.stringify(transactionDetails, null, "\t")}`
    );
  }

  async function withdrawArbitrumVaultToPolygonUSDC() {
    if (!smartAccount[ChainId.ARBITRUM_ONE_MAINNET]) return

    const account = smartAccount[ChainId.ARBITRUM_ONE_MAINNET];
    console.log(`Account address: ${await account.getSmartAccountAddress(SMART_ACCOUNT_INDEX)}`);

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

    console.log("Getting Quote...")
    // Get deposit transaction
    const { to: quoteTo, data: quoteCalldata } = await quote({
      user: smartAccountAddress,
      toChainId: ChainId.POLYGON_MAINNET,
      toToken: USDC_POLYGON,
      fromChainId: ChainId.ARBITRUM_ONE_MAINNET,
      fromToken: VAULT_ARBITRUM,
      amount: amount.toString(),
      gaslessType: GaslessType.ERC4337,
    });
    console.log("Fetched Quote...")

    let partialUserOp = await account.buildUserOp([
      {
        to: approveTo,
        data: approveCalldata,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        to: quoteTo!,
        data: quoteCalldata,
      }
    ]);

    if (!await account.isAccountDeployed(smartAccountAddress)) {
      // Gas estimation is an issue if the contract is not deployed.
      // We manually set the gas limit.
      console.log("Account not deployed setting callGasLimit manually...")
      partialUserOp = await account.estimateUserOpGas(partialUserOp);
      partialUserOp.callGasLimit = 2000000;
    }

    console.log("Fetching paymaster data");
    const paymasterAndDataResponse =
      await account.getPaymasterAndData(
        partialUserOp
      );
    partialUserOp.paymasterAndData = paymasterAndDataResponse;

    console.log(partialUserOp);

    const userOpResponse = await account.sendUserOp(partialUserOp);
    console.log(`userOp Hash: ${userOpResponse.userOpHash}`);
    const transactionDetails = await userOpResponse.wait();
    console.log(
      `transactionDetails: ${JSON.stringify(transactionDetails, null, "\t")}`
    );
  }

  return (
    <>
      <div>
        <h1>Wido Gasless for Smart Contract Accounts</h1>
        <p>This demo shows depositing USDC on Polygon to <a href="https://arbiscan.io/address/0x562ae83d17590d9681d5445ecfc0f56517e49f24">Stargate Beefy Vault</a> on Arbitrum. Any token pair between any Wido supported chain can be used for Gasless transactions.</p>
        <p>Please connect your <b>EOA</b> to create or reuse existing Smart Account wallet. Directly connecting Smart Wallet is not supported in this demo.</p>
        <div style={{ height: "70px" }}></div>
        {
          !smartAccount[ChainId.POLYGON_MAINNET] && !loading && <ConnectButton />
        }
        {
          loading && <p>Loading account details...</p>
        }
        {
          !!smartAccount[ChainId.POLYGON_MAINNET] && (
            <>
              <div className="buttonWrapper">
                <h3>Smart account address:</h3>
                <p>{smartAccountAddress}</p>
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
