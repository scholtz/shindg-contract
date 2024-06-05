import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { LogicSigAccount } from 'algosdk';
import { readFileSync } from 'fs';
import { ShindgClient } from '../contracts/clients/ShindgClient';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

let appClient: ShindgClient;

async function getLsigAccount(algod: algosdk.Algodv2, appID: bigint): Promise<algosdk.LogicSigAccount> {
  const qrLsigTeal = readFileSync(`./contracts/artifacts/QrLsig.lsig.teal`, 'utf8');
  // Replace the template variable in the lsig TEAL
  const teal = qrLsigTeal.replace('TMPL_APP_ID', appID.toString());

  // Compile the TEAL
  const result = await algod.compile(Buffer.from(teal)).do();
  const b64program = result.result;

  // Generate a LogicSigAccount object from the compiled program
  return new algosdk.LogicSigAccount(new Uint8Array(Buffer.from(b64program, 'base64')));
}
describe('Shindg', () => {
  beforeEach(fixture.beforeEach);

  test('makeQR', async () => {
    const contract = 123n;
    const lsig = await getLsigAccount(fixture.context.algod, contract);

    lsig.sign(fixture.context.testAccount.sk);
    const qr = {
      contract,
      lisg: Buffer.from(lsig.toByte()).toString('base64url'),
    };
    console.log(qr);
    expect(qr.lisg.length).toBeGreaterThan(50);
  });
});
