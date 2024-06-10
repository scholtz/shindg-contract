import { describe, test, expect, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, {
  LogicSigAccount,
  Transaction,
  makeAssetCreateTxnWithSuggestedParamsFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
} from 'algosdk';
import { ShindgClient } from '../contracts/clients/ShindgClient';
import { getBoxReferenceNFT, getLsigAccount } from '../src';
import { IQRCode } from '../src/types/IQRCode';
import { State } from '../src/types/State';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

// async function getLsigAccount(algod: algosdk.Algodv2, appID: bigint): Promise<algosdk.LogicSigAccount> {
//   const qrLsigTeal = readFileSync(`./contracts/artifacts/QrLsig.lsig.teal`, 'utf8');
//   // Replace the template variable in the lsig TEAL
//   const teal = qrLsigTeal.replace('TMPL_APP_ID', appID.toString());

//   // Compile the TEAL
//   const result = await algod.compile(Buffer.from(teal)).do();
//   const b64program = result.result;

//   // Generate a LogicSigAccount object from the compiled program
//   return new algosdk.LogicSigAccount(new Uint8Array(Buffer.from(b64program, 'base64')));
// }
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
  test('create nft event, buy ticket, and enter event', async () => {
    algokit.Config.configure({ populateAppCallResources: false }); // for tests do not populate fields.. all fields must be provided

    const { algod } = fixture.context;
    const eventCreatorAccount = await fixture.context.generateAccount({
      initialFunds: algokit.microAlgos(1_000_000_000),
    });
    const eventBuyerAccount = await fixture.context.generateAccount({
      initialFunds: algokit.microAlgos(1_000_000_000),
    });
    const params = await algod.getTransactionParams().do();
    // create fake USDC asset
    const assetTx = makeAssetCreateTxnWithSuggestedParamsFromObject({
      decimals: 6,
      assetName: 'USDC',
      defaultFrozen: false,
      from: eventCreatorAccount.addr,
      suggestedParams: params,
      total: 1_000_000_000_000,
    });
    await algod.sendRawTransaction(assetTx.signTxn(eventCreatorAccount.sk)).do();

    const assetInfo = await algosdk.waitForConfirmation(algod, assetTx.txID(), 4);
    // console.log('assetInfo', assetInfo);
    const usdcAsset = assetInfo['asset-index'] as bigint;
    expect(usdcAsset).toBeGreaterThan(0);

    // optin buyer to the USDC
    const optinBuyer = makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0,
      assetIndex: Number(usdcAsset),
      from: eventBuyerAccount.addr, // fake usdc creator
      suggestedParams: params,
      to: eventBuyerAccount.addr,
    });
    await algod.sendRawTransaction(optinBuyer.signTxn(eventBuyerAccount.sk)).do();
    await algosdk.waitForConfirmation(algod, optinBuyer.txID(), 4);

    // fund buyer with the USDC
    const fundBuyerUsdc = makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 100_000_000,
      assetIndex: Number(usdcAsset),
      from: eventCreatorAccount.addr, // fake usdc creator
      suggestedParams: params,
      to: eventBuyerAccount.addr,
    });
    await algod.sendRawTransaction(fundBuyerUsdc.signTxn(eventCreatorAccount.sk)).do();
    await algosdk.waitForConfirmation(algod, fundBuyerUsdc.txID(), 4);

    // CREATE CLIENT
    const eventCreator = {
      addr: eventCreatorAccount.addr,
      // eslint-disable-next-line no-unused-vars
      signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(eventCreatorAccount.sk));
      },
    };
    const client = new ShindgClient(
      {
        sender: eventCreator,
        resolveBy: 'id',
        id: 0,
      },
      algod
    );
    await client.create.createApplication({ name: 'Test event', symbol: 'TSTEVENT' });

    const ref = await client.appClient.getAppReference();
    expect(ref.appId).toBeGreaterThan(0);

    // FUND the NFT contract by creator
    const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: eventCreatorAccount.addr,
      amount: 100_000_000,
      suggestedParams: params,
      to: ref.appAddress,
    });
    await algod.sendRawTransaction(fundTx.signTxn(eventCreatorAccount.sk)).do();
    const nextNFTIndex0 = (await client.getGlobalState()).index?.asNumber() ?? 0;
    expect(nextNFTIndex0).toBe(0);
    // MINT nft one by one
    await client.mint(
      {
        to: eventCreator.addr,
        area: 'Red Zone',
        seat: 'Seat 1',
        image: 'https://shindg.vercel.app/seat1.png',
        uri: 'https://shindg.vercel.app/Event1',
        price: 10_000_000n, // 10 USDC
        currency: usdcAsset,
        state: State.ON_SALE,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: nextNFTIndex0 })],
      }
    );
    const nextNFTIndex1 = (await client.getGlobalState()).index?.asNumber() ?? 0;
    expect(nextNFTIndex1).toBe(1);
    // MINT nft one by one
    await client.mint(
      {
        to: eventCreator.addr,
        area: 'Red Zone',
        seat: 'Seat 2',
        image: 'https://shindg.vercel.app/seat2.png',
        uri: 'https://shindg.vercel.app/Event1',
        price: 9_000_000n, // 9 USDC
        currency: usdcAsset,
        state: State.ON_SALE,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: nextNFTIndex1 })],
      }
    );
    const nextNFTIndex2 = (await client.getGlobalState()).index?.asNumber() ?? 0;
    expect(nextNFTIndex2).toBe(2);
    // MINT nft one by one
    await client.mint(
      {
        to: eventCreator.addr,
        area: 'Blue Zone',
        seat: 'Seat 1',
        image: 'https://shindg.vercel.app/seat3.png',
        uri: 'https://shindg.vercel.app/Event1',
        price: 8_000_000n, // 8 USDC
        currency: usdcAsset,
        state: State.ON_SALE,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: nextNFTIndex2 })],
      }
    );

    expect((await client.getGlobalState()).index?.asNumber()).toBe(3);
    /// buy ticket by user

    // CREATE CLIENT for BUYER
    const eventBuyer = {
      addr: eventBuyerAccount.addr,
      // eslint-disable-next-line no-unused-vars
      signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(eventBuyerAccount.sk));
      },
    };
    const clientBuyer = new ShindgClient(
      {
        sender: eventBuyer,
        resolveBy: 'id',
        id: ref.appId,
      },
      algod
    );
    // Buy nft
    const buyNFTIndex = 1;

    await clientBuyer.buy(
      {
        buyTxn: makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 9_000_000n,
          assetIndex: Number(usdcAsset),
          from: eventBuyerAccount.addr,
          suggestedParams: params,
          to: eventCreatorAccount.addr,
        }),
        nftIndex: buyNFTIndex,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: buyNFTIndex })],
      }
    );

    const lsig = await getLsigAccount(algod, BigInt(ref.appId));
    lsig.sign(eventBuyerAccount.sk);
    const qr = JSON.stringify({
      contract: ref.appId,
      nftId: buyNFTIndex,
      lisg: Buffer.from(lsig.toByte()).toString('base64url'),
    });
    console.log(qr);
    expect(qr.length).toBeGreaterThan(50);

    // DECODE QR CODE
    const decodedQR = JSON.parse(qr) as IQRCode;
    const bytes = Buffer.from(decodedQR.lisg, 'base64url');
    const lsigDecoded = LogicSigAccount.fromByte(bytes);

    // CREATE CLIENT for BUYER with delegated sig
    const eventBuyerLsig = {
      addr: eventBuyerAccount.addr,
      // eslint-disable-next-line no-unused-vars
      signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => {
          const signedSmartSigTxn = algosdk.signLogicSigTransactionObject(tx, lsigDecoded);
          return signedSmartSigTxn.blob;
        });
      },
    };
    const clientBuyerLsig = new ShindgClient(
      {
        sender: eventBuyerLsig,
        resolveBy: 'id',
        id: ref.appId,
      },
      algod
    );
    // Check in
    await clientBuyerLsig.checkIn(
      {
        nftIndex: buyNFTIndex,
        state: State.CHECKED_IN,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: buyNFTIndex })],
      }
    );
    // Check out .. person needs to go to the car
    await clientBuyerLsig.checkIn(
      {
        nftIndex: buyNFTIndex,
        state: State.CHECKED_OUT,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: buyNFTIndex })],
      }
    );
    // Check in back again
    await clientBuyerLsig.checkIn(
      {
        nftIndex: buyNFTIndex,
        state: State.CHECKED_IN,
      },
      {
        boxes: [getBoxReferenceNFT({ app: ref.appId, nftAsset: buyNFTIndex })],
      }
    );
  });
});
