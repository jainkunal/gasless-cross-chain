import {
  IPaymasterAPI,
  PaymasterServiceDataType,
  UserOperation,
} from "@biconomy/core-types";
import { resolveProperties } from "@ethersproject/properties";
import { HttpMethod, sendRequest } from "./httpRequests";
import { ethers } from "ethers";

export class StackupPaymasterAPI implements IPaymasterAPI {
  async getPaymasterAndData(
    userOp: Partial<UserOperation>,
    paymasterServiceData?: PaymasterServiceDataType | undefined
  ): Promise<string> {
    console.log("In StackupPaymasterAPI.getPaymasterAndData");
    userOp = await resolveProperties(userOp);
    console.log(userOp);
    userOp.nonce = Number(userOp.nonce);
    userOp.callGasLimit = Number(userOp.callGasLimit);
    userOp.verificationGasLimit = Number(userOp.verificationGasLimit);
    userOp.maxFeePerGas = Number(userOp.maxFeePerGas);
    userOp.maxPriorityFeePerGas = Number(userOp.maxPriorityFeePerGas);
    userOp.preVerificationGas = Number(userOp.preVerificationGas);
    userOp.signature = "0x";
    userOp.paymasterAndData = "0x";

    console.log(userOp);
    console.log(paymasterServiceData);
    // "https://api.stackup.sh/v1/paymaster/cfb46489d22432e06b2f796617229d9691d0841bab16b3c060012ff9e430e4a6"

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "pm_sponsorUserOperation",
      params: [
        {
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
          signature: userOp.signature, // Can be a valid dummy value
        },
        "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
        {
          type: "payg",
        },
      ],
    };

    // const result: any = await sendRequest({
    //   url: "https://api.stackup.sh/v1/paymaster/cfb46489d22432e06b2f796617229d9691d0841bab16b3c060012ff9e430e4a6",
    //   method: HttpMethod.Post,
    //   //   headers: { "x-api-key": this.paymasterConfig.dappAPIKey },
    //   body,
    // });

    const provider = new ethers.providers.JsonRpcProvider(
      "https://api.stackup.sh/v1/paymaster/cfb46489d22432e06b2f796617229d9691d0841bab16b3c060012ff9e430e4a6"
    );
    const pm = await provider.send("pm_sponsorUserOperation", [
      {
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
        signature: userOp.signature, // Can be a valid dummy value
      },
      "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
      {
        type: "payg",
      },
    ]);

    console.log("verifying and signing service response", pm);

    return Promise.resolve("");
  }
}
