import algosdk from 'algosdk';

async function getLsigAccount(algod: algosdk.Algodv2, appID: bigint): Promise<algosdk.LogicSigAccount> {
  // const qrLsigTeal = readFileSync(`./contracts/artifacts/QrLsig.lsig.teal`, 'utf8');
  const qrLsigTeal = `#pragma version 10
  //#pragma mode logicsig
  
  // This TEAL was generated by TEALScript v0.94.1
  // https://github.com/algorandfoundation/TEALScript
  
  // The address of this logic signature is ISPEEBCLIQSA5C3Q5L7AE27ZZGNKU63YLP6JCLNHVCC5STPKXM6NXX3RG4
  
  b *route_logic
  
  // logic()void
  *route_logic:
    // execute logic()void
    callsub logic
    int 1
    return
  
  // logic(): void
  //
  // Verify this is an opt in transaction
  logic:
    proto 0 0
  
    // contractsrLsig.algo.ts:9
    // verifyTxn(this.txn, {
    //       // It's very important to set fee to 0 for delegated logic signatures
    //       // Otherwise the fee can be used to drain the signer's account
    //       fee: 0,
    //       // Also very important to check that the rekey is set to zero address
    //       rekeyTo: globals.zeroAddress,
    //       // Finally we must ensure that this is not a close transaction, which will drain the signer's account of the given asset
    //       assetCloseTo: globals.zeroAddress,
    //     })
    // verify fee
    txn Fee
    int 0
    ==
  
    // transaction verification failed: {"txn":"this.txn","field":"fee","expected":"0"}
    assert
  
    // verify rekeyTo
    txn RekeyTo
    global ZeroAddress
    ==
  
    // transaction verification failed: {"txn":"this.txn","field":"rekeyTo","expected":"globals.zeroAddress"}
    assert
  
    // verify assetCloseTo
    txn AssetCloseTo
    global ZeroAddress
    ==
  
    // transaction verification failed: {"txn":"this.txn","field":"assetCloseTo","expected":"globals.zeroAddress"}
    assert
  
    // contractsrLsig.algo.ts:21
    // assert(this.txn.applicationID === this.APP_ID)
    txn ApplicationID
    pushint TMPL_APP_ID
    ==
    assert
  
    // contractsrLsig.algo.ts:22
    // assert(this.txn.applicationArgs[0] === method('checkIn(uint64,uint64)void'))
    txn ApplicationArgs 0
    method "checkIn(uint64,uint64)void"
    ==
    assert
    retsub`;
  // Replace the template variable in the lsig TEAL
  const teal = qrLsigTeal.replace('TMPL_APP_ID', appID.toString());

  // Compile the TEAL
  const result = await algod.compile(Buffer.from(teal)).do();
  const b64program = result.result;

  // Generate a LogicSigAccount object from the compiled program
  return new algosdk.LogicSigAccount(new Uint8Array(Buffer.from(b64program, 'base64')));
}
export default getLsigAccount;
