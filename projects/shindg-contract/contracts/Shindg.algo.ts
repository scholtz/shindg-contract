import { Contract } from '@algorandfoundation/tealscript';

type Token = {
  /**
   * State of the ticket
   *
   * ON_SALE: 1,
   * NOT_CHECKED_IN: 10,
   * CHECKED_IN: 100,
   * CHECKED_OUT: 1000,
   */
  state: uint64;
  /**
   * Owner can move NFT to another account or he can delegate moving to this NFT or he can delegate moving rights to all NFTs under this contract
   */
  owner: Address;
  /**
   * Delegated account address who can transfer the NFT
   */
  controller: Address;
  /**
   * Area of the seat. If event allows to pick seats only just before the checkin time user can upgrade his ticket only within the same area.
   */
  area: string;
  /**
   * The exact location where person will seat
   */
  seat: string;
  /**
   * URL address of the NFT
   */
  uri: string;
  /**
   * Image URL
   */
  image: string;
  /**
   * The price in base currency units
   */
  price: uint64;
  /**
   * Base currency
   */
  currency: uint64;
};
type Control = {
  /**
   * Anyone can create control box. If he owns or will own NFT this delegation control allows the other account to transfer any of the owners NFTs to third party
   */
  owner: Address;
  /**
   * Address to whom is the transfer delegated
   */
  controller: Address;
};

export class Shindg extends Contract {
  index = GlobalStateKey<uint64>();

  /**
   * NFT Name - Event name
   */
  name = GlobalStateKey<string>();

  /**
   * NFT Symbol
   */
  symbol = GlobalStateKey<string>();

  /**
   * List of NFTs under this smart contract
   */
  tokenBox = BoxMap<uint64, Token>({ prefix: 'n' });

  /**
   * Owner Account can delegate the permission to move any NFT in this contract to another address. In this box is information about the delegation.
   */
  controlBox = BoxMap<Control, bytes>({ prefix: 'c' });

  /**
   * Constructor
   * @param name NFT Name
   * @param symbol NFT Symbol
   */
  createApplication(name: string, symbol: string): void {
    this.name.value = name;
    this.symbol.value = symbol;
  }

  // PRIVATE METHODS

  /**
   * Execute transfer - change the state of the token.
   * @param to Address of receiver
   * @param tokenId TokenID
   */
  private transferTo(to: Address, tokenId: uint256): void {
    const tokenId64 = tokenId as uint64;
    assert(this.tokenBox(tokenId64).exists);
    const box = this.tokenBox(tokenId64).value;
    box.owner = to;
    box.controller = to;
  }

  // ARC76 NON READONLY METHODS

  /**
   * Transfers ownership of an NFT
   */
  arc72_transferFrom(_from: Address, to: Address, tokenId: uint256): void {
    const token = this.tokenBox(tokenId as uint64).value;

    const key: Control = { owner: this.txn.sender, controller: _from };

    if (this.txn.sender === _from || this.txn.sender === token.controller || this.controlBox(key).exists) {
      this.transferTo(to, tokenId);
    } else throw Error('Transfer not authorized');
  }

  /**
   *
   * Approve a controller for a single NFT
   *
   * @param approved Approved controller address
   * @param tokenId The ID of the NFT
   */
  arc72_approve(approved: Address, tokenId: uint256): void {
    const tokenId64 = tokenId as uint64;
    assert(this.tokenBox(tokenId64).exists);
    const box = this.tokenBox(tokenId64).value;
    assert(this.txn.sender === box.owner);

    box.controller = approved;
  }

  /**
   *
   * Approve an operator for all NFTs for a user
   *
   * @param operator Approved operator address
   * @param approved true to give approval, false to revoke
   * @returns
   */
  arc72_setApprovalForAll(operator: Address, approved: boolean): void {
    const key: Control = { owner: this.txn.sender, controller: operator };

    if (approved) this.controlBox(key).value = '';
    else if (this.controlBox(key).exists) this.controlBox(key).delete();
  }

