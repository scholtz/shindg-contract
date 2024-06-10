import algosdk from 'algosdk';
import { Buffer } from 'buffer';

interface IGetBoxReferenceControlInput {
  app: number | bigint;
  owner: Uint8Array;
  controller: Uint8Array;
}
const getBoxReferenceControl = (input: IGetBoxReferenceControlInput) => {
  const box: algosdk.BoxReference = {
    appIndex: Number(input.app),
    name: new Uint8Array(Buffer.concat([Buffer.from('c'), Buffer.from(input.owner), Buffer.from(input.controller)])), // data box
  };
  return box;
};
export default getBoxReferenceControl;
