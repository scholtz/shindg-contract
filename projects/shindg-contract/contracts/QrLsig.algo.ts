import { LogicSig } from '@algorandfoundation/tealscript';

class QrLsig extends LogicSig {
  APP_ID = TemplateVar<AppID>();

  /** Verify this is an opt in transaction */
  logic(): void {
    /** Verify that the transaction this logic signature is approving is an ASA opt-in */
    verifyTxn(this.txn, {
      // It's very important to set fee to 0 for delegated logic signatures
      // Otherwise the fee can be used to drain the signer's account
      // fee: 0, TODO FOR DEMO ONLY WE ACCEPT THIS DELEGATED SIG TO CAST FEE.. In the future must be rewritten so that other txn is taking care of fees.
      // Also very important to check that the rekey is set to zero address
      rekeyTo: globals.zeroAddress,
      // Finally we must ensure that this is not a close transaction, which will drain the signer's account of the given asset
      assetCloseTo: globals.zeroAddress,
    });

    // const appCall = this.txn;
    // // Use assert instead of verifyTxn because applicationArgs array is not yet supported in verifyTxn
    assert(this.txn.applicationID === this.APP_ID);
    assert(this.txn.applicationArgs[0] === method('checkIn(uint64,uint64)void'));
  }
}