  // ARC76 READONLY METHODS

  /**
   *
   * Returns the address of the current owner of the NFT with the given tokenId
   *
   * @param tokenId The ID of the NFT
   * @returns The current owner of the NFT
   */
  @abi.readonly
  arc72_ownerOf(tokenId: uint256): Address {
    return this.tokenBox(tokenId as uint64).value.owner;
  }

  /**
   *
   * Returns a URI pointing to the NFT metadata
   *
   * @param tokenId The ID of the NFT
   * @returns URI to token metadata
   */
  @abi.readonly
  arc72_tokenURI(tokenId: uint256): string {
    return this.tokenBox(tokenId as uint64).value.uri;
  }

  /**
   * Returns the number of NFTs currently defined by this contract
   */
  @abi.readonly
  arc72_totalSupply(): uint256 {
    return this.index.value as uint256;
  }

  /**
   * Returns the token ID of the token with the given index among all NFTs defined by the contract
   */
  @abi.readonly
  arc72_tokenByIndex(index: uint256): uint256 {
    return index;
  }

  // OTHER NFT METHODS
  mint(
    state: uint64,
    to: Address,
    area: string,
    seat: string,
    image: string,
    uri: string,
    price: uint64,
    currency: uint64
  ): void {
    assert(
      this.txn.sender === globals.creatorAddress,
      'Only creator is allowed to mint specific NFTs for this collection'
    );
    assert(state === 1 || state === 10, 'Minter can set state only to ON_SALE or not for sale ');
    const index = this.index.value;

    const token: Token = {
      state: state,
      owner: to,
      controller: to,
      area: area,
      seat: seat,
      uri: uri,
      image: image,
      price: price,
      currency: currency,
    };
    assert(token.state !== 0, 'Token state is not 0');
    this.tokenBox(index).value = token;
    this.transferTo(to, index as uint256);

    // assert(this.tokenBox(index).value.state !== 0, 'State cannot be zero after minting');
    this.index.value = index + 1;
  }

  /**
   * Owner of NFT can check in or check out from the event
   * @param nftIndex
   * @param state
   */
  checkIn(nftIndex: uint64, state: uint64): void {
    const nft = this.tokenBox(nftIndex).value;
    assert(nft.owner === this.txn.sender, 'Only owner of the NFT can change the state');
    assert(state === 100 || state === 1000, 'Only owner of the NFT can change the state');
    nft.state = state;
  }

  /**
   * Owner of NFT can check in or check out from the event
   * @param buyTxn The buy transaction
   * @param nftIndex NFT Index
   */
  buy(buyTxn: Txn, nftIndex: uint64): void {
    const nft = this.tokenBox(nftIndex).value;
    assert(nft.state === 1, 'NFT Ticket is not for sale');
    assert(nft.owner === buyTxn.assetReceiver, 'Price must be paid to the owner of the NFT');
    assert(nft.price === buyTxn.assetAmount, 'Exact price must be paid to the owner of the NFT');

    nft.owner = buyTxn.sender;
    nft.state = 10;
  }

  /**
   * Owner of NFT can check in or check out from the event
   * @param nftIndex NFT Index
   * @param price The price which has to be paid
   * @param currency The currency for price
   */
  setPrice(nftIndex: uint64, price: uint64, currency: uint64): void {
    const nft = this.tokenBox(nftIndex).value;
    assert(nft.state === 1 || nft.state === 10, 'NFT Ticket is not in valid state');
    assert(nft.owner === this.txn.sender, 'Only owner of this NFT can change the price');

    nft.state = 1;
    nft.currency = currency;
    nft.price = price;
  }

  /**
   * Set not for sale
   * @param nftIndex NFT
   */
  setNotForSale(nftIndex: uint64): void {
    const nft = this.tokenBox(nftIndex).value;
    assert(nft.state === 1, 'NFT Ticket is not for sale');
    assert(nft.owner === this.txn.sender, 'Only owner of this NFT can change it from being on sale');

    nft.state = 10;
  }
}
