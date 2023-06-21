import {
  IPaymasterAPI,
  PaymasterServiceDataType,
  UserOperation,
} from "@biconomy/core-types";
import { resolveProperties } from "@ethersproject/properties";

export class WidoPaymasterAPI implements IPaymasterAPI {
  chainId: number;

  // TODO: Check if we have existing type in the SDK for this.
  constructor(chainId: number) {
    this.chainId = chainId;
  }

  async getPaymasterAndData(
    userOp: Partial<UserOperation>,
    paymasterServiceData?: PaymasterServiceDataType | undefined
  ): Promise<string> {
    console.log("In WidoPaymasterAPI.getPaymasterAndData");
    userOp = await resolveProperties(userOp);

    userOp.nonce = Number(userOp.nonce);
    userOp.callGasLimit = Number(userOp.callGasLimit);
    userOp.verificationGasLimit = Number(userOp.verificationGasLimit);
    userOp.maxFeePerGas = Number(userOp.maxFeePerGas);
    userOp.maxPriorityFeePerGas = Number(userOp.maxPriorityFeePerGas);
    userOp.preVerificationGas = Number(userOp.preVerificationGas);
    userOp.signature = "0x";
    userOp.paymasterAndData = "0x";

    console.log(
      JSON.stringify({
        chainId: this.chainId,
        sender: userOp.sender, // address
        nonce: userOp.nonce, // uint256
        initCode: userOp.initCode, // bytes
        callData: userOp.callData, // bytes
        callGasLimit: userOp.callGasLimit, // uint256
        verificationGasLimit: userOp.verificationGasLimit, // uint256
        preVerificationGas: userOp.preVerificationGas, // uint256
        maxFeePerGas: userOp.maxFeePerGas, // uint256
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas, // uint256
        paymasterAndData: userOp.paymasterAndData, // bytes
        signature: userOp.signature,
      })
    );
    const res = await fetch("http://localhost:8080/paymaster", {
      method: "POST",
      mode: "cors",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chainId: this.chainId,
        sender: userOp.sender, // address
        nonce: userOp.nonce, // uint256
        initCode: userOp.initCode, // bytes
        callData: userOp.callData, // bytes
        callGasLimit: userOp.callGasLimit, // uint256
        verificationGasLimit: userOp.verificationGasLimit, // uint256
        preVerificationGas: userOp.preVerificationGas, // uint256
        maxFeePerGas: userOp.maxFeePerGas, // uint256
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas, // uint256
        paymasterAndData: userOp.paymasterAndData, // bytes
        signature: userOp.signature,
      }),
    });

    if (!res.ok) {
      throw new Error("Error in WidoPaymasterAPI");
    }

    const { paymasterAndData } = await res.json();

    if (
      paymasterAndData !== undefined &&
      paymasterAndData !== "" &&
      paymasterAndData !== "0x"
    ) {
      console.log("Wido is paying for the tx");
    }

    return paymasterAndData;
  }
}
